export type Bindings = {
  DB: D1Database;
  MEDIA: R2Bucket;
  // 「いいね」ボタン（POST /posts/:slug/like・/unlike）をapps/apiへ委譲するための
  // Service Binding（実装プラン9章、apps/mcpと同じ委譲パターン。ユーザー指示により
  // 2026-09-04追加）。ローカルのDocker Compose環境ではAPI_BASE_URLへフォールバックする
  // （lib/api-client.ts参照）。
  API?: Fetcher;
  API_BASE_URL?: string;
  // AdSense本番導入までの環境変数（実装プラン8章）。未設定時は広告スクリプトを一切出さない。
  ADSENSE_CLIENT_ID?: string;
};
