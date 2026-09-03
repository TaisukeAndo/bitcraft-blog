PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`excerpt` text,
	`body_md` text NOT NULL,
	`body_html` text,
	`toc_json` text,
	`reading_time_min` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` text,
	`author_name` text DEFAULT 'bitcraft 安藤太亮' NOT NULL,
	`og_image_key` text,
	`meta_description` text NOT NULL,
	`meta_keywords` text,
	`canonical_url` text,
	`noindex` integer DEFAULT false NOT NULL,
	`like_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	CONSTRAINT "posts_like_count_nonnegative" CHECK("__new_posts"."like_count" >= 0),
	CONSTRAINT "posts_slug_format" CHECK("__new_posts"."slug" glob '[a-z0-9-]*')
);
--> statement-breakpoint
-- 注意: drizzle-kit generateが出力したINSERT文は、旧postsテーブルにまだ存在しない
-- like_countを誤ってSELECT対象に含めていたため手動修正した（実行するとSQLITE_ERROR:
-- no such column: like_count になる）。like_countをINSERT対象から除外することで、
-- 新テーブル側のDEFAULT 0が既存行に適用される。
INSERT INTO `__new_posts`("id", "slug", "title", "excerpt", "body_md", "body_html", "toc_json", "reading_time_min", "status", "published_at", "author_name", "og_image_key", "meta_description", "meta_keywords", "canonical_url", "noindex", "created_at", "updated_at") SELECT "id", "slug", "title", "excerpt", "body_md", "body_html", "toc_json", "reading_time_min", "status", "published_at", "author_name", "og_image_key", "meta_description", "meta_keywords", "canonical_url", "noindex", "created_at", "updated_at" FROM `posts`;--> statement-breakpoint
DROP TABLE `posts`;--> statement-breakpoint
ALTER TABLE `__new_posts` RENAME TO `posts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `posts_status_idx` ON `posts` (`status`);--> statement-breakpoint
CREATE INDEX `posts_published_at_idx` ON `posts` (`published_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `posts_slug_unique` ON `posts` (`slug`);