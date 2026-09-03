import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  MAX_EXCERPT_LENGTH,
  MAX_META_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  POST_STATUSES,
  SLUG_DESCRIPTION,
  SLUG_PATTERN,
} from "@bitcraft/blog-shared";
import type { Bindings } from "../lib/bindings";
import { callApi } from "../lib/api-client";
import { apiResultToToolResult, jsonResult } from "../lib/tool-result";

// 記事(Post)CRUDのMCPツール。apps/apiの /v1/posts* を1:1でラップする（実装プラン4章）。
//
// inputSchemaはpackages/sharedのzodスキーマを再利用したいところだが、
// @modelcontextprotocol/serverのregisterTool()はzod v4のZodRawShapeを要求する一方
// apps/apiはzod v3系（@hono/zod-openapiの制約）で統一しているため、apps/mcpだけ
// zod v4を別途インストールしてここに同じ形を再定義している（package.json参照）。
// 実際のバリデーションの正はapps/api側のzod v3スキーマにあり、ここでの定義は
// MCPクライアントへ提示するツール入力形状の説明に過ぎない。文字数上限・slugの
// 正規表現などのルール自体はpackages/shared（zodに依存しないプレーンな値）から
// 読み込み、api側との重複記述を避けている（packages/shared/src/constants.tsの
// コメント参照）。
const postCreateShape = {
  slug: z.string().min(1).regex(SLUG_PATTERN, SLUG_DESCRIPTION),
  title: z.string().min(1).max(MAX_TITLE_LENGTH),
  bodyMd: z.string().min(1),
  excerpt: z.string().max(MAX_EXCERPT_LENGTH).optional(),
  tagSlugs: z.array(z.string()).optional(),
  metaDescription: z.string().min(1).max(MAX_META_DESCRIPTION_LENGTH),
  metaKeywords: z.string().optional(),
  ogImageKey: z.string().optional(),
  canonicalUrl: z.string().optional(),
  noindex: z.boolean().optional(),
  status: z.enum(POST_STATUSES).optional(),
};

const postUpdateShape = {
  title: postCreateShape.title.optional(),
  bodyMd: postCreateShape.bodyMd.optional(),
  excerpt: postCreateShape.excerpt,
  tagSlugs: postCreateShape.tagSlugs,
  metaDescription: postCreateShape.metaDescription.optional(),
  metaKeywords: postCreateShape.metaKeywords,
  ogImageKey: postCreateShape.ogImageKey,
  canonicalUrl: postCreateShape.canonicalUrl,
  noindex: postCreateShape.noindex,
  status: postCreateShape.status,
};

export function registerPostTools(server: McpServer, env: Bindings, token: string) {
  server.registerTool(
    "post_list",
    {
      description: "記事の一覧を取得する（status/tagで絞り込み、page/limitでページングが可能）",
      inputSchema: {
        status: z.enum(POST_STATUSES).optional(),
        tag: z.string().optional(),
        page: z.number().int().positive().optional(),
        limit: z.number().int().positive().max(100).optional(),
      },
    },
    async ({ status, tag, page, limit }) => {
      const qs = new URLSearchParams();
      if (status) qs.set("status", status);
      if (tag) qs.set("tag", tag);
      if (page !== undefined) qs.set("page", String(page));
      if (limit !== undefined) qs.set("limit", String(limit));
      const query = qs.toString();
      return apiResultToToolResult(await callApi(env, token, "GET", `/v1/posts${query ? `?${query}` : ""}`));
    },
  );

  server.registerTool(
    "post_get",
    { description: "記事を1件取得する", inputSchema: { slug: z.string() } },
    async ({ slug }) => apiResultToToolResult(await callApi(env, token, "GET", `/v1/posts/${slug}`)),
  );

  server.registerTool(
    "post_create",
    {
      description: "記事を新規作成する（bodyMdはapps/api側でHTML化・目次抽出・読了時間算出される）",
      inputSchema: postCreateShape,
    },
    async (input) => apiResultToToolResult(await callApi(env, token, "POST", "/v1/posts", input)),
  );

  server.registerTool(
    "post_update",
    { description: "記事を部分更新する（渡したキーだけが更新される）", inputSchema: { slug: z.string(), ...postUpdateShape } },
    async ({ slug, ...body }) => apiResultToToolResult(await callApi(env, token, "PATCH", `/v1/posts/${slug}`, body)),
  );

  server.registerTool(
    "post_publish",
    { description: "記事を公開する（draft→published）", inputSchema: { slug: z.string() } },
    async ({ slug }) => apiResultToToolResult(await callApi(env, token, "POST", `/v1/posts/${slug}/publish`)),
  );

  server.registerTool(
    "post_rerender",
    {
      description:
        "bodyMdからbodyHtml/tocJson/readingTimeMinを再生成する（Markdownパイプライン更新時の一括再適用用）",
      inputSchema: { slug: z.string() },
    },
    async ({ slug }) => apiResultToToolResult(await callApi(env, token, "POST", `/v1/posts/${slug}/rerender`)),
  );

  server.registerTool(
    "post_delete",
    {
      description: "記事を削除する（confirm=trueの指定が必須）",
      inputSchema: { slug: z.string(), confirm: z.boolean() },
    },
    async ({ slug, confirm }) => {
      if (!confirm) return jsonResult({ error: "confirm=trueの指定が必要です" }, true);
      return apiResultToToolResult(await callApi(env, token, "DELETE", `/v1/posts/${slug}?confirm=true`));
    },
  );
}
