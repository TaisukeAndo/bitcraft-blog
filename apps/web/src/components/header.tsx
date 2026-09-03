import type { FC } from "hono/jsx";

export const Header: FC = () => {
  return (
    <header class="site-header">
      <div class="site-header__inner">
        <a class="site-header__logo" href="/">
          bitcraft blog
        </a>
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
