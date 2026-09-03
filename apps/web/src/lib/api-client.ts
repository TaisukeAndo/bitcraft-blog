import type { Bindings } from "./bindings";

// 「いいね」ボタン専用のapps/api呼び出しヘルパー（実装プラン9章、apps/mcpの
// lib/api-client.tsと同じ委譲パターン。ユーザー指示により2026-09-04追加）。
// apps/web自身はD1へ書き込まない（SELECT専用の原則を崩さない）ため、
// 訪問者からの「いいね」POSTはService Binding経由でapps/apiへそのまま委譲する。
// like/unlikeは認証不要のエンドポイント（middleware/auth.tsのPUBLIC_PATH_PATTERNS）
// のためBearerトークンは付けない。
export async function callPublicApi(env: Bindings, path: string): Promise<Response> {
  if (env.API) {
    return env.API.fetch(`https://internal${path}`, { method: "POST" });
  }
  if (env.API_BASE_URL) {
    return fetch(`${env.API_BASE_URL}${path}`, { method: "POST" });
  }
  throw new Error("APIへの接続手段がありません（env.API または env.API_BASE_URL のいずれかが必要です）");
}
