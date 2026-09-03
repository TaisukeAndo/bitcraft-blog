import { PhotonImage, SamplingFilter, resize } from "@cf-wasm/photon/workerd";

export interface ProcessedImage {
  bytes: Uint8Array;
  contentType: string;
  width: number;
  height: number;
}

// 自動圧縮・リサイズの対象とする入力フォーマット（実装プラン3章に追記、
// ユーザー指示により2026-09-04追加）。GIF（アニメーションをphoton-rsが保持できず
// 静止画になってしまう）とSVG（ベクター形式でリサイズ自体が無意味）は対象外とし、
// 元データのままR2へ保存する（呼び出し側 routes/media.ts が isProcessableImage で
// 判定し、falseならprocessImage自体を呼ばない）。
const PROCESSABLE_CONTENT_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

// 長辺の上限（px）。記事のサムネイル・本文中画像・Bookカバー・OGP画像のいずれも、
// 実際の表示幅はRetina考慮でも1200px程度に収まる（apps/webの各<img width>属性を参照）。
// これを超える解像度は表示上意味がなく、ファイルサイズを無駄に増やすだけのため縮小する。
export const MAX_DIMENSION = 2000;

// JPEG品質（0-100）。写真系画像で視覚的な劣化がほとんど気付かれない水準とされる
// 一般的な推奨レンジ（75-85）の中央値。
export const JPEG_QUALITY = 82;

// デコード後の生ピクセル数（幅×高さ）がこれを超える画像は処理しない
// （Workersのメモリ上限対策。RGBA=1px当たり4byteのため、
// 40,000,000pxは生ピクセルデータで概ね160MBに達し、Workerのメモリ上限
// （実質128MB程度）を超えるリスクが高いため、この規模のみ安全側に倒して弾く）。
export const MAX_DECODED_PIXELS = 40_000_000;

// アップロード自体を拒否するバイト数の上限（decodeBase64後のサイズ）。
// 圧縮処理に到達する前の入口でも制限し、意図的な超巨大アップロードによる
// メモリ枯渇・CPU時間超過を防ぐ（実装プラン3章）。
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB

export function isProcessableImage(contentType: string): boolean {
  return PROCESSABLE_CONTENT_TYPES.has(contentType.toLowerCase());
}

/**
 * アップロードされた画像を自動的に圧縮・リサイズする。
 * - 長辺がMAX_DIMENSIONを超える場合はアスペクト比を保ったまま縮小する
 *   （Lanczos3フィルタ。縮小時の画質劣化が少ない代わりに計算コストが高いが、
 *   アップロード時の1回限りの処理のため許容する）
 * - 透過（アルファチャンネル）を実際に使っている画像はPNGのまま出力し、
 *   使っていない画像はJPEGへ変換して圧縮する（JPEGは透過非対応のため）。
 *   WebP出力（PhotonImage.get_bytes_webp）は採用しない。photon-rs内部では
 *   image crateのWebPエンコーダを使っており、これはロスレス専用（品質パラメータを
 *   受け付けない）で、写真系画像ではJPEGより出力サイズが大きくなることがあるため。
 * - リサイズが発生しなかった場合（元々MAX_DIMENSION以内）に限り、再エンコード後の
 *   バイト数が元データ以上であれば処理せずnullを返す（既にJPEG圧縮済みの画像や、
 *   単色に近い極小画像を再圧縮すると、PNG/JPEGの性質上むしろ肥大化することがあるため。
 *   実機検証で確認して追加）。リサイズが発生した場合は解像度を下げる意義があるため、
 *   バイト数の増減に関わらず処理結果を採用する。
 * - 対象外フォーマット（GIF・SVG等）や、デコードに失敗した画像はnullを返し、
 *   呼び出し側（routes/media.ts）は元データのまま保存する。
 */
export function processImage(bytes: Uint8Array, contentType: string): ProcessedImage | null {
  if (!isProcessableImage(contentType)) return null;

  let input: PhotonImage | null = null;
  let resized: PhotonImage | null = null;
  try {
    input = PhotonImage.new_from_byteslice(bytes);
    const originalWidth = input.get_width();
    const originalHeight = input.get_height();
    if (originalWidth === 0 || originalHeight === 0) return null;
    if (originalWidth * originalHeight > MAX_DECODED_PIXELS) {
      // 巨大すぎる画像はメモリ上限を避けるため処理をスキップし、元データのまま保存する。
      return null;
    }

    let working = input;
    const longEdge = Math.max(originalWidth, originalHeight);
    const didResize = longEdge > MAX_DIMENSION;
    if (didResize) {
      const scale = MAX_DIMENSION / longEdge;
      const targetWidth = Math.max(1, Math.round(originalWidth * scale));
      const targetHeight = Math.max(1, Math.round(originalHeight * scale));
      resized = resize(input, targetWidth, targetHeight, SamplingFilter.Lanczos3);
      working = resized;
    }

    const width = working.get_width();
    const height = working.get_height();
    const hasTransparency = detectTransparency(working);

    const result = hasTransparency
      ? { bytes: working.get_bytes(), contentType: "image/png", width, height }
      : { bytes: working.get_bytes_jpeg(JPEG_QUALITY), contentType: "image/jpeg", width, height };

    if (!didResize && result.bytes.length >= bytes.length) {
      return null;
    }
    return result;
  } catch {
    // デコードに失敗した場合（壊れたファイル・photon-rs未対応の内部エンコーディング等）は
    // 処理を諦めて元データのまま保存する（アップロード自体は失敗させない）。
    return null;
  } finally {
    // photon-rsはWASM線形メモリ上にピクセルデータを確保するため、明示的にfree()しないと
    // Workerのアイソレートが使い回される間メモリリークする。get_bytes*()系メソッドは
    // 呼び出し時点でJS側の独立したUint8Arrayを返すため、その後にfree()しても
    // 既に取得済みの戻り値には影響しない。
    resized?.free();
    input?.free();
  }
}

/** RGBAの生ピクセルを走査し、不透明でない(alpha<255)ピクセルが1つでもあるか調べる。 */
function detectTransparency(image: PhotonImage): boolean {
  const pixels = image.get_raw_pixels();
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] !== 255) return true;
  }
  return false;
}

/** 元のファイル名の拡張子を、実際にエンコードした形式（jpg/png）に合わせて置き換える。 */
export function withExtensionForContentType(filename: string, contentType: string): string {
  const ext = contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : null;
  if (!ext) return filename;
  const base = filename.replace(/\.[^./]+$/, "");
  return `${base}.${ext}`;
}
