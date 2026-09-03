terraform {
  required_version = ">= 1.9"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.24"
    }
  }
}

provider "cloudflare" {
  # 認証は CLOUDFLARE_API_TOKEN 環境変数から自動的に読み込まれる。
  # bitcraft-site と同じ運用方針で、トークンをコードやtfvarsに直書きしない。
}
