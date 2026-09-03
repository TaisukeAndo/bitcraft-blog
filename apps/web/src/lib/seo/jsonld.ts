// BlogPosting/Book/BreadcrumbList/WebSite+SearchAction のJSON-LD生成関数（実装プラン7章）。
// 返り値はscript type="application/ld+json"にそのままJSON.stringifyして埋め込む
// プレーンオブジェクト。ここでは組み立てのみ行い、描画はcomponents/layout.tsxが担う。
import { SITE_NAME, SITE_ORIGIN } from "./meta";

export interface BreadcrumbItem {
  name: string;
  path: string; // "/" から始まるルート相対パス
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_ORIGIN}${item.path}`,
    })),
  };
}

export function webSiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_ORIGIN,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_ORIGIN}/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export interface BlogPostingInput {
  title: string;
  description: string;
  canonicalPath: string;
  publishedAt: string | null;
  updatedAt: string;
  authorName: string;
  image?: string | null;
  tagNames?: string[];
}

export function blogPostingJsonLd(input: BlogPostingInput): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.title,
    description: input.description,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_ORIGIN}${input.canonicalPath}`,
    },
    datePublished: input.publishedAt ?? undefined,
    dateModified: input.updatedAt,
    author: { "@type": "Person", name: input.authorName },
    publisher: { "@type": "Organization", name: SITE_NAME },
    image: input.image ?? undefined,
    keywords: input.tagNames && input.tagNames.length > 0 ? input.tagNames.join(",") : undefined,
  };
}

export interface BookJsonLdChapter {
  title: string;
  path: string;
  position: number;
}

export interface BookJsonLdInput {
  title: string;
  summary: string;
  canonicalPath: string;
  image?: string | null;
  priceYen: number;
  pricingModel: "free" | "paid_planned";
  chapters: BookJsonLdChapter[];
}

export function bookJsonLd(input: BookJsonLdInput): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Book",
    name: input.title,
    description: input.summary,
    url: `${SITE_ORIGIN}${input.canonicalPath}`,
    image: input.image ?? undefined,
    author: { "@type": "Person", name: "bitcraft 安藤太亮" },
    // priceYen>0 でも決済ゲートは未接続のため、実際に課金が発生するわけではない
    // （実装プラン2章）。offersはpricingModelがfreeの場合のみ0円で出す。
    offers:
      input.pricingModel === "free"
        ? { "@type": "Offer", price: "0", priceCurrency: "JPY" }
        : undefined,
    hasPart: input.chapters.map((chapter) => ({
      "@type": "CreativeWork",
      position: chapter.position,
      name: chapter.title,
      url: `${SITE_ORIGIN}${chapter.path}`,
    })),
  };
}
