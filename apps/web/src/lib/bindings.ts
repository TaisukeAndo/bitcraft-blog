export type Bindings = {
  DB: D1Database;
  MEDIA: R2Bucket;
  // AdSense本番導入までの環境変数（実装プラン8章）。未設定時は広告スクリプトを一切出さない。
  ADSENSE_CLIENT_ID?: string;
};
