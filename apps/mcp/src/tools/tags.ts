import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { SLUG_DESCRIPTION, SLUG_PATTERN } from "@bitcraft/blog-shared";
import type { Bindings } from "../lib/bindings";
import { callApi } from "../lib/api-client";
import { apiResultToToolResult } from "../lib/tool-result";

// タグCRUDのMCPツール。apps/apiの /v1/tags* を1:1でラップする（実装プラン4章）。
// 実装プラン3章のAPI一覧に DELETE /v1/tags/{slug} は存在しないため、
// 削除ツールは持たせない。
const tagCreateShape = {
  slug: z.string().min(1).regex(SLUG_PATTERN, SLUG_DESCRIPTION),
  name: z.string().min(1),
  description: z.string().optional(),
};

export function registerTagTools(server: McpServer, env: Bindings, token: string) {
  server.registerTool(
    "tag_list",
    { description: "タグの一覧を取得する", inputSchema: {} },
    async () => apiResultToToolResult(await callApi(env, token, "GET", "/v1/tags")),
  );

  server.registerTool(
    "tag_create",
    { description: "タグを新規作成する", inputSchema: tagCreateShape },
    async (input) => apiResultToToolResult(await callApi(env, token, "POST", "/v1/tags", input)),
  );

  server.registerTool(
    "tag_update",
    {
      description: "タグを部分更新する（渡したキーだけが更新される）",
      inputSchema: {
        slug: z.string(),
        name: tagCreateShape.name.optional(),
        description: tagCreateShape.description,
      },
    },
    async ({ slug, ...body }) => apiResultToToolResult(await callApi(env, token, "PATCH", `/v1/tags/${slug}`, body)),
  );
}
