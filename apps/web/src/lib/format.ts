// 日時・読了時間の表示用フォーマットをまとめる。DB上はISO 8601のTEXTで
// 保持している（packages/db/src/schema.ts）ため、表示直前にここで整形する。

/** "2026-08-04T12:00:00.000Z" 等 → "2026.08.04" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const datePart = iso.slice(0, 10);
  return datePart.replaceAll("-", ".");
}

/** sitemap.xml / RSS向け。ISO 8601のまま日付部分だけを保証して返す。 */
export function toIsoDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  // 既にTだけの区切りが無い"YYYY-MM-DD HH:MM:SS"形式（SQLiteのcurrent_timestamp既定値）
  // の場合はTで連結し直す。既にISO形式ならそのまま通す。
  return iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`;
}

/** RSSのpubDate（RFC 822）向け。 */
export function toRfc822Date(iso: string | null | undefined): string | null {
  const normalized = toIsoDate(iso);
  if (!normalized) return null;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date.toUTCString();
}

export function readingTimeLabel(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  return `${minutes}分で読めます`;
}
