// OGP/Twitter Card/canonical/noindexのmetaタグ生成ヘルパー（実装プラン7章）。
// 値の組み立てだけを担い、実際のJSX描画はcomponents/layout.tsxが行う
// （データ生成とマークアップを分離し、単体で確認しやすくするため）。

export const SITE_ORIGIN = "https://blog.bitcraft.work";
export const SITE_NAME = "bitcraft blog";

export interface MetaTag {
  name?: string;
  property?: string;
  content: string;
}

export interface SeoMetaInput {
  title: string;
  description: string;
  keywords?: string | null;
  canonicalPath: string; // 例: "/posts/my-first-post/"
  // note併載時など、posts.canonicalUrlに外部の絶対URLが設定されている場合に使う
  // （実装プラン7章）。指定時は canonicalPath から組み立てた自サイトURLではなく、
  // このURLをog:url・<link rel="canonical">の両方にそのまま使う。
  canonicalUrlOverride?: string | null;
  ogType?: "website" | "article";
  ogImage?: string | null; // 絶対URL。未指定ならog:imageを出さない
  noindex?: boolean;
}

export function buildCanonicalUrl(canonicalPath: string): string {
  return `${SITE_ORIGIN}${canonicalPath}`;
}

export function buildMetaTags(input: SeoMetaInput): MetaTag[] {
  const canonicalUrl = input.canonicalUrlOverride ?? buildCanonicalUrl(input.canonicalPath);
  const tags: MetaTag[] = [
    { name: "description", content: input.description },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:type", content: input.ogType ?? "website" },
    { property: "og:title", content: input.title },
    { property: "og:description", content: input.description },
    { property: "og:url", content: canonicalUrl },
  ];

  if (input.ogImage) {
    tags.push({ property: "og:image", content: input.ogImage });
    tags.push({ name: "twitter:card", content: "summary_large_image" });
  } else {
    tags.push({ name: "twitter:card", content: "summary" });
  }

  if (input.keywords) {
    tags.push({ name: "keywords", content: input.keywords });
  }

  // 既定はindex許可。posts.noindexや、bodyHtml未レンダリングの防御的フォールバック
  // 表示時にtrueを渡す（実装プラン7章・防御的取り扱いの方針）。
  tags.push({
    name: "robots",
    content: input.noindex ? "noindex,nofollow" : "index,follow",
  });

  return tags;
}
