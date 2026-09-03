# docker/

ローカル開発専用の構成。Cloudflare Workersの本番デプロイはコンテナ配信ではなく、CIから
`wrangler deploy` で行うエッジデプロイ（`.github/workflows/deploy.yml`）のため、この
Dockerイメージ自体は本番にデプロイしない。「Node/pnpm/wranglerを誰の開発機でも同一に
再現する」ためだけの用途。

## 使い方

リポジトリルートから実行する。

```bash
docker compose -f docker/docker-compose.yml up
```

初回は `install` サービスが `pnpm install` を実行してから、`api`（:8788）→
`web`（:8787）／`mcp`（:8789）の順に起動する。起動後:

```bash
curl http://localhost:8788/v1/health   # apps/api
curl http://localhost:8787/            # apps/web
curl -i http://localhost:8789/mcp      # apps/mcp（未認証で401が返れば正常）
```

止めるときは `Ctrl+C`、コンテナとネットワークを片付けるときは
`docker compose -f docker/docker-compose.yml down`（依存関係の再インストールを避けたい場合は
`node_modules`・`wrangler-state` ボリュームは残す。完全にやり直す場合のみ
`docker compose -f docker/docker-compose.yml down -v` で消す）。

## 構成の要点

- **Service Bindingのローカル代替**: 本番の `apps/web`→`apps/api`・`apps/mcp`→`apps/api`
  はCloudflare Service Bindingで疎通するが、ローカルの別コンテナ間ではService Bindingが
  解決できない。そのため `web`・`mcp` コンテナには `API_BASE_URL=http://api:8788`
  環境変数を渡し、`apps/web`・`apps/mcp` の `apiClient` 側で「`env.API`（Service Binding）が
  あれば使い、無ければ `API_BASE_URL` へのHTTP fetchにフォールバックする」実装になっている
  前提（本番ではService Bindingが有効なため、この環境変数は使われない）。
- **D1ローカル状態の共有**: `api`・`web` はどちらも `--persist-to /app/.wrangler-state`
  を指定し、同じ名前付きボリューム `wrangler-state` をマウントしている。これにより
  `api` 経由で作成した記事の下書き（draft）を `web` のプレビューからも参照できる。
  `mcp` はD1に直接触れずAPI経由でのみ操作する設計のため、このボリュームを持たせていない。
- **node_modulesの分離**: `node_modules` は名前付きボリューム（コンテナ内蔵）にしている。
  ホスト（macOS等）で `pnpm install` した `node_modules` をそのままbind mountすると、
  wrangler/workerd等のネイティブバイナリがホストOSとコンテナ内Linuxとで一致せず
  動かないことがあるため、コンテナ内で改めて `pnpm install` する構成にしている。
