import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { CHAPTER_STATUSES, SLUG_DESCRIPTION, SLUG_PATTERN } from "@bitcraft/blog-shared";
import type { Bindings } from "../lib/bindings";
import { callApi } from "../lib/api-client";
import { apiResultToToolResult, jsonResult } from "../lib/tool-result";

// Bookチャプター（章）CRUDのMCPツール。apps/apiの
// /v1/books/{bookSlug}/chapters* を1:1でラップする（実装プラン4章）。
const chapterCreateShape = {
  slug: z.string().min(1).regex(SLUG_PATTERN, SLUG_DESCRIPTION),
  chapterNumber: z.number().int().positive(),
  title: z.string().min(1),
  bodyMd: z.string().min(1),
  isFreePreview: z.boolean().optional(),
  status: z.enum(CHAPTER_STATUSES).optional(),
};

const chapterUpdateShape = {
  chapterNumber: chapterCreateShape.chapterNumber.optional(),
  title: chapterCreateShape.title.optional(),
  bodyMd: chapterCreateShape.bodyMd.optional(),
  isFreePreview: chapterCreateShape.isFreePreview,
  status: chapterCreateShape.status,
};

export function registerChapterTools(server: McpServer, env: Bindings, token: string) {
  server.registerTool(
    "chapter_list",
    {
      description: "Book配下のチャプター一覧を取得する（chapterNumber昇順）",
      inputSchema: { bookSlug: z.string() },
    },
    async ({ bookSlug }) => apiResultToToolResult(await callApi(env, token, "GET", `/v1/books/${bookSlug}/chapters`)),
  );

  server.registerTool(
    "chapter_get",
    { description: "チャプターを1件取得する", inputSchema: { bookSlug: z.string(), chapterSlug: z.string() } },
    async ({ bookSlug, chapterSlug }) =>
      apiResultToToolResult(await callApi(env, token, "GET", `/v1/books/${bookSlug}/chapters/${chapterSlug}`)),
  );

  server.registerTool(
    "chapter_create",
    {
      description: "チャプターを新規作成する",
      inputSchema: { bookSlug: z.string(), ...chapterCreateShape },
    },
    async ({ bookSlug, ...body }) =>
      apiResultToToolResult(await callApi(env, token, "POST", `/v1/books/${bookSlug}/chapters`, body)),
  );

  server.registerTool(
    "chapter_update",
    {
      description: "チャプターを部分更新する（渡したキーだけが更新される）",
      inputSchema: { bookSlug: z.string(), chapterSlug: z.string(), ...chapterUpdateShape },
    },
    async ({ bookSlug, chapterSlug, ...body }) =>
      apiResultToToolResult(
        await callApi(env, token, "PATCH", `/v1/books/${bookSlug}/chapters/${chapterSlug}`, body),
      ),
  );

  server.registerTool(
    "chapter_publish",
    {
      description: "チャプターを公開する（draft→published）",
      inputSchema: { bookSlug: z.string(), chapterSlug: z.string() },
    },
    async ({ bookSlug, chapterSlug }) =>
      apiResultToToolResult(
        await callApi(env, token, "POST", `/v1/books/${bookSlug}/chapters/${chapterSlug}/publish`),
      ),
  );

  server.registerTool(
    "chapter_reorder",
    {
      description: "チャプターの章番号（chapterNumber）を一括で並び替える",
      inputSchema: {
        bookSlug: z.string(),
        order: z
          .array(z.object({ slug: z.string(), chapterNumber: z.number().int().positive() }))
          .min(1),
      },
    },
    async ({ bookSlug, order }) =>
      apiResultToToolResult(
        await callApi(env, token, "POST", `/v1/books/${bookSlug}/chapters:reorder`, { order }),
      ),
  );

  server.registerTool(
    "chapter_delete",
    {
      description: "チャプターを削除する（confirm=trueの指定が必須）",
      inputSchema: { bookSlug: z.string(), chapterSlug: z.string(), confirm: z.boolean() },
    },
    async ({ bookSlug, chapterSlug, confirm }) => {
      if (!confirm) return jsonResult({ error: "confirm=trueの指定が必要です" }, true);
      return apiResultToToolResult(
        await callApi(env, token, "DELETE", `/v1/books/${bookSlug}/chapters/${chapterSlug}?confirm=true`),
      );
    },
  );
}
