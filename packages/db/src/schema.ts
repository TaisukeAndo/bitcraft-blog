import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

// 日時は全てTEXT(ISO 8601)、真偽値はINTEGER(0/1、drizzleのboolean modeで表現)。
// D1/SQLiteの慣習に合わせる（実装プラン2章）。カラム名はsnake_case、TS側はcamelCase。

export const posts = sqliteTable(
  "posts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    // 原本（Source of Truth）。編集は常にこのMarkdownに対して行う。
    bodyMd: text("body_md").notNull(),
    // 書き込み時（apps/api）に事前レンダリングしたHTML。apps/webはこれをSELECTするだけ。
    bodyHtml: text("body_html"),
    // [{depth, text, id}] 形式のJSON文字列。
    tocJson: text("toc_json"),
    readingTimeMin: integer("reading_time_min"),
    status: text("status", { enum: ["draft", "published", "archived"] })
      .notNull()
      .default("draft"),
    publishedAt: text("published_at"),
    authorName: text("author_name").notNull().default("bitcraft 安藤太亮"),
    ogImageKey: text("og_image_key"),
    metaDescription: text("meta_description").notNull(),
    metaKeywords: text("meta_keywords"),
    // note併載時など、正規URLを自己canonical以外に上書きしたい場合に使う。
    canonicalUrl: text("canonical_url"),
    noindex: integer("noindex", { mode: "boolean" }).notNull().default(false),
    // Zenn風の「ハート」ボタンのいいね数（ユーザー指示により2026-09-04追加）。
    // アカウント機能が無いため訪問者単位の重複防止はブラウザのlocalStorage側で行う
    // （apps/web/public/js/article-actions.js参照）。0未満にはならない
    // （CHECK制約、下記likeCountNonnegative）。
    likeCount: integer("like_count").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => ({
    slugUnique: unique("posts_slug_unique").on(table.slug),
    likeCountNonnegative: check("posts_like_count_nonnegative", sql`${table.likeCount} >= 0`),
    statusIdx: index("posts_status_idx").on(table.status),
    publishedAtIdx: index("posts_published_at_idx").on(table.publishedAt),
    slugFormat: check("posts_slug_format", sql`${table.slug} glob '[a-z0-9-]*'`),
  }),
);

export const tags = sqliteTable(
  "tags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => ({ slugUnique: unique("tags_slug_unique").on(table.slug) }),
);

export const postTags = sqliteTable(
  "post_tags",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.postId, table.tagId] }),
    tagIdIdx: index("post_tags_tag_id_idx").on(table.tagId),
  }),
);

export const books = sqliteTable(
  "books",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    coverImageKey: text("cover_image_key"),
    status: text("status", { enum: ["draft", "published", "archived"] })
      .notNull()
      .default("draft"),
    // 0=無料。将来の想定価格を今から保持する（決済は未接続、実装プラン2章）。
    priceYen: integer("price_yen").notNull().default(0),
    pricingModel: text("pricing_model", { enum: ["free", "paid_planned"] })
      .notNull()
      .default("free"),
    // Phase4（決済連携、スコープ外）の予約列。今は書き込まない。
    stripeProductId: text("stripe_product_id"),
    stripePriceId: text("stripe_price_id"),
    metaDescription: text("meta_description").notNull(),
    metaKeywords: text("meta_keywords"),
    ogImageKey: text("og_image_key"),
    publishedAt: text("published_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => ({
    slugUnique: unique("books_slug_unique").on(table.slug),
    statusIdx: index("books_status_idx").on(table.status),
    slugFormat: check("books_slug_format", sql`${table.slug} glob '[a-z0-9-]*'`),
    priceYenNonnegative: check("books_price_yen_nonnegative", sql`${table.priceYen} >= 0`),
  }),
);

export const bookChapters = sqliteTable(
  "book_chapters",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    // 目次順・prev/next算出に使う連番（1始まり）。
    chapterNumber: integer("chapter_number").notNull(),
    title: text("title").notNull(),
    bodyMd: text("body_md").notNull(),
    bodyHtml: text("body_html"),
    tocJson: text("toc_json"),
    readingTimeMin: integer("reading_time_min"),
    // trueなら books.priceYen > 0 でも常に閲覧可（Zenn Bookの無料公開チャプター相当）。
    isFreePreview: integer("is_free_preview", { mode: "boolean" }).notNull().default(false),
    status: text("status", { enum: ["draft", "published"] })
      .notNull()
      .default("draft"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => ({
    bookSlugUnique: unique("book_chapters_book_slug_unique").on(table.bookId, table.slug),
    bookNumberUnique: unique("book_chapters_book_number_unique").on(table.bookId, table.chapterNumber),
    statusIdx: index("book_chapters_status_idx").on(table.status),
  }),
);

export const media = sqliteTable(
  "media",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    r2Key: text("r2_key").notNull(),
    ownerType: text("owner_type", { enum: ["post", "chapter", "book", "og", "misc"] }).notNull(),
    ownerSlug: text("owner_slug"),
    purpose: text("purpose"),
    contentType: text("content_type").notNull(),
    // CLS対策で <img width height> を出すために保持する（実装プラン8章）。
    sizeBytes: integer("size_bytes"),
    width: integer("width"),
    height: integer("height"),
    altText: text("alt_text"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => ({
    r2KeyUnique: unique("media_r2_key_unique").on(table.r2Key),
    ownerIdx: index("media_owner_idx").on(table.ownerType, table.ownerSlug),
  }),
);

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    label: text("label").notNull(),
    // 生トークンは保存しない。SHA-256ハッシュのみ照合に使う。
    keyHash: text("key_hash").notNull(),
    // 一覧表示用（例: bcblog_ab12）。
    keyPrefix: text("key_prefix").notNull(),
    // 将来の権限分割用の予約列。現状は "full" のみ発行する。
    scopes: text("scopes").notNull().default("full"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    lastUsedAt: text("last_used_at"),
    // NULL = 有効。
    revokedAt: text("revoked_at"),
  },
  (table) => ({ keyHashUnique: unique("api_keys_key_hash_unique").on(table.keyHash) }),
);
