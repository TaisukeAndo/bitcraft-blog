// apps/api（zod v3）とapps/mcp（zod v4）はメジャーバージョンが異なるzodを使うため、
// スキーマのインスタンスそのものは共有できない（実装プラン4章。bitcraft-siteの
// apps/mcp/src/tools/*.tsも同じ理由でzod v4形状を再定義している）。
// バリデーションの「ルール」自体（正規表現・文字数上限など）はzodに依存しないプレーンな
// 値としてここに集約し、api側・mcp側それぞれのzodスキーマから参照することで
// ルールの重複記述だけは避ける。

export const SLUG_PATTERN = /^[a-z0-9-]+$/;
export const SLUG_DESCRIPTION = "slugは英小文字・数字・ハイフンのみ使用できます";

export const POST_STATUSES = ["draft", "published", "archived"] as const;
export const BOOK_STATUSES = ["draft", "published", "archived"] as const;
export const CHAPTER_STATUSES = ["draft", "published"] as const;
export const PRICING_MODELS = ["free", "paid_planned"] as const;
export const MEDIA_OWNER_TYPES = ["post", "chapter", "book", "og", "misc"] as const;
export const API_KEY_SCOPES = ["full"] as const;

export const MAX_TITLE_LENGTH = 200;
export const MAX_META_DESCRIPTION_LENGTH = 160;
export const MAX_EXCERPT_LENGTH = 400;

// 読了時間の目安計算に使う、日本語1分あたりの想定文字数。
export const JAPANESE_CHARS_PER_MINUTE = 500;
