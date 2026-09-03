# bitcraft-blog

`blog.bitcraft.work` — bitcraft（安藤太亮）が運営する、AIを学ぶ人のためのMarkdown CMS型ブログ。
SEO・Google広告（AdSense）掲載・Zenn Bookのような長編コンテンツ（Book）機能を持つ。
運用はWeb管理画面を作らず、Claude（MCP経由）での「Markdown下書き→承認→反映」に一本化している。

bitcraft公式サイト `bitcraft.work`（姉妹リポジトリ [`TaisukeAndo/bitcraft-site`](https://github.com/TaisukeAndo/bitcraft-site)、
public）と同じ設計思想・技術選定を踏襲した独立リポジトリ。`bitcraft-site`本体には手を入れず、
Cloudflareリソース・Terraform state・GitHub Secretsもすべて分離している。

## アーキテクチャ

pnpmモノレポ、Cloudflare Workers 3本構成。

```
apps/
├── web/   # Hono。D1へSELECT専用。記事・Book公開ページの描画（sitemap/robots/OGP/JSON-LD含む）
├── api/   # Hono + @hono/zod-openapi。書き込み・D1マイグレーションはここのみが担当
└── mcp/   # agents(createMcpHandler)。Claudeからのpost/tag/book/chapter/media操作の窓口
packages/
├── db/       # drizzle schema・migrations（@bitcraft/blog-db）
├── shared/   # zodスキーマ・型・Markdownレンダリングパイプライン（@bitcraft/blog-shared）
└── config/   # tsconfig/eslint共有設定（@bitcraft/blog-config）
terraform/    # D1・R2・Custom DomainのIaC（terraform/README.md参照）
docker/       # ローカル開発用（docker/README.md参照。本番はwrangler deployのエッジデプロイ）
```

- `apps/web` はD1に対して読み取り専用。記事の作成・更新・公開は `apps/api` 経由のみ
  （書き込み経路を1箇所に絞ることで、Markdown→HTML変換やバリデーションの実装が分散しない）。
- `apps/mcp` はD1・R2に直接触れず、`apps/api` をService Binding（本番）/ HTTPフォールバック
  （ローカル、`docker/README.md`参照）経由で呼ぶだけの薄いラッパー。Claude Code /
  Claude.aiのカスタムコネクタから接続し、記事・Book・チャプター・メディアをMCPツール経由で操作する。

## ローカル開発

### Docker Compose を使う場合（推奨。環境差異を気にせず動かせる）

```bash
docker compose -f docker/docker-compose.yml up
```

詳細・環境変数の意味は [`docker/README.md`](docker/README.md) を参照。

### ホストで直接動かす場合

```bash
pnpm install
pnpm dev:api   # apps/api を起動（:8788）
pnpm dev:web   # apps/web を起動（:8787）
pnpm dev:mcp   # apps/mcp を起動（:8789）
```

Service Binding（`apps/web`・`apps/mcp` → `apps/api`）は `wrangler dev` 同士がローカルで
起動していれば解決される。

## デプロイ

`main` ブランチへのマージ（squash merge運用）で `.github/workflows/deploy.yml` が自動実行される。

1. `terraform/**` に変更があれば `terraform apply`（インフラ更新）
2. `wrangler d1 migrations apply bitcraft-blog --remote`（スキーマ反映）
3. `wrangler deploy` を `apps/api` → `apps/mcp` → `apps/web` の順で実行
4. スモークテスト（`/v1/health`・`web /`・`mcp /mcp` の401確認）

PR作成時は `.github/workflows/ci.yml`（lint/typecheck/test/dry-run deploy）と、
`terraform/**` を変更したPRでは `.github/workflows/terraform-plan.yml`（`terraform plan`）も走る。

失敗時の自動ロールバックは無く、`wrangler rollback` で手動復旧する運用（`bitcraft-site`と同じ方針）。

### 必要なGitHub Secrets

| Secret | 用途 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Workers/D1/R2の作成・デプロイ権限を持つアカウント全体トークン |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflareアカウント ID |
| `TF_STATE_R2_ACCESS_KEY_ID` | Terraform state用R2バケット（`bitcraft-blog-tfstate`）限定のS3互換トークン |
| `TF_STATE_R2_SECRET_ACCESS_KEY` | 同上のシークレット |

## 初回セットアップ・チェックリスト

新規にこのリポジトリからインフラを立ち上げる場合の流れ。詳細手順は
[`terraform/README.md`](terraform/README.md) を参照。

1. `wrangler r2 bucket create bitcraft-blog-tfstate`（state置き場を手動作成、一度だけ）
2. `bitcraft-blog-tfstate` バケット限定のR2用S3互換APIトークンを発行
3. 上記4つのGitHub Secretsをリポジトリに登録
4. `terraform/backend.tf` の `<account-hash>` を自分のアカウントのR2エンドポイントに書き換え
5. `cd terraform && terraform init && terraform apply` でD1・R2・Custom Domainを作成
6. `terraform output` で得た `d1_database_id` 等を `apps/api`・`apps/web` の
   `wrangler.jsonc` に転記
7. `main` へのマージでCI/CDが動くことを確認
