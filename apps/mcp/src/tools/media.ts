import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { MEDIA_OWNER_TYPES } from "@bitcraft/blog-shared";
import type { Bindings } from "../lib/bindings";
import { callApi } from "../lib/api-client";
import { apiResultToToolResult, jsonResult } from "../lib/tool-result";

// メディア(R2)管理のMCPツール。apps/apiの /v1/media* を1:1でラップする
// （実装プラン4章）。apps/apiの POST /v1/media はJSON（dataBase64にBase64
// エンコードした画像データを入れる形式。apps/api/src/routes/media.ts参照）を
// 受け取る設計のため、multipart/form-dataへの変換はせずそのままJSONで転送する
// （大きなファイルはこのツールでなくREST APIへの直接アップロードを推奨する）。
export function registerMediaTools(server: McpServer, env: Bindings, token: string) {
  server.registerTool(
    "media_upload",
    {
      description:
        "画像をBase64エンコードした文字列としてR2へアップロードする。大きなファイルはPOST /v1/mediaへの直接アップロードを推奨",
      inputSchema: {
        dataBase64: z.string().describe("画像データをBase64エンコードした文字列"),
        filename: z.string(),
        contentType: z.string(),
        ownerType: z.enum(MEDIA_OWNER_TYPES).optional(),
        ownerSlug: z.string().optional(),
        purpose: z.string().optional(),
        altText: z.string().optional(),
      },
    },
    async ({ dataBase64, filename, contentType, ownerType, ownerSlug, purpose, altText }) =>
      apiResultToToolResult(
        await callApi(env, token, "POST", "/v1/media", {
          dataBase64,
          filename,
          contentType,
          ownerType,
          ownerSlug,
          purpose,
          altText,
        }),
      ),
  );

  server.registerTool(
    "media_list",
    {
      description: "メディア一覧を取得する",
      inputSchema: { ownerType: z.enum(MEDIA_OWNER_TYPES).optional(), ownerSlug: z.string().optional() },
    },
    async ({ ownerType, ownerSlug }) => {
      const qs = new URLSearchParams();
      if (ownerType) qs.set("ownerType", ownerType);
      if (ownerSlug) qs.set("ownerSlug", ownerSlug);
      const query = qs.toString();
      return apiResultToToolResult(await callApi(env, token, "GET", `/v1/media${query ? `?${query}` : ""}`));
    },
  );

  server.registerTool(
    "media_delete",
    {
      description: "メディアを削除する（R2オブジェクトごと削除。confirm=trueの指定が必須）",
      inputSchema: { id: z.number().int().positive(), confirm: z.boolean() },
    },
    async ({ id, confirm }) => {
      if (!confirm) return jsonResult({ error: "confirm=trueの指定が必要です" }, true);
      // apps/apiの実際のルートはパスパラメータ形式（DELETE /v1/media/{id}、
      // apps/api/src/routes/media.ts参照）。
      return apiResultToToolResult(await callApi(env, token, "DELETE", `/v1/media/${id}?confirm=true`));
    },
  );
}
