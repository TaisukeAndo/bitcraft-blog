resource "cloudflare_d1_database" "blog" {
  account_id            = var.account_id
  name                  = "bitcraft-blog"
  primary_location_hint = "apac"
  # read_replicationを明示しないと、Cloudflare API側の実値({mode="disabled"})と
  # Terraformの意図(未設定=null)がズレて apply のたびに400エラーになる
  # （bitcraft-cms databaseで実際に踏んだ不具合。bitcraft-siteのstorage.tfを踏襲）。
  read_replication = {
    mode = "disabled"
  }
}

resource "cloudflare_r2_bucket" "media" {
  account_id = var.account_id
  name       = "bitcraft-blog-media"
  location   = "apac"
}
