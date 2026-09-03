import type { FC } from "hono/jsx";

export interface ThumbPlaceholderProps {
  kind?: "post" | "book";
}

// サムネイル（ogImageKey / coverImageKey）が未設定の記事・Bookカードに表示する
// アイコン（文字プレースホルダーの代わり。ユーザー指示により2026-09-04変更）。
// 色は--color-border-strongのみを使う単色ラインアートで、デザインシステム
// （実装プラン6章）のミニマルな配色に合わせる。
export const ThumbPlaceholder: FC<ThumbPlaceholderProps> = ({ kind = "post" }) => (
  <div class="thumb-placeholder" aria-hidden="true">
    {kind === "book" ? (
      <svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M10 8h20a4 4 0 0 1 4 4v26a3 3 0 0 0-3-3H10a3 3 0 0 0-3 3V11a3 3 0 0 1 3-3Z" />
        <path d="M7 35a3 3 0 0 1 3-3h21" />
        <line x1="14" y1="16" x2="27" y2="16" />
        <line x1="14" y1="22" x2="27" y2="22" />
      </svg>
    ) : (
      <svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6">
        <rect x="8" y="6" width="32" height="36" rx="2" />
        <line x1="15" y1="16" x2="33" y2="16" />
        <line x1="15" y1="23" x2="33" y2="23" />
        <line x1="15" y1="30" x2="26" y2="30" />
      </svg>
    )}
  </div>
);
