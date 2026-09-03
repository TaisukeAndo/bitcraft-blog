// R2オブジェクトキー → /media/<key> の同一オリジンURLへ変換する。
// 同一オリジンにすることでOGPクローラー等との互換性を高める（bitcraft-siteの
// apps/web/src/lib/media-url.tsと同じ設計を踏襲）。
export function mediaUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  return `/media/${key}`;
}
