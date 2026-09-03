variable "account_id" {
  description = "Cloudflareアカウント ID"
  type        = string
}

variable "zone_name" {
  description = "対象ゾーン名"
  type        = string
  default     = "bitcraft.work"
}

# 注: bitcraft-site の enable_custom_domains のような段階フラグはここには置かない。
# blog.bitcraft.work 配下は今まで何も配信されていない空きサブドメインで、
# 本体サイト（GitHub Pages）のような既存本番トラフィックとの共存配慮が不要なため、
# Custom Domain は最初から作成する（workers.tf参照）。
