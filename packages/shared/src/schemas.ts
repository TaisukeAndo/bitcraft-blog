// apps/api専用のzod v3スキーマ（バリデーション + @hono/zod-openapiのルート定義に使う）。
// apps/mcpはzod v4を使うため、これらのインスタンスは共有できない
// （実装プラン4章・constants.tsのコメント参照）。apps/mcp側は同じ制約を
// zod v4で再定義し、SLUG_PATTERN等のプレーンな値だけをここから間接的に揃える。
import { z } from "zod";
import {
  BOOK_STATUSES,
  CHAPTER_STATUSES,
  MAX_EXCERPT_LENGTH,
  MAX_META_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  MEDIA_OWNER_TYPES,
  POST_STATUSES,
  PRICING_MODELS,
  SLUG_DESCRIPTION,
  SLUG_PATTERN,
} from "./constants";

export const slugSchema = z.string().min(1).max(100).regex(SLUG_PATTERN, SLUG_DESCRIPTION);

// ---- Post ----

export const postCreateSchema = z.object({
  slug: slugSchema,
  title: z.string().min(1).max(MAX_TITLE_LENGTH),
  excerpt: z.string().max(MAX_EXCERPT_LENGTH).optional(),
  bodyMd: z.string().min(1),
  status: z.enum(POST_STATUSES).optional(),
  authorName: z.string().min(1).optional(),
  ogImageKey: z.string().optional(),
  metaDescription: z.string().min(1).max(MAX_META_DESCRIPTION_LENGTH),
  metaKeywords: z.string().optional(),
  canonicalUrl: z.string().url().optional(),
  noindex: z.boolean().optional(),
  tagSlugs: z.array(slugSchema).optional(),
});
export type PostCreateInput = z.infer<typeof postCreateSchema>;

export const postUpdateSchema = postCreateSchema
  .omit({ slug: true })
  .partial();
export type PostUpdateInput = z.infer<typeof postUpdateSchema>;

export const postListQuerySchema = z.object({
  status: z.enum(POST_STATUSES).optional(),
  tag: slugSchema.optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// ---- Tag ----

export const tagCreateSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(MAX_TITLE_LENGTH),
  description: z.string().optional(),
});
export type TagCreateInput = z.infer<typeof tagCreateSchema>;

export const tagUpdateSchema = tagCreateSchema.omit({ slug: true }).partial();
export type TagUpdateInput = z.infer<typeof tagUpdateSchema>;

// ---- Book ----

export const bookCreateSchema = z.object({
  slug: slugSchema,
  title: z.string().min(1).max(MAX_TITLE_LENGTH),
  summary: z.string().min(1),
  coverImageKey: z.string().optional(),
  status: z.enum(BOOK_STATUSES).optional(),
  priceYen: z.number().int().nonnegative().optional(),
  pricingModel: z.enum(PRICING_MODELS).optional(),
  metaDescription: z.string().min(1).max(MAX_META_DESCRIPTION_LENGTH),
  metaKeywords: z.string().optional(),
  ogImageKey: z.string().optional(),
});
export type BookCreateInput = z.infer<typeof bookCreateSchema>;

export const bookUpdateSchema = bookCreateSchema.omit({ slug: true }).partial();
export type BookUpdateInput = z.infer<typeof bookUpdateSchema>;

// ---- BookChapter ----

export const chapterCreateSchema = z.object({
  slug: slugSchema,
  chapterNumber: z.number().int().positive(),
  title: z.string().min(1).max(MAX_TITLE_LENGTH),
  bodyMd: z.string().min(1),
  isFreePreview: z.boolean().optional(),
  status: z.enum(CHAPTER_STATUSES).optional(),
});
export type ChapterCreateInput = z.infer<typeof chapterCreateSchema>;

export const chapterUpdateSchema = chapterCreateSchema.omit({ slug: true }).partial();
export type ChapterUpdateInput = z.infer<typeof chapterUpdateSchema>;

export const chapterReorderSchema = z.object({
  order: z
    .array(z.object({ slug: slugSchema, chapterNumber: z.number().int().positive() }))
    .min(1),
});
export type ChapterReorderInput = z.infer<typeof chapterReorderSchema>;

// ---- Media ----

export const mediaListQuerySchema = z.object({
  ownerType: z.enum(MEDIA_OWNER_TYPES).optional(),
  ownerSlug: z.string().optional(),
});

export const mediaUploadSchema = z.object({
  dataBase64: z.string().min(1),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  ownerType: z.enum(MEDIA_OWNER_TYPES).optional(),
  ownerSlug: z.string().optional(),
  purpose: z.string().optional(),
  altText: z.string().optional(),
});
export type MediaUploadInput = z.infer<typeof mediaUploadSchema>;

// ---- API Key ----

export const apiKeyCreateSchema = z.object({
  label: z.string().min(1).max(MAX_TITLE_LENGTH),
});
export type ApiKeyCreateInput = z.infer<typeof apiKeyCreateSchema>;
