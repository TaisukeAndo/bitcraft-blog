# Workerスクリプト本体（apps/web・apps/api・apps/mcp）はTerraformでは作成しない。
# CI（.github/workflows/deploy.yml）から `wrangler deploy` で作成・更新する
# （bitcraft-siteと同じ役割分担: Terraformはインフラ、wranglerはコードのデプロイ）。
#
# bitcraft-siteのworkers.tfとの違い: 本体サイトは Custom Domain 接続を
# enable_custom_domains フラグでGitHub Pagesの本番トラフィックを壊さないよう
# 段階的に有効化しているが、blog.bitcraft.work 配下は空きサブドメインのため
# その配慮が不要。count条件なしで最初からCustom Domainを作成する。
resource "cloudflare_workers_custom_domain" "web" {
  account_id = var.account_id
  hostname   = "blog.${var.zone_name}"
  service    = "bitcraft-blog-web"
  zone_id    = local.zone_id
}

resource "cloudflare_workers_custom_domain" "api" {
  account_id = var.account_id
  hostname   = "blog-api.${var.zone_name}"
  service    = "bitcraft-blog-api"
  zone_id    = local.zone_id
}

resource "cloudflare_workers_custom_domain" "mcp" {
  account_id = var.account_id
  hostname   = "blog-mcp.${var.zone_name}"
  service    = "bitcraft-blog-mcp"
  zone_id    = local.zone_id
}
