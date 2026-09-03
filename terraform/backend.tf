# Terraform state backend: R2をS3互換バックエンドとして利用する。
#
# 前提（ブートストラップ手順、一度だけ手動で実行する。state保存場所をstate自身で
# 管理する鶏卵問題の回避）:
#   wrangler r2 bucket create bitcraft-blog-tfstate
#
# 本体サイト（bitcraft-site）が使う bitcraft-tfstate バケットとは意図的に分離している。
# 単一運用者であっても、ブログ用stateの誤操作が本体サイトのインフラに波及しないようにするため。
#
# 認証情報は R2 専用の S3 互換 APIトークン（bitcraft-blog-tfstate バケットのみに
# 限定した権限）を AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY として渡す
# （アカウント全体を操作できる CLOUDFLARE_API_TOKEN とは別物）。
#
# endpoints.s3 の <account-hash> は実在のアカウントハッシュではなくプレースホルダー。
# `terraform init` 実行前に、ご自身の Cloudflare アカウントの R2 S3互換エンドポイント
# （Cloudflareダッシュボード → R2 → 該当バケットの「S3 API」欄で確認できる）に
# 書き換えること。
terraform {
  backend "s3" {
    bucket = "bitcraft-blog-tfstate"
    key    = "production/terraform.tfstate"
    region = "auto"
    endpoints = {
      s3 = "https://<account-hash>.r2.cloudflarestorage.com"
    }
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
    use_path_style              = true
  }
}
