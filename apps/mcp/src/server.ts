import { McpServer } from "@modelcontextprotocol/server";
import type { Bindings } from "./lib/bindings";
import { registerPostTools } from "./tools/posts";
import { registerTagTools } from "./tools/tags";
import { registerBookTools } from "./tools/books";
import { registerChapterTools } from "./tools/chapters";
import { registerMediaTools } from "./tools/media";
import { registerApiKeyTools } from "./tools/api-keys";

// bitcraft blog CMS APIをラップするMCPサーバー本体。ツールごとの実処理は
// apps/apiへのHTTP呼び出し（callApi）に委譲し、ここでは
// ツール定義（inputSchema・description）の集約のみを行う（実装プラン4章。
// bitcraft-site/apps/mcp/src/server.tsと同じ構造）。
export function createServer(env: Bindings, token: string): McpServer {
  const server = new McpServer({ name: "bitcraft-blog-cms", version: "1.0.0" });
  registerPostTools(server, env, token);
  registerTagTools(server, env, token);
  registerBookTools(server, env, token);
  registerChapterTools(server, env, token);
  registerMediaTools(server, env, token);
  registerApiKeyTools(server, env, token);
  return server;
}
