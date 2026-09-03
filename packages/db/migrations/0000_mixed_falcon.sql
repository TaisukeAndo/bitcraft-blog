CREATE TABLE `api_keys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`scopes` text DEFAULT 'full' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`last_used_at` text,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE TABLE `book_chapters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` integer NOT NULL,
	`slug` text NOT NULL,
	`chapter_number` integer NOT NULL,
	`title` text NOT NULL,
	`body_md` text NOT NULL,
	`body_html` text,
	`toc_json` text,
	`reading_time_min` integer,
	`is_free_preview` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `book_chapters_status_idx` ON `book_chapters` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `book_chapters_book_slug_unique` ON `book_chapters` (`book_id`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `book_chapters_book_number_unique` ON `book_chapters` (`book_id`,`chapter_number`);--> statement-breakpoint
CREATE TABLE `books` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`cover_image_key` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`price_yen` integer DEFAULT 0 NOT NULL,
	`pricing_model` text DEFAULT 'free' NOT NULL,
	`stripe_product_id` text,
	`stripe_price_id` text,
	`meta_description` text NOT NULL,
	`meta_keywords` text,
	`og_image_key` text,
	`published_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	CONSTRAINT "books_slug_format" CHECK("books"."slug" glob '[a-z0-9-]*'),
	CONSTRAINT "books_price_yen_nonnegative" CHECK("books"."price_yen" >= 0)
);
--> statement-breakpoint
CREATE INDEX `books_status_idx` ON `books` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `books_slug_unique` ON `books` (`slug`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`r2_key` text NOT NULL,
	`owner_type` text NOT NULL,
	`owner_slug` text,
	`purpose` text,
	`content_type` text NOT NULL,
	`size_bytes` integer,
	`width` integer,
	`height` integer,
	`alt_text` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `media_owner_idx` ON `media` (`owner_type`,`owner_slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `media_r2_key_unique` ON `media` (`r2_key`);--> statement-breakpoint
CREATE TABLE `post_tags` (
	`post_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`post_id`, `tag_id`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_tags_tag_id_idx` ON `post_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `posts` (
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
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	CONSTRAINT "posts_slug_format" CHECK("posts"."slug" glob '[a-z0-9-]*')
);
--> statement-breakpoint
CREATE INDEX `posts_status_idx` ON `posts` (`status`);--> statement-breakpoint
CREATE INDEX `posts_published_at_idx` ON `posts` (`published_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `posts_slug_unique` ON `posts` (`slug`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_slug_unique` ON `tags` (`slug`);