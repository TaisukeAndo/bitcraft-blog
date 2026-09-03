import { JAPANESE_CHARS_PER_MINUTE } from "../constants";

/**
 * 日本語向けの簡易読了時間算出。コードブロック・インラインコードを除いた
 * 本文文字数を JAPANESE_CHARS_PER_MINUTE で割って切り上げる（最低1分）。
 * 英語のword countベースの計算式は日本語の文章密度と合わないため使わない。
 */
export function estimateReadingTimeMin(markdown: string): number {
  const withoutCodeBlocks = markdown.replace(/```[\s\S]*?```/g, "");
  const withoutInlineCode = withoutCodeBlocks.replace(/`[^`]*`/g, "");
  const withoutMarkup = withoutInlineCode
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/[#>*_~-]/g, "");
  const charCount = withoutMarkup.replace(/\s+/g, "").length;
  return Math.max(1, Math.ceil(charCount / JAPANESE_CHARS_PER_MINUTE));
}
