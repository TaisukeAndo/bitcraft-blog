# terraform/

`blog.bitcraft.work` のCloudflareインフラ（D1・R2・Custom Domain）をTerraformで管理する。
Workerスクリプト本体（apps/web・apps/api・apps/mcp）はここでは作らない。CI
（`.github/workflows/deploy.yml`）から `wrangler deploy` で作成・更新する。

姉妹サイト `bitcraft-site`（`bitcraft.work`本体、稼働中）の `terraform/` を雛形にしており、
`data.tf`・`storage.tf`・`workers.tf`・`backend.tf` の構造・記法はほぼそのまま踏襲している。
リソース名だけを本ブログ用（`bitcraft-blog-*`）に置き換え、Custom Domain作成を段階フラグなしで
最初から有効化している点が本体サイトとの違い（`variables.tf`のコメント参照）。

## 初回ブートストラップ手順

state（Terraformの管理台帳）自体をTerraformで作ろうとすると「stateの置き場をstateで管理する」
鶏卵問題になるため、state用のR2バケットだけは最初に手動で作る。

### 1. state用R2バケットを手動作成する

`apps/api` の `wrangler` が使える状態（`pnpm install` 済み、Cloudflareアカウントに
`wrangler login` 済み）で、リポジトリルートから実行する。

```bash
pnpm --filter @bitcraft/blog-api exec wrangler r2 bucket create bitcraft-blog-tfstate
```

本体サイトが使う `bitcraft-tfstate` とは別のバケットなので、既存のバケットに影響しない。

### 2. R2用のS3互換APIトークンを発行する

Cloudflareダッシュボード → 「R2」→「アカウントAPIトークンを管理」→「APIトークンを作成」で、
**`bitcraft-blog-tfstate` バケットのみに限定した**権限（オブジェクトの読み取り・書き込み）で
新規発行する。アカウント全体を操作できる `CLOUDFLARE_API_TOKEN`（Workers/D1/R2の作成に使う方）
とは別物として扱うこと。

発行後に表示される Access Key ID / Secret Access Key を控え、以下として使う。

- ローカルで `terraform apply` を試す場合: シェルの環境変数
  `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` にエクスポートする
- CI（GitHub Actions）で使う場合: GitHub Secrets `TF_STATE_R2_ACCESS_KEY_ID` /
  `TF_STATE_R2_SECRET_ACCESS_KEY` として登録する（`.github/workflows/deploy.yml`・
  `terraform-plan.yml` が参照する）

### 3. backend.tf のエンドポイントを自分のアカウント用に書き換える

`backend.tf` の `endpoints.s3` にある `<account-hash>` はプレースホルダー。実在の値ではないので、
Cloudflareダッシュボード → R2 → 対象バケット →「S3 API」欄に表示されるエンドポイントURL
（`https://<あなたのアカウントハッシュ>.r2.cloudflarestorage.com` の形式）に書き換える。

### 4. account_id を用意する

`terraform.tfvars.example` を `terraform.tfvars` にコピーし、`account_id` に
Cloudflareアカウント ID（本体サイト `bitcraft-site` のGitHub Secrets
`CLOUDFLARE_ACCOUNT_ID` に設定済みのものと同一のはず）を記入する。
ローカルで動作確認しない場合はこの手順は省略し、CIの `TF_VAR_account_id` のみで運用してよい。

### 5. init & apply を実行する

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

`account_id` を `terraform.tfvars` に書かず環境変数で渡す場合:

```bash
export CLOUDFLARE_API_TOKEN=...       # Workers/D1/R2作成権限を持つアカウント全体トークン
export TF_VAR_account_id=...
export AWS_ACCESS_KEY_ID=...          # 手順2で発行したR2専用トークン
export AWS_SECRET_ACCESS_KEY=...
terraform init && terraform apply
```

### 6. apply結果を apps/api・apps/web の wrangler.jsonc に反映する

```bash
terraform output d1_database_id
terraform output d1_database_name
terraform output r2_bucket_name
```

で得られる値を、`apps/api/wrangler.jsonc`（D1バインディング・R2バインディング）と
`apps/web/wrangler.jsonc`（D1バインディングのみ、R2への書き込みはapiのみが行う設計）の
該当欄に転記する。以降はCIの `deploy.yml` が `terraform apply` → `wrangler deploy` の順で
自動反映するため、手動転記が必要なのは新規作成直後のこの一度だけ。

## 以降の運用

- `terraform/` 配下の変更は通常のPRフローに乗せる。`pull_request` で
  `terraform-plan.yml` が自動的に `terraform plan` を実行する（結果はActionsのログで確認する）
- `main` へのマージ後、`deploy.yml` が `terraform/**` の差分を検知した場合のみ
  `terraform apply` を実行する（差分が無ければスキップ）
- D1のスキーマ変更（テーブル追加等）はTerraformの管轄外。`packages/db/src/schema.ts` の
  drizzle migrationとして作成し、`wrangler d1 migrations apply bitcraft-blog --remote`
  （deploy.yml内で自動実行）で反映する
