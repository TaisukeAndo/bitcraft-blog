import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import { desc, eq } from "drizzle-orm";
import { books } from "@bitcraft/blog-db";
import { bookCreateSchema, bookUpdateSchema } from "@bitcraft/blog-shared/schemas";
import { BOOK_STATUSES, PRICING_MODELS } from "@bitcraft/blog-shared";
import type { Book } from "@bitcraft/blog-shared";
import type { Bindings } from "../lib/bindings";
import { getDb } from "../lib/db";
import { jsonError } from "../middleware/error-handler";

type BookRow = typeof books.$inferSelect;

// stripeProductId/stripePriceIdはPhase4（決済連携）の予約列で、APIレスポンスにも
// bookCreateSchema/bookUpdateSchemaにも含めない（@bitcraft/blog-sharedのBook型と揃える。
// 実装計画2章）。
const bookResponseSchema = z.object({
  id: z.number(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  coverImageKey: z.string().nullable(),
  status: z.enum(BOOK_STATUSES),
  priceYen: z.number(),
  pricingModel: z.enum(PRICING_MODELS),
  metaDescription: z.string(),
  metaKeywords: z.string().nullable(),
  ogImageKey: z.string().nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

function toResponse(row: BookRow): Book {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    coverImageKey: row.coverImageKey,
    status: row.status,
    priceYen: row.priceYen,
    pricingModel: row.pricingModel,
    metaDescription: row.metaDescription,
    metaKeywords: row.metaKeywords,
    ogImageKey: row.ogImageKey,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Book CRUD + publish（実装計画3章）。チャプター自体はroutes/chapters.tsが担当する。 */
export function registerBookRoutes(app: OpenAPIHono<{ Bindings: Bindings }>) {
  // GET /v1/books ------------------------------------------------------------------
  const listRoute = createRoute({
    method: "get",
    path: "/v1/books",
    summary: "Book一覧を取得",
    tags: ["books"],
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ status: z.enum(BOOK_STATUSES).optional() }) },
    responses: {
      200: { description: "Book一覧（createdAt降順）", content: { "application/json": { schema: z.array(bookResponseSchema) } } },
      401: { description: "認証エラー" },
    },
  });

  app.openapi(listRoute, async (c) => {
    const { status } = c.req.valid("query");
    const db = getDb(c.env);
    const rows = await db
      .select()
      .from(books)
      .where(status ? eq(books.status, status) : undefined)
      .orderBy(desc(books.createdAt));
    return c.json(rows.map(toResponse), 200);
  });

  // POST /v1/books -----------------------------------------------------------------
  const createRouteDef = createRoute({
    method: "post",
    path: "/v1/books",
    summary: "Bookを新規作成",
    tags: ["books"],
    security: [{ bearerAuth: [] }],
    request: { body: { content: { "application/json": { schema: bookCreateSchema } } } },
    responses: {
      201: { description: "作成したBook", content: { "application/json": { schema: bookResponseSchema } } },
      401: { description: "認証エラー" },
      409: { description: "同じslugのBookが既に存在する" },
    },
  });

  app.openapi(createRouteDef, async (c) => {
    const body = c.req.valid("json");
    const db = getDb(c.env);

    const existing = await db.select({ id: books.id }).from(books).where(eq(books.slug, body.slug)).get();
    if (existing) return jsonError(c, "SLUG_CONFLICT", `slug '${body.slug}' は既に使用されています`, 409);

    const inserted = await db
      .insert(books)
      .values({
        slug: body.slug,
        title: body.title,
        summary: body.summary,
        coverImageKey: body.coverImageKey ?? null,
        status: body.status ?? "draft",
        ...(body.priceYen !== undefined ? { priceYen: body.priceYen } : {}),
        ...(body.pricingModel !== undefined ? { pricingModel: body.pricingModel } : {}),
        metaDescription: body.metaDescription,
        metaKeywords: body.metaKeywords ?? null,
        ogImageKey: body.ogImageKey ?? null,
      })
      .returning();

    const row = inserted[0];
    if (!row) return jsonError(c, "INTERNAL_ERROR", "Bookの作成に失敗しました", 500);
    return c.json(toResponse(row), 201);
  });

  // GET /v1/books/{slug} --------------------------------------------------------------
  const getRoute = createRoute({
    method: "get",
    path: "/v1/books/{slug}",
    summary: "Bookを1件取得",
    tags: ["books"],
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ slug: z.string() }) },
    responses: {
      200: { description: "Book", content: { "application/json": { schema: bookResponseSchema } } },
      401: { description: "認証エラー" },
      404: { description: "見つからない" },
    },
  });

  app.openapi(getRoute, async (c) => {
    const { slug } = c.req.valid("param");
    const db = getDb(c.env);
    const row = await db.select().from(books).where(eq(books.slug, slug)).get();
    if (!row) return jsonError(c, "NOT_FOUND", `book '${slug}' が見つかりません`, 404);
    return c.json(toResponse(row), 200);
  });

  // PATCH /v1/books/{slug} ----------------------------------------------------------
  const updateRoute = createRoute({
    method: "patch",
    path: "/v1/books/{slug}",
    summary: "Bookを部分更新",
    tags: ["books"],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ slug: z.string() }),
      body: { content: { "application/json": { schema: bookUpdateSchema } } },
    },
    responses: {
      200: { description: "更新後のBook", content: { "application/json": { schema: bookResponseSchema } } },
      401: { description: "認証エラー" },
      404: { description: "見つからない" },
    },
  });

  app.openapi(updateRoute, async (c) => {
    const { slug } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = getDb(c.env);

    const existing = await db.select().from(books).where(eq(books.slug, slug)).get();
    if (!existing) return jsonError(c, "NOT_FOUND", `book '${slug}' が見つかりません`, 404);

    await db
      .update(books)
      .set({
        title: body.title ?? existing.title,
        summary: body.summary ?? existing.summary,
        coverImageKey: body.coverImageKey === undefined ? existing.coverImageKey : body.coverImageKey,
        status: body.status ?? existing.status,
        priceYen: body.priceYen ?? existing.priceYen,
        pricingModel: body.pricingModel ?? existing.pricingModel,
        metaDescription: body.metaDescription ?? existing.metaDescription,
        metaKeywords: body.metaKeywords === undefined ? existing.metaKeywords : body.metaKeywords,
        ogImageKey: body.ogImageKey === undefined ? existing.ogImageKey : body.ogImageKey,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(books.id, existing.id))
      .run();

    const updated = await db.select().from(books).where(eq(books.id, existing.id)).get();
    if (!updated) return jsonError(c, "INTERNAL_ERROR", "更新後のBook取得に失敗しました", 500);
    return c.json(toResponse(updated), 200);
  });

  // DELETE /v1/books/{slug} ----------------------------------------------------------
  const deleteRoute = createRoute({
    method: "delete",
    path: "/v1/books/{slug}",
    summary: "Bookを削除（?confirm=true必須。配下のチャプターもCASCADE削除される）",
    tags: ["books"],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ slug: z.string() }),
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
    const { slug } = c.req.valid("param");
    const { confirm } = c.req.valid("query");
    if (confirm !== "true") {
      return jsonError(c, "VALIDATION_ERROR", "削除には ?confirm=true の指定が必要です", 400);
    }

    const db = getDb(c.env);
    const existing = await db.select({ id: books.id }).from(books).where(eq(books.slug, slug)).get();
    if (!existing) return jsonError(c, "NOT_FOUND", `book '${slug}' が見つかりません`, 404);

    // book_chaptersはON DELETE CASCADEで自動削除される（packages/db/src/schema.ts）。
    await db.delete(books).where(eq(books.id, existing.id)).run();
    return c.body(null, 204);
  });

  // POST /v1/books/{slug}/publish ------------------------------------------------------
  const publishRoute = createRoute({
    method: "post",
    path: "/v1/books/{slug}/publish",
    summary: "Bookを公開する（draft/archived→published）",
    tags: ["books"],
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ slug: z.string() }) },
    responses: {
      200: { description: "公開後のBook", content: { "application/json": { schema: bookResponseSchema } } },
      401: { description: "認証エラー" },
      404: { description: "見つからない" },
    },
  });

  app.openapi(publishRoute, async (c) => {
    const { slug } = c.req.valid("param");
    const db = getDb(c.env);
    const existing = await db.select().from(books).where(eq(books.slug, slug)).get();
    if (!existing) return jsonError(c, "NOT_FOUND", `book '${slug}' が見つかりません`, 404);

    await db
      .update(books)
      .set({
        status: "published",
        publishedAt: existing.publishedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(books.id, existing.id))
      .run();

    const updated = await db.select().from(books).where(eq(books.id, existing.id)).get();
    if (!updated) return jsonError(c, "INTERNAL_ERROR", "公開後のBook取得に失敗しました", 500);
    return c.json(toResponse(updated), 200);
  });
}
