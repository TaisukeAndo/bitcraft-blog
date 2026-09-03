import type { FC } from "hono/jsx";

export interface ArticleActionsProps {
  slug: string;
  likeCount: number;
  shareUrl: string; // 絶対URL（X投稿インテント用）
  shareText: string; // 記事タイトル
}

// Zennのようにページ左側に固定表示する「ハート」ボタン＋Xシェアボタン
// （ユーザー指示により2026-09-04追加）。実際のカウント増減・トグル状態の保持は
// public/js/article-actions.jsが担当し、このコンポーネントは初期表示（サーバー側で
// 分かっているlikeCountの値）だけを描画する。アカウント機能が無いため「押した状態」は
// ブラウザのlocalStorageで管理する（同一ブラウザでの多重カウントを防ぐだけの簡易な仕組み）。
export const ArticleActions: FC<ArticleActionsProps> = ({ slug, likeCount, shareUrl, shareText }) => {
  const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;

  return (
    <aside class="article-actions">
      <button type="button" class="article-actions__like" data-like-button data-post-slug={slug} data-liked="false">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path
            d="M12 20.5s-7.5-4.6-10-9.2C.4 8 1.8 4.5 5.2 3.6c2-.5 4 .3 5.2 2 .3.4.9.4 1.2 0 1.2-1.7 3.2-2.5 5.2-2 3.4.9 4.8 4.4 3.2 7.7-2.5 4.6-10 9.2-10 9.2Z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linejoin="round"
          />
        </svg>
        <span class="article-actions__count" data-like-count>
          {likeCount}
        </span>
      </button>
      <a
        class="article-actions__share"
        href={tweetUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Xでポストする"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">
          <path d="M13.6 10.2 21 1.6h-1.8l-6.4 7.5-5.1-7.5H1l7.8 11.4L1 22.4h1.8l6.8-7.9 5.4 7.9H23l-8.1-12.2Zm-2.4 2.8-.8-1.1L3.7 3h2.7l5 7.2.8 1.1 6.6 9.5h-2.7l-5.3-7.6Z" />
        </svg>
      </a>
    </aside>
  );
};
