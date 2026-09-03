import { createMcpHandler } from "agents/mcp/server";
import type { Bindings } from "./lib/bindings";
import { callApi } from "./lib/api-client";
import { createServer } from "./server";

// MCPサーバー（実装プラン4章）。apps/apiへのHTTP呼び出しでCMS APIをラップし、
// 認証は`/v1/auth/verify`（apps/api）に一本化する（「mcpはapiに聞くだけ」、
// 認証ロジックの二重実装をしない）。
//
// McpAgent(Durable Object化)ではなく、agents SDK 0.21時点で現行推奨の
// createMcpHandler()（ステートレス、DO不要）を採用している。McpAgentは
// 既存のステートフルなSDK v1デプロイ向けに残された非推奨・機能凍結の
// legacyパスになったため（bitcraft-site/apps/mcpと同じ判断。
// agents/docs/mcp-servers.md参照）。
function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
    if (!token) return unauthorized();

    // 認証確認はapps/api側のapi_keysテーブル照合に一本化する。ここでは
    // 「未認証者にtools/listすら見せない」ための事前ゲートとしてのみ使う。
    // callApi()を使うことで、本番のService Binding／Docker Composeの
    // API_BASE_URLフォールバックのどちらでも同じ経路で検証できる。
    const verifyRes = await callApi(env, token, "GET", "/v1/auth/verify");
    if (!verifyRes.ok) return unauthorized();

    // ステートレス設計のため、リクエストごとに(env, token)をクロージャで
    // 保持したfactoryを都度生成する。McpServer自体の構築コストは軽く、
    // ツール呼び出しの実処理は毎回apps/apiへのfetchで完結するため問題ない。
    const handler = createMcpHandler(() => createServer(env, token), {
      // デフォルトの許可オリジンはlocalhost系とworkers.devホスト名のみのため、
      // Claude.ai(Web)のカスタムコネクタから接続すると
      // "Invalid Origin: claude.ai" で403になる不具合がbitcraft-siteの
      // apps/mcpで実際に確認されている。Bearer認証は別途必須のため、
      // ブラウザ経由のクライアントとしてclaude.aiを明示的に許可する
      // （ワイルドカードは避け必要な分だけ許可）。
      allowedOriginHostnames: ["claude.ai"],
    });
    return handler(request, env, ctx);
  },
};
