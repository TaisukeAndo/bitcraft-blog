import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import { desc, eq } from "drizzle-orm";
import { apiKeys } from "@bitcraft/blog-db";
import { apiKeyCreateSchema } from "@bitcraft/blog-shared/schemas";
import type { ApiKeySummary } from "@bitcraft/blog-shared";
import type { Bindings } from "../lib/bindings";
import { sha256Hex } from "../middleware/auth";
import { getDb } from "../lib/db";
import { jsonError } from "../middleware/error-handler";

type ApiKeyRow = typeof apiKeys.$inferSelect;

const apiKeySummarySchema = z.object({
  id: z.number(),
  label: z.string(),
  keyPrefix: z.string(),
  scopes: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
});

const apiKeyCreateResponseSchema = apiKeySummarySchema.extend({
  // 生トークンはこの発行レスポンスの時だけ返す。以降はkeyHashしか保持しないため
  // 二度と表示できない（実装プラン2章・3章）。
  token: z.string(),
});

function toSummary(row: ApiKeyRow): ApiKeySummary {
  return {
    id: row.id,
    label: row.label,
    keyPrefix: row.keyPrefix,
    scopes: row.scopes,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
  };
}

/** `bcblog_<64桁hex>` 形式の生トークンを生成する（crypto.getRandomValuesで32byte分の乱数）。 */
function generateRawToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `bcblog_${hex}`;
}

/**
 * APIキーの発行・一覧・失効（実装プラン2章・3章）。
 * 最初の1本は `POST /v1/api-keys` 自体が認証必須のため卵と鶏の関係になる。
 * `wrangler d1 execute bitcraft-blog --remote` で直接INSERTしてブートストラップする
 * （実装プラン2章「初期投入」の通り。以降はこのエンドポイント経由で増発する）。
 */
export function registerApiKeyRoutes(app: OpenAPIHono<{ Bindings: Bindings }>) {
  // GET /v1/api-keys ---------------------------------------------------------------
  const listRoute = createRoute({
    method: "get",
    path: "/v1/api-keys",
    summary: "APIキー一覧を取得（生トークンは含まない）",
    tags: ["api-keys"],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: "APIキー一覧（作成日時降順）",
        content: { "application/json": { schema: z.array(apiKeySummarySchema) } },
      },
      401: { description: "認証エラー" },
    },
  });

  app.openapi(listRoute, async (c) => {
    const db = getDb(c.env);
    const rows = await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
    return c.json(rows.map(toSummary), 200);
  });

  // POST /v1/api-keys ----------------------------------------------------------------
  const createRouteDef = createRoute({
    method: "post",
    path: "/v1/api-keys",
    summary: "APIキーを新規発行する（レスポンスの token フィールドはこの時しか表示されない）",
    tags: ["api-keys"],
    security: [{ bearerAuth: [] }],
    request: { body: { content: { "application/json": { schema: apiKeyCreateSchema } } } },
    responses: {
      201: {
        description: "発行したAPIキー（生トークン付き）",
        content: { "application/json": { schema: apiKeyCreateResponseSchema } },
      },
      401: { description: "認証エラー" },
    },
  });

  app.openapi(createRouteDef, async (c) => {
    const body = c.req.valid("json");
    const token = generateRawToken();
    const keyHash = await sha256Hex(token);
    const keyPrefix = token.slice(0, 13);

    const db = getDb(c.env);
    const inserted = await db.insert(apiKeys).values({ label: body.label, keyHash, keyPrefix }).returning();

    const row = inserted[0];
    if (!row) return jsonError(c, "INTERNAL_ERROR", "APIキーの発行に失敗しました", 500);
    return c.json({ ...toSummary(row), token }, 201);
  });

  // POST /v1/api-keys/{id}/revoke -----------------------------------------------------
  const revokeRoute = createRoute({
    method: "post",
    path: "/v1/api-keys/{id}/revoke",
    summary: "APIキーを失効させる",
    tags: ["api-keys"],
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ id: z.coerce.number().int().positive() }) },
    responses: {
      200: { description: "失効後のAPIキー", content: { "application/json": { schema: apiKeySummarySchema } } },
      401: { description: "認証エラー" },
      404: { description: "見つからない" },
    },
  });

  app.openapi(revokeRoute, async (c) => {
    const { id } = c.req.valid("param");
    const db = getDb(c.env);
    const existing = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).get();
    if (!existing) return jsonError(c, "NOT_FOUND", `api key id=${id} が見つかりません`, 404);

    if (!existing.revokedAt) {
      await db.update(apiKeys).set({ revokedAt: new Date().toISOString() }).where(eq(apiKeys.id, id)).run();
    }

    const updated = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).get();
    if (!updated) return jsonError(c, "INTERNAL_ERROR", "失効後のAPIキー取得に失敗しました", 500);
    return c.json(toSummary(updated), 200);
  });
}
