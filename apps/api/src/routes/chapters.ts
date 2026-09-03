import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import { and, asc, eq } from "drizzle-orm";
import { bookChapters, books } from "@bitcraft/blog-db";
import {
  chapterCreateSchema,
  chapterReorderSchema,
  chapterUpdateSchema,
} from "@bitcraft/blog-shared/schemas";
import { CHAPTER_STATUSES } from "@bitcraft/blog-shared";
import type { BookChapter } from "@bitcraft/blog-shared";
import { renderMarkdown } from "@bitcraft/blog-shared/markdown";
import type { Bindings } from "../lib/bindings";
import { getDb } from "../lib/db";
import { jsonError } from "../middleware/error-handler";

type ChapterRow = typeof bookChapters.$inferSelect;

const tocEntrySchema = z.object({ depth: z.number(), text: z.string(), id: z.string() });

const chapterResponseSchema = z.object({
  id: z.number(),
  bookId: z.number(),
  slug: z.string(),
  chapterNumber: z.number(),
  title: z.string(),
  bodyMd: z.string(),
  bodyHtml: z.string().nullable(),
  toc: z.array(tocEntrySchema),
  readingTimeMin: z.number().nullable(),
  isFreePreview: z.boolean(),
  status: z.enum(CHAPTER_STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
});

function parseToc(tocJson: string | null): BookChapter["toc"] {
  if (!tocJson) return [];
  try {
    const parsed: unknown = JSON.parse(tocJson);
    return Array.isArray(parsed) ? (parsed as BookChapter["toc"]) : [];
  } catch {
    return [];
  }
}

function toResponse(row: ChapterRow): BookChapter {
  return {
    id: row.id,
    bookId: row.bookId,
    slug: row.slug,
    chapterNumber: row.chapterNumber,
    title: row.title,
    bodyMd: row.bodyMd,
    bodyHtml: row.bodyHtml,
    toc: parseToc(row.tocJson),
    readingTimeMin: row.readingTimeMin,
    isFreePreview: row.isFreePreview,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// bookChapters CRUD + publish + 並び替え（実装計画3章・5章）。
// posts.tsと同様、bodyMdの保存時（POST/PATCH）に必ずrenderMarkdownを呼ぶ。
export function registerChapterRoutes(app: OpenAPIHono<{ Bindings: Bindings }>) {
  async function requireBook(c: { env: Bindings }, slug: string) {
    const db = getDb(c.env);
    const book = await db.select({ id: books.id }).from(books).where(eq(books.slug, slug)).get();
    return book;
  }

  // GET /v1/books/{slug}/chapters -----------------------------------------------------
  const listRoute = createRoute({
    method: "get",
    path: "/v1/books/{slug}/chapters",
    summary: "Book配下のチャプター一覧を取得（chapterNumber昇順）",
    tags: ["chapters"],
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ slug: z.string() }) },
    responses: {
      200: { description: "チャプター一覧", content: { "application/json": { schema: z.array(chapterResponseSchema) } } },
      401: { description: "認証エラー" },
      404: { description: "bookが見つからない" },
    },
  });

  app.openapi(listRoute, async (c) => {
    const { slug } = c.req.valid("param");
    const book = await requireBook(c, slug);
    if (!book) return jsonError(c, "NOT_FOUND", `book '${slug}' が見つかりません`, 404);

    const db = getDb(c.env);
    const rows = await db
      .select()
      .from(bookChapters)
      .where(eq(bookChapters.bookId, book.id))
      .orderBy(asc(bookChapters.chapterNumber));
    return c.json(rows.map(toResponse), 200);
  });

  // POST /v1/books/{slug}/chapters ----------------------------------------------------
  const createRouteDef = createRoute({
    method: "post",
    path: "/v1/books/{slug}/chapters",
    summary: "Book配下にチャプターを新規作成",
    tags: ["chapters"],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ slug: z.string() }),
      body: { content: { "application/json": { schema: chapterCreateSchema } } },
    },
    responses: {
      201: { description: "作成したチャプター", content: { "application/json": { schema: chapterResponseSchema } } },
      401: { description: "認証エラー" },
      404: { description: "bookが見つからない" },
      409: { description: "同じslug、または同じchapterNumberのチャプターが既に存在する" },
    },
  });

  app.openapi(createRouteDef, async (c) => {
    const { slug } = c.req.valid("param");
    const body = c.req.valid("json");
    const book = await requireBook(c, slug);
    if (!book) return jsonError(c, "NOT_FOUND", `book '${slug}' が見つかりません`, 404);

    const db = getDb(c.env);
    // slug自体の重複チェックは事前SELECTせず、UNIQUE(book_id, slug)違反を
    // middleware/error-handler.tsのerrorHandlerがSLUG_CONFLICTへ変換する処理に委ねる。
    const rendered = await renderMarkdown(body.bodyMd);

    const inserted = await db
      .insert(bookChapters)
      .values({
        bookId: book.id,
        slug: body.slug,
        chapterNumber: body.chapterNumber,
        title: body.title,
        bodyMd: body.bodyMd,
        bodyHtml: rendered.html,
        tocJson: JSON.stringify(rendered.toc),
        readingTimeMin: rendered.readingTimeMin,
        ...(body.isFreePreview !== undefined ? { isFreePreview: body.isFreePreview } : {}),
        status: body.status ?? "draft",
      })
      .returning();

    const row = inserted[0];
    if (!row) return jsonError(c, "INTERNAL_ERROR", "チャプターの作成に失敗しました", 500);
    return c.json(toResponse(row), 201);
  });

  // GET /v1/books/{slug}/chapters/{chapterSlug} ---------------------------------------
  const getRoute = createRoute({
    method: "get",
    path: "/v1/books/{slug}/chapters/{chapterSlug}",
    summary: "チャプターを1件取得",
    tags: ["chapters"],
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ slug: z.string(), chapterSlug: z.string() }) },
    responses: {
      200: { description: "チャプター", content: { "application/json": { schema: chapterResponseSchema } } },
      401: { description: "認証エラー" },
      404: { description: "見つからない" },
    },
  });

  app.openapi(getRoute, async (c) => {
    const { slug, chapterSlug } = c.req.valid("param");
    const book = await requireBook(c, slug);
    if (!book) return jsonError(c, "NOT_FOUND", `book '${slug}' が見つかりません`, 404);

    const db = getDb(c.env);
    const row = await db
      .select()
      .from(bookChapters)
      .where(and(eq(bookChapters.bookId, book.id), eq(bookChapters.slug, chapterSlug)))
      .get();
    if (!row) return jsonError(c, "NOT_FOUND", `chapter '${chapterSlug}' が見つかりません`, 404);
    return c.json(toResponse(row), 200);
  });

  // PATCH /v1/books/{slug}/chapters/{chapterSlug} -------------------------------------
  const updateRoute = createRoute({
    method: "patch",
    path: "/v1/books/{slug}/chapters/{chapterSlug}",
    summary: "チャプターを部分更新",
    tags: ["chapters"],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ slug: z.string(), chapterSlug: z.string() }),
      body: { content: { "application/json": { schema: chapterUpdateSchema } } },
    },
    responses: {
      200: { description: "更新後のチャプター", content: { "application/json": { schema: chapterResponseSchema } } },
      401: { description: "認証エラー" },
      404: { description: "見つからない" },
    },
  });

  app.openapi(updateRoute, async (c) => {
    const { slug, chapterSlug } = c.req.valid("param");
    const body = c.req.valid("json");
    const book = await requireBook(c, slug);
    if (!book) return jsonError(c, "NOT_FOUND", `book '${slug}' が見つかりません`, 404);

    const db = getDb(c.env);
    const existing = await db
      .select()
      .from(bookChapters)
      .where(and(eq(bookChapters.bookId, book.id), eq(bookChapters.slug, chapterSlug)))
      .get();
    if (!existing) return jsonError(c, "NOT_FOUND", `chapter '${chapterSlug}' が見つかりません`, 404);

    let bodyHtml = existing.bodyHtml;
    let tocJson = existing.tocJson;
    let readingTimeMin = existing.readingTimeMin;
    if (body.bodyMd !== undefined) {
      const rendered = await renderMarkdown(body.bodyMd);
      bodyHtml = rendered.html;
      tocJson = JSON.stringify(rendered.toc);
      readingTimeMin = rendered.readingTimeMin;
    }

    await db
      .update(bookChapters)
      .set({
        chapterNumber: body.chapterNumber ?? existing.chapterNumber,
        title: body.title ?? existing.title,
        bodyMd: body.bodyMd ?? existing.bodyMd,
        bodyHtml,
        tocJson,
        readingTimeMin,
        isFreePreview: body.isFreePreview ?? existing.isFreePreview,
        status: body.status ?? existing.status,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(bookChapters.id, existing.id))
      .run();

    const updated = await db.select().from(bookChapters).where(eq(bookChapters.id, existing.id)).get();
    if (!updated) return jsonError(c, "INTERNAL_ERROR", "更新後のchapter取得に失敗しました", 500);
    return c.json(toResponse(updated), 200);
  });

  // DELETE /v1/books/{slug}/chapters/{chapterSlug} ------------------------------------
  const deleteRoute = createRoute({
    method: "delete",
    path: "/v1/books/{slug}/chapters/{chapterSlug}",
    summary: "チャプターを削除（?confirm=true必須）",
    tags: ["chapters"],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ slug: z.string(), chapterSlug: z.string() }),
      query: z.object({ confirm: z.string().optional() }),
    },
    responses: {
      204: { description: "削除した" },
      400: { description: "?confirm=true が指定されていない" },
      401: { description: "認証エラー" },
      404: { description: "見つからない" },
    },
  });

  app.openapi(deleteRoute, async (c) => {
    const { slug, chapterSlug } = c.req.valid("param");
    const { confirm } = c.req.valid("query");
    if (confirm !== "true") {
      return jsonError(c, "VALIDATION_ERROR", "削除には ?confirm=true の指定が必要です", 400);
    }

    const book = await requireBook(c, slug);
    if (!book) return jsonError(c, "NOT_FOUND", `book '${slug}' が見つかりません`, 404);

    const db = getDb(c.env);
    const target = await db
      .select({ id: bookChapters.id })
      .from(bookChapters)
      .where(and(eq(bookChapters.bookId, book.id), eq(bookChapters.slug, chapterSlug)))
      .get();
    if (!target) return jsonError(c, "NOT_FOUND", `chapter '${chapterSlug}' が見つかりません`, 404);

    await db.delete(bookChapters).where(eq(bookChapters.id, target.id)).run();
    return c.body(null, 204);
  });

  // POST /v1/books/{slug}/chapters/{chapterSlug}/publish -------------------------------
  const publishRoute = createRoute({
    method: "post",
    path: "/v1/books/{slug}/chapters/{chapterSlug}/publish",
    summary: "チャプターを公開する（draft→published）",
    tags: ["chapters"],
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ slug: z.string(), chapterSlug: z.string() }) },
    responses: {
      200: { description: "公開後のチャプター", content: { "application/json": { schema: chapterResponseSchema } } },
      401: { description: "認証エラー" },
      404: { description: "見つからない" },
    },
  });

  app.openapi(publishRoute, async (c) => {
    const { slug, chapterSlug } = c.req.valid("param");
    const book = await requireBook(c, slug);
    if (!book) return jsonError(c, "NOT_FOUND", `book '${slug}' が見つかりません`, 404);

    const db = getDb(c.env);
    const existing = await db
      .select()
      .from(bookChapters)
      .where(and(eq(bookChapters.bookId, book.id), eq(bookChapters.slug, chapterSlug)))
      .get();
    if (!existing) return jsonError(c, "NOT_FOUND", `chapter '${chapterSlug}' が見つかりません`, 404);

    await db
      .update(bookChapters)
      .set({ status: "published", updatedAt: new Date().toISOString() })
      .where(eq(bookChapters.id, existing.id))
      .run();

    const updated = await db.select().from(bookChapters).where(eq(bookChapters.id, existing.id)).get();
    if (!updated) return jsonError(c, "INTERNAL_ERROR", "公開後のchapter取得に失敗しました", 500);
    return c.json(toResponse(updated), 200);
  });

  // POST /v1/books/{slug}/chapters:reorder ---------------------------------------------
  const reorderRoute = createRoute({
    method: "post",
    path: "/v1/books/{slug}/chapters:reorder",
    summary: "チャプターの並び順(chapterNumber)を一括更新する（book内の全チャプターを過不足なく含める必要がある）",
    tags: ["chapters"],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ slug: z.string() }),
      body: { content: { "application/json": { schema: chapterReorderSchema } } },
    },
    responses: {
      200: {
        description: "更新後のチャプター一覧（chapterNumber昇順）",
        content: { "application/json": { schema: z.array(chapterResponseSchema) } },
      },
      400: { description: "バリデーションエラー（book内の全チャプターを含んでいない、chapterNumberが重複、等）" },
      401: { description: "認証エラー" },
      404: { description: "bookが見つからない、またはorder内に存在しないチャプターslugが含まれる" },
    },
  });

  app.openapi(reorderRoute, async (c) => {
    const { slug } = c.req.valid("param");
    const { order } = c.req.valid("json");
    const book = await requireBook(c, slug);
    if (!book) return jsonError(c, "NOT_FOUND", `book '${slug}' が見つかりません`, 404);

    const db = getDb(c.env);
    const chapterRows = await db
      .select({ id: bookChapters.id, slug: bookChapters.slug })
      .from(bookChapters)
      .where(eq(bookChapters.bookId, book.id));
    const idBySlug = new Map(chapterRows.map((r) => [r.slug, r.id]));

    const missing = order.filter((o) => !idBySlug.has(o.slug));
    if (missing.length > 0) {
      return jsonError(
        c,
        "NOT_FOUND",
        `book内に存在しないチャプターslugが含まれています: ${missing.map((m) => m.slug).join(", ")}`,
        404,
      );
    }
    if (order.length !== chapterRows.length) {
      return jsonError(c, "VALIDATION_ERROR", "orderにはbook内の全チャプターを過不足なく含める必要があります", 400);
    }
    const chapterNumbers = order.map((o) => o.chapterNumber);
    if (new Set(chapterNumbers).size !== chapterNumbers.length) {
      return jsonError(c, "VALIDATION_ERROR", "orderのchapterNumberが重複しています", 400);
    }

    const now = new Date().toISOString();
    // フェーズ1: 全対象行のchapterNumberを一時的に負値（-id。行ごとに一意）へ退避してから
    // フェーズ2で正しい値に更新する。UNIQUE(book_id, chapter_number)への一時抵触を避けるため
    // （実装計画3章）。db.batch()はD1上で複数ステートメントを1つのトランザクションとして
    // 実行するため、フェーズ1・2を合わせた全体がアトミックに適用される。
    const negativeUpdates = order.map((o) => {
      const id = idBySlug.get(o.slug) as number;
      return db.update(bookChapters).set({ chapterNumber: -id }).where(eq(bookChapters.id, id));
    });
    const finalUpdates = order.map((o) => {
      const id = idBySlug.get(o.slug) as number;
      return db
        .update(bookChapters)
        .set({ chapterNumber: o.chapterNumber, updatedAt: now })
        .where(eq(bookChapters.id, id));
    });

    // drizzleのdb.batch()はTypeScript上「非空タプル」型を要求するが、この配列は
    // リクエストボディの長さに応じて動的に組み立てるため静的にタプルと推論できない。
    // chapterReorderSchemaのorder.min(1)により実行時には必ず非空であることを保証済み。
    const statements = [...negativeUpdates, ...finalUpdates] as unknown as [
      (typeof negativeUpdates)[number],
      ...(typeof negativeUpdates)[number][],
    ];
    await db.batch(statements);

    const updatedRows = await db
      .select()
      .from(bookChapters)
      .where(eq(bookChapters.bookId, book.id))
      .orderBy(asc(bookChapters.chapterNumber));
    return c.json(updatedRows.map(toResponse), 200);
  });
}
