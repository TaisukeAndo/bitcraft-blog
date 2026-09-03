// POST /v1/media アップロード時、可能な範囲で画像のwidth/heightを読み取るための
// 最小実装（実装計画3章「画像なら可能な範囲でwidth/heightを取得できると尚良い※必須ではない」）。
// 外部ライブラリを追加せず、PNG/JPEG/GIFのバイナリヘッダのみを解析する。
// 対応できない形式・壊れたバイナリの場合はnullを返し、アップロード自体は継続させる
// （media.tsのcontent-typeバリデーションはここでは行わない＝呼び出し側の責務）。

export interface ImageDimensions {
  width: number;
  height: number;
}

export function readImageDimensions(bytes: Uint8Array, contentType: string): ImageDimensions | null {
  try {
    if (contentType === "image/png" || isPngSignature(bytes)) {
      return readPngDimensions(bytes);
    }
    if (contentType === "image/jpeg" || contentType === "image/jpg" || isJpegSignature(bytes)) {
      return readJpegDimensions(bytes);
    }
    if (contentType === "image/gif" || isGifSignature(bytes)) {
      return readGifDimensions(bytes);
    }
    return null;
  } catch {
    // バイナリが壊れている・想定外の形式の場合は諦めてnullを返す。
    return null;
  }
}

function isPngSignature(bytes: Uint8Array): boolean {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < sig.length) return false;
  return sig.every((byte, i) => bytes[i] === byte);
}

function readPngDimensions(bytes: Uint8Array): ImageDimensions | null {
  // シグネチャ(8byte) + IHDRチャンクのlength(4byte) + type"IHDR"(4byte) の後に
  // width(4byte, BE) / height(4byte, BE) が続く固定レイアウト。
  if (bytes.length < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

function isJpegSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function readJpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // SOI(0xFFD8)の直後からセグメントを辿り、SOFn(0xFFC0-0xFFCF、DHT=0xC4/JPG=0xC8/
  // DAC=0xCCを除く)マーカーのdata部先頭2byteがheight、続く2byteがwidth。
  let offset = 2;
  while (offset + 9 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === undefined) break;
    // スタンドアロンマーカー(パラメータ長を持たない)はスキップ。
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const segmentLength = view.getUint16(offset + 2, false);
    const isSofMarker =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSofMarker) {
      const height = view.getUint16(offset + 5, false);
      const width = view.getUint16(offset + 7, false);
      if (width <= 0 || height <= 0) return null;
      return { width, height };
    }
    offset += 2 + segmentLength;
  }
  return null;
}

function isGifSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 6) return false;
  const header = String.fromCharCode(...bytes.slice(0, 6));
  return header === "GIF87a" || header === "GIF89a";
}

function readGifDimensions(bytes: Uint8Array): ImageDimensions | null {
  // ヘッダ(6byte) 直後のLogical Screen Descriptorにwidth/height(各2byte, LE)。
  if (bytes.length < 10) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint16(6, true);
  const height = view.getUint16(8, true);
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}
