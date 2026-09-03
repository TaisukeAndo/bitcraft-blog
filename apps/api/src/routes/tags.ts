import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import { asc, eq } from "drizzle-orm";
import { tags } from "@bitcraft/blog-db";
import { tagCreateSchema, tagUpdateSchema } from "@bitcraft/blog-shared/schemas";
import type { Tag } from "@bitcraft/blog-shared";
import type { Bindings } from "../lib/bindings";
import { getDb } from "../lib/db";
import { jsonError } from "../middleware/error-handler";

type TagRow = typeof tags.$inferSelect;

const tagResponseSchema = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string(),
});

function toResponse(row: TagRow): Tag {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt,
  };
}

/** タグCRUD（一覧・作成・更新のみ。削除は対象外。実装計画3章）。 */
export function registerTagRoutes(app: OpenAPIHono<{ Bindings: Bindings }>) {
  // GET /v1/tags ---------------------------------------------------------------
  const listRoute = createRoute({
    method: "get",
    path: "/v1/tags",
    summary: "タグ一覧を取得",
    tags: ["tags"],
    security: [{ bearerAuth: [] }],
    responses: {
      200: { description: "タグ一覧（name昇順）", content: { "application/json": { schema: z.array(tagResponseSchema) } } },
      401: { description: "認証エラー" },
    },
  });

  app.openapi(listRoute, async (c) => {
    const db = getDb(c.env);
    const rows = await db.select().from(tags).orderBy(asc(tags.name));
    return c.json(rows.map(toResponse), 200);
  });

  // POST /v1/tags --------------------------------------------------------------
  const createRouteDef = createRoute({
    method: "post",
    path: "/v1/tags",
    summary: "タグを新規作成",
    tags: ["tags"],
    security: [{ bearerAuth: [] }],
    request: { body: { content: { "application/json": { schema: tagCreateSchema } } } },
    responses: {
      201: { description: "作成したタグ", content: { "application/json": { schema: tagResponseSchema } } },
      401: { description: "認証エラー" },
      409: { description: "同じslugのタグが既に存在する" },
    },
  });

  app.openapi(createRouteDef, async (c) => {
    const body = c.req.valid("json");
    const db = getDb(c.env);

    const existing = await db.select({ id: tags.id }).from(tags).where(eq(tags.slug, body.slug)).get();
    if (existing) {
      return jsonError(c, "SLUG_CONFLICT", `slug '${body.slug}' は既に使用されています`, 409);
    }

    const inserted = await db
      .insert(tags)
      .values({ slug: body.slug, name: body.name, description: body.description ?? null })
      .returning();

    const row = inserted[0];
    if (!row) return jsonError(c, "INTERNAL_ERROR", "タグの作成に失敗しました", 500);
    return c.json(toResponse(row), 201);
  });

  // PATCH /v1/tags/{slug} --------------------------------------------------------
  const updateRoute = createRoute({
    method: "patch",
    path: "/v1/tags/{slug}",
    summary: "タグを部分更新",
    tags: ["tags"],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ slug: z.string() }),
      body: { content: { "application/json": { schema: tagUpdateSchema } } },
    },
    responses: {
      200: { description: "更新後のタグ", content: { "application/json": { schema: tagResponseSchema } } },
      401: { description: "認証エラー" },
      404: { description: "見つからない" },
    },
  });

  app.openapi(updateRoute, async (c) => {
    const { slug } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = getDb(c.env);

    const existing = await db.select().from(tags).where(eq(tags.slug, slug)).get();
    if (!existing) return jsonError(c, "NOT_FOUND", `タグ '${slug}' が見つかりません`, 404);

    await db
      .update(tags)
      .set({
        name: body.name ?? existing.name,
        description: body.description === undefined ? existing.description : body.description,
      })
      .where(eq(tags.id, existing.id))
      .run();

    const updated = await db.select().from(tags).where(eq(tags.id, existing.id)).get();
    if (!updated) return jsonError(c, "INTERNAL_ERROR", "更新後のタグ取得に失敗しました", 500);
    return c.json(toResponse(updated), 200);
  });
}
