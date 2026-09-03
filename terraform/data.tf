# bitcraft.work は既にCloudflareゾーンとして存在する（本体サイト bitcraft-site 用に
# 稼働中。Email Routing による MXレコード・SPF/Google認証用TXTレコードなども
# 既に稼働しているため、ゾーン自体をTerraformで作成・削除の対象にはしない）。
data "cloudflare_zones" "bitcraft" {
  name = var.zone_name
}

locals {
  zone_id = data.cloudflare_zones.bitcraft.result[0].id
}
