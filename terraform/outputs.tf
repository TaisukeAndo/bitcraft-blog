output "zone_id" {
  value       = local.zone_id
  description = "bitcraft.work ゾーンID"
}

output "d1_database_id" {
  value       = cloudflare_d1_database.blog.id
  description = "apps/api・apps/web の wrangler.jsonc の d1_databases[].database_id に転記する"
}

output "d1_database_name" {
  value       = cloudflare_d1_database.blog.name
  description = "apps/api・apps/web の wrangler.jsonc の d1_databases[].database_name に転記する"
}

output "r2_bucket_name" {
  value       = cloudflare_r2_bucket.media.name
  description = "apps/api の wrangler.jsonc の r2_buckets[].bucket_name に転記する"
}

output "custom_domain_web" {
  value       = cloudflare_workers_custom_domain.web.hostname
  description = "apps/web に接続されたCustom Domain"
}

output "custom_domain_api" {
  value       = cloudflare_workers_custom_domain.api.hostname
  description = "apps/api に接続されたCustom Domain"
}

output "custom_domain_mcp" {
  value       = cloudflare_workers_custom_domain.mcp.hostname
  description = "apps/mcp に接続されたCustom Domain"
}
