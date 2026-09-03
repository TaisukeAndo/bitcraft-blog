// apps/mcpはD1/R2を一切扱わず、コンテンツ操作はすべてapps/apiへの
// HTTP呼び出しに委譲する（実装プラン4章）。
//
// 本番はService Binding（API）を使うが、ローカルのDocker Compose環境では
// コンテナ間でService Bindingが解決できないため、API_BASE_URL
// （例: http://api:8788）へのプレーンHTTP fetchにフォールバックする
// （実装プラン9章。src/lib/api-client.tsのfetchApi参照）。
export type Bindings = {
  API?: Fetcher;
  API_BASE_URL?: string;
};
