import type {
  BOOK_STATUSES,
  CHAPTER_STATUSES,
  MEDIA_OWNER_TYPES,
  POST_STATUSES,
  PRICING_MODELS,
} from "./constants";

export type PostStatus = (typeof POST_STATUSES)[number];
export type BookStatus = (typeof BOOK_STATUSES)[number];
export type ChapterStatus = (typeof CHAPTER_STATUSES)[number];
export type PricingModel = (typeof PRICING_MODELS)[number];
export type MediaOwnerType = (typeof MEDIA_OWNER_TYPES)[number];

/** 目次の1エントリ。rehype-slugで採番した見出しidとの対応を持つ。 */
export interface TocEntry {
  depth: number;
  text: string;
  id: string;
}

/** packages/shared/markdown の renderMarkdown() が返す、書き込み時レンダリング結果。 */
export interface RenderedMarkdown {
  html: string;
  toc: TocEntry[];
  readingTimeMin: number;
}

export interface Post {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  bodyMd: string;
  bodyHtml: string | null;
  toc: TocEntry[];
  readingTimeMin: number | null;
  status: PostStatus;
  publishedAt: string | null;
  authorName: string;
  ogImageKey: string | null;
  metaDescription: string;
  metaKeywords: string | null;
  canonicalUrl: string | null;
  noindex: boolean;
  likeCount: number;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface Book {
  id: number;
  slug: string;
  title: string;
  summary: string;
  coverImageKey: string | null;
  status: BookStatus;
  priceYen: number;
  pricingModel: PricingModel;
  metaDescription: string;
  metaKeywords: string | null;
  ogImageKey: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BookChapter {
  id: number;
  bookId: number;
  slug: string;
  chapterNumber: number;
  title: string;
  bodyMd: string;
  bodyHtml: string | null;
  toc: TocEntry[];
  readingTimeMin: number | null;
  isFreePreview: boolean;
  status: ChapterStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Media {
  id: number;
  r2Key: string;
  ownerType: MediaOwnerType;
  ownerSlug: string | null;
  purpose: string | null;
  contentType: string;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  altText: string | null;
  createdAt: string;
}

export interface ApiKeySummary {
  id: number;
  label: string;
  keyPrefix: string;
  scopes: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/** apps/api全体で統一するエラーレスポンス形式（実装プラン3章）。 */
export interface ApiErrorBody {
  error: {
    code:
      | "VALIDATION_ERROR"
      | "UNAUTHENTICATED"
      | "NOT_FOUND"
      | "SLUG_CONFLICT"
      | "INTERNAL_ERROR";
    message: string;
    details?: unknown;
  };
}
