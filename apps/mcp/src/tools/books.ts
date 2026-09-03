import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  BOOK_STATUSES,
  MAX_META_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  PRICING_MODELS,
  SLUG_DESCRIPTION,
  SLUG_PATTERN,
} from "@bitcraft/blog-shared";
import type { Bindings } from "../lib/bindings";
import { callApi } from "../lib/api-client";
import { apiResultToToolResult, jsonResult } from "../lib/tool-result";

// Book（Zenn Bookのような有料販売可能な長編コンテンツ）CRUDのMCPツール。
// apps/apiの /v1/books* を1:1でラップする（実装プラン4章）。決済(Stripe)導入前
// のため、priceYen/pricingModelは表示上の「有料予定」バッジ用の値に過ぎず、
// 実際の閲覧制限はapps/web側でまだ実装されていない（実装プラン2・12章）。
const bookCreateShape = {
  slug: z.string().min(1).regex(SLUG_PATTERN, SLUG_DESCRIPTION),
  title: z.string().min(1).max(MAX_TITLE_LENGTH),
  summary: z.string().min(1),
  metaDescription: z.string().min(1).max(MAX_META_DESCRIPTION_LENGTH),
  priceYen: z.number().int().nonnegative().optional(),
  pricingModel: z.enum(PRICING_MODELS).optional(),
  coverImageKey: z.string().optional(),
  status: z.enum(BOOK_STATUSES).optional(),
};

const bookUpdateShape = {
  title: bookCreateShape.title.optional(),
  summary: bookCreateShape.summary.optional(),
  metaDescription: bookCreateShape.metaDescription.optional(),
  priceYen: bookCreateShape.priceYen,
  pricingModel: bookCreateShape.pricingModel,
  coverImageKey: bookCreateShape.coverImageKey,
  status: bookCreateShape.status,
};

export function registerBookTools(server: McpServer, env: Bindings, token: string) {
  server.registerTool(
    "book_list",
    { description: "Bookの一覧を取得する", inputSchema: { status: z.enum(BOOK_STATUSES).optional() } },
    async ({ status }) => {
      const qs = new URLSearchParams();
      if (status) qs.set("status", status);
      const query = qs.toString();
      return apiResultToToolResult(await callApi(env, token, "GET", `/v1/books${query ? `?${query}` : ""}`));
    },
  );

  server.registerTool(
    "book_get",
    { description: "Bookを1件取得する", inputSchema: { slug: z.string() } },
    async ({ slug }) => apiResultToToolResult(await callApi(env, token, "GET", `/v1/books/${slug}`)),
  );

  server.registerTool(
    "book_create",
    { description: "Bookを新規作成する", inputSchema: bookCreateShape },
    async (input) => apiResultToToolResult(await callApi(env, token, "POST", "/v1/books", input)),
  );

  server.registerTool(
    "book_update",
    {
      description: "Bookを部分更新する（渡したキーだけが更新される）",
      inputSchema: { slug: z.string(), ...bookUpdateShape },
    },
    async ({ slug, ...body }) => apiResultToToolResult(await callApi(env, token, "PATCH", `/v1/books/${slug}`, body)),
  );

  server.registerTool(
    "book_publish",
    { description: "Bookを公開する（draft→published）", inputSchema: { slug: z.string() } },
    async ({ slug }) => apiResultToToolResult(await callApi(env, token, "POST", `/v1/books/${slug}/publish`)),
  );

  server.registerTool(
    "book_delete",
    {
      description: "Bookを削除する（confirm=trueの指定が必須。配下のチャプターも合わせて削除される）",
      inputSchema: { slug: z.string(), confirm: z.boolean() },
    },
    async ({ slug, confirm }) => {
      if (!confirm) return jsonResult({ error: "confirm=trueの指定が必要です" }, true);
      return apiResultToToolResult(await callApi(env, token, "DELETE", `/v1/books/${slug}?confirm=true`));
    },
  );
}
