// apps/api の Cloudflare Workers バインディング型。D1(DB)とR2(MEDIA)のみを持つ
// （apps/mcpと異なり、apps/apiはこれらに直接読み書きする唯一のアプリ。実装プラン3章・4章）。
export interface Bindings {
  DB: D1Database;
  MEDIA: R2Bucket;
}
