import type { FC, PropsWithChildren } from "hono/jsx";
import type { JSX } from "hono/jsx/jsx-runtime";
import { html } from "hono/html";

// wrangler.jsonc の Text moduleルールにより、以下はCSSファイルの中身をそのまま
// 文字列としてimportする（ビルド不要でCSSを配信する方針。実装プラン6章）。
import tokensCss from "../styles/tokens.css";
import baseCss from "../styles/base.css";
import layoutCss from "../styles/layout.css";
import proseCss from "../styles/prose.css";
import cardCss from "../styles/components/card.css";
import tagCss from "../styles/components/tag.css";
import tocCss from "../styles/components/toc.css";
import bookSidebarCss from "../styles/components/book-sidebar.css";
import adSlotCss from "../styles/components/ad-slot.css";
import codeBlockCss from "../styles/components/code-block.css";
import videoEmbedCss from "../styles/components/video-embed.css";

import { buildMetaTags, buildCanonicalUrl, SITE_NAME } from "../lib/seo/meta";
import { Header } from "./header";
import { Footer } from "./footer";

const ALL_CSS = [
  tokensCss,
  baseCss,
  layoutCss,
  proseCss,
  cardCss,
  tagCss,
  tocCss,
  bookSidebarCss,
  adSlotCss,
  codeBlockCss,
  videoEmbedCss,
].join("\n");

export type LayoutProps = PropsWithChildren<{
  title: string;
  description: string;
  keywords?: string | null;
  canonicalPath: string;
  // note併載時など、外部の絶対URLをcanonicalとして使いたい場合に指定する
  // （実装プラン7章。lib/seo/meta.tsのSeoMetaInput.canonicalUrlOverrideと同じ役割）。
  canonicalUrlOverride?: string | null;
  ogType?: "website" | "article";
  ogImage?: string | null;
  noindex?: boolean;
  jsonLd?: Record<string, unknown>[];
  adsenseClientId?: string;
  // ホームの検索結果表示時のみ、ヘッダー検索欄にキーワードを復元するために使う
  // （components/header.tsxのHeaderProps参照）。
  searchQuery?: string;
}>;

// 全ページ共通のHTML骨格。<style>への直inline配信・OGP/JSON-LD・広告/動画埋め込み用
// クライアントスクリプトの読み込みをここに集約する（実装プラン6〜8章）。
export const Layout: FC<LayoutProps> = ({
  title,
  description,
  keywords,
  canonicalPath,
  canonicalUrlOverride,
  ogType = "website",
  ogImage,
  noindex = false,
  jsonLd = [],
  adsenseClientId,
  searchQuery,
  children,
}) => {
  const canonicalUrl = canonicalUrlOverride ?? buildCanonicalUrl(canonicalPath);
  const metaTags = buildMetaTags({
    title,
    description,
    keywords,
    canonicalPath,
    canonicalUrlOverride,
    ogType,
    ogImage,
    noindex,
  });
  const fullTitle = title.endsWith(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;

  return (
    <html lang="ja">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        {metaTags.map((tag) =>
          tag.property ? (
            <meta property={tag.property} content={tag.content} />
          ) : (
            <meta name={tag.name} content={tag.content} />
          ),
        )}
        <link rel="canonical" href={canonicalUrl} />
        <link rel="alternate" type="application/rss+xml" title={SITE_NAME} href="/rss.xml" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/favicon.png" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@500;700;900&family=Noto+Sans+JP:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap"
        />

        <title>{fullTitle}</title>

        {jsonLd.map((data) => (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
          />
        ))}

        <style dangerouslySetInnerHTML={{ __html: ALL_CSS }} />
      </head>
      <body>
        <Header searchQuery={searchQuery} />
        {children}
        <Footer />

        <script src="/js/video-embed.js" defer></script>
        <script src="/js/code-block.js" defer></script>
        <script src="/js/toc-scrollspy.js" defer></script>
        {adsenseClientId ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `window.__ADSENSE_CLIENT_ID=${JSON.stringify(adsenseClientId)};`,
            }}
          />
        ) : null}
        {adsenseClientId ? <script src="/js/ads.js" defer></script> : null}
      </body>
    </html>
  );
};

// c.html(<Layout>...</Layout>) は "<!DOCTYPE html>" を出力せずquirksモードでの描画に
// なるため、必ずこのrenderPage()経由でDOCTYPEを明示する（bitcraft-siteで踏んだ不具合と
// 同種の落とし穴を避ける）。
export function renderPage(jsx: JSX.Element) {
  return html`<!DOCTYPE html>${jsx}`;
}
