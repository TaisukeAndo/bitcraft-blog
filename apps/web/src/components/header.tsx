import type { FC } from "hono/jsx";

export interface HeaderProps {
  // /page-header (旧pages/home.tsx) にあった検索フォームをヘッダーへ集約した
  // （ユーザー指示により2026-09-04変更）。全ページから検索でき、検索結果一覧
  // （GET /?q=...）は常にトップページが担当する。ホーム画面表示時のみ、
  // 検索中のキーワードを入力欄に復元するためこのpropを使う。
  searchQuery?: string;
}

export const Header: FC<HeaderProps> = ({ searchQuery }) => {
  return (
    <header class="site-header">
      <div class="site-header__inner">
        <a class="site-header__logo" href="/">
          bitcraft blog
        </a>
        <form class="site-header__search" method="get" action="/">
          <input
            type="search"
            name="q"
            value={searchQuery ?? ""}
            placeholder="記事を検索"
            aria-label="記事を検索"
          />
          <button type="submit" aria-label="検索する">
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="2" />
              <line x1="13.2" y1="13.2" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        </form>
        <nav class="site-header__nav">
          <a href="/">記事一覧</a>
          <a href="/books">Book</a>
          <a href="https://bitcraft.work" target="_blank" rel="noopener noreferrer">
            bitcraft.work
          </a>
        </nav>
      </div>
    </header>
  );
};
