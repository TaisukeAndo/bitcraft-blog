import type { Bindings } from "./bindings";

export type ApiResult<T = unknown> = { ok: boolean; status: number; data: T };

// apps/apiへのHTTP呼び出しをまとめるヘルパー。env.API（Service Binding）が
// あればそれを使い（URLのホスト名部分はService Binding経由では使われない
// ダミー値。apps/webのc.env.API.fetch(...)と同じ規約に揃えている）、無ければ
// env.API_BASE_URLへのプレーンHTTP fetchにフォールバックする（実装プラン9章、
// Docker Compose環境向け）。
async function fetchApi(env: Bindings, path: string, init: RequestInit): Promise<Response> {
  if (env.API) {
    return env.API.fetch(`https://internal${path}`, init);
  }
  if (env.API_BASE_URL) {
    return fetch(`${env.API_BASE_URL}${path}`, init);
  }
  throw new Error("APIへの接続手段がありません（env.API または env.API_BASE_URL のいずれかが必要です）");
}

// 認証はAuthorizationヘッダをそのまま転送するだけで、認証ロジック（トークンの
// ハッシュ照合等）の単一ソースはapps/api側に保つ（実装プラン4章:
// 「mcpはapiに聞くだけ」）。
export async function callApi<T = unknown>(
  env: Bindings,
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const res = await fetchApi(env, path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = (text ? JSON.parse(text) : undefined) as T;
  return { ok: res.ok, status: res.status, data };
}
