import type { FC } from "hono/jsx";

export const Footer: FC = () => {
  const year = new Date().getFullYear();
  return (
    <footer class="site-footer">
      <div class="site-footer__inner">
        <span>© {year} bitcraft 安藤太亮</span>
        <div class="site-footer__links">
          <a href="/rss.xml">RSS</a>
          <a href="/sitemap.xml">サイトマップ</a>
          <a href="https://bitcraft.work" target="_blank" rel="noopener noreferrer">
            bitcraft.work
          </a>
        </div>
      </div>
    </footer>
  );
};
