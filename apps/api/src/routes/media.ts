import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { media } from "@bitcraft/blog-db";
import { mediaListQuerySchema, mediaUploadSchema } from "@bitcraft/blog-shared/schemas";
import { MEDIA_OWNER_TYPES } from "@bitcraft/blog-shared";
import type { Media } from "@bitcraft/blog-shared";
import type { Bindings } from "../lib/bindings";
import { getDb } from "../lib/db";
import { readImageDimensions } from "../lib/image-dimensions";
import { jsonError } from "../middleware/error-handler";

type MediaRow = typeof media.$inferSelect;

const mediaResponseSchema = z.object({
  id: z.number(),
  r2Key: z.string(),
  ownerType: z.enum(MEDIA_OWNER_TYPES),
  ownerSlug: z.string().nullable(),
  purpose: z.string().nullable(),
  contentType: z.string(),
  sizeBytes: z.number().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  altText: z.string().nullable(),
  createdAt: z.string(),
});

function toResponse(row: MediaRow): Media {
  return {
    id: row.id,
    r2Key: row.r2Key,
    ownerType: row.ownerType,
    ownerSlug: row.ownerSlug,
    purpose: row.purpose,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    width: row.width,
    height: row.height,
    altText: row.altText,
    createdAt: row.createdAt,
  };
}

/** R2オブジェクトキーを組み立てる。衝突しないようcrypto.randomUUID()を挟む。 */
function buildR2Key(input: { ownerType: string; ownerSlug?: string | undefined; filename: string }): string {
  const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  const id = crypto.randomUUID();
  const ownerPart = input.ownerSlug ? `${input.ownerSlug}/` : "";
  return `${input.ownerType}/${ownerPart}${id}-${safeName}`;
}

/** base64文字列をUint8Arrayへデコードする（Workersランタイムのグローバルatobを使う）。 */
function decodeBase64(dataBase64: string): Uint8Array {
  // data:URLのプレフィックス（例: "data:image/png;base64,..."）が付いていても剥がす。
  const commaIndex = dataBase64.indexOf(",");
  const raw = dataBase64.startsWith("data:") && commaIndex !== -1 ? dataBase64.slice(commaIndex + 1) : dataBase64;
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * メディア（画像等）のCRUD（実装プラン3章）。R2への実体保存とD1メタデータを
 * 常にセットで扱う。アップロードはdataBase64を受け取るJSON形式のみ対応する
 * （大容量ファイルはbase64膨張・Workersのリクエストサイズ上限の影響を受けやすいため、
 * 将来的にmultipart/直接PUTの経路を追加する余地は残すが今回はスコープ外）。
 */
export function registerMediaRoutes(app: OpenAPIHono<{ Bindings: Bindings }>) {
  // GET /v1/media ----------------------------------------------------------------
  const listRoute = createRoute({
    method: "get",
    path: "/v1/media",
    summary: "メディア一覧を取得（ownerType/ownerSlugでフィルタ）",
    tags: ["media"],
    security: [{ bearerAuth: [] }],
    request: { query: mediaListQuerySchema },
    responses: {
      200: { description: "メディア一覧", content: { "application/json": { schema: z.array(mediaResponseSchema) } } },
      401: { description: "認証エラー" },
    },
  });

  app.openapi(listRoute, async (c) => {
    const { ownerType, ownerSlug } = c.req.valid("query");
    const db = getDb(c.env);
    const conditions = [];
    if (ownerType) conditions.push(eq(media.ownerType, ownerType));
    if (ownerSlug) conditions.push(eq(media.ownerSlug, ownerSlug));
    const rows = await db
      .select()
      .from(media)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    return c.json(rows.map(toResponse), 200);
  });

  // POST /v1/media -----------------------------------------------------------------
  const uploadRoute = createRoute({
    method: "post",
    path: "/v1/media",
    summary: "メディアをアップロードする（dataBase64をR2へ保存しD1にメタデータを記録）",
    tags: ["media"],
    security: [{ bearerAuth: [] }],
    request: { body: { content: { "application/json": { schema: mediaUploadSchema } } } },
    responses: {
      201: { description: "アップロードしたメディア", content: { "application/json": { schema: mediaResponseSchema } } },
      401: { description: "認証エラー" },
    },
  });

  app.openapi(uploadRoute, async (c) => {
    const body = c.req.valid("json");
    const bytes = decodeBase64(body.dataBase64);
    const ownerType = body.ownerType ?? "misc";
    const r2Key = buildR2Key({ ownerType, ownerSlug: body.ownerSlug, filename: body.filename });

    await c.env.MEDIA.put(r2Key, bytes, { httpMetadata: { contentType: body.contentType } });

    const dimensions = body.contentType.startsWith("image/") ? readImageDimensions(bytes, body.contentType) : null;

    const db = getDb(c.env);
    const inserted = await db
      .insert(media)
      .values({
        r2Key,
        ownerType,
        ownerSlug: body.ownerSlug ?? null,
        purpose: body.purpose ?? null,
        contentType: body.contentType,
        sizeBytes: bytes.length,
        width: dimensions?.width ?? null,
        height: dimensions?.height ?? null,
        altText: body.altText ?? null,
      })
      .returning();

    const row = inserted[0];
    if (!row) {
      // D1書き込みに失敗した場合、R2に孤児オブジェクトを残さない。
      await c.env.MEDIA.delete(r2Key);
      return jsonError(c, "INTERNAL_ERROR", "メディアの登録に失敗しました", 500);
    }
    return c.json(toResponse(row), 201);
  });

  // DELETE /v1/media/{id} ------------------------------------------------------------
  const deleteRoute = createRoute({
    method: "delete",
    path: "/v1/media/{id}",
    summary: "メディアを削除する（R2の実体とD1メタデータの両方。?confirm=true必須）",
    tags: ["media"],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.coerce.number().int().positive() }),
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
    const { id } = c.req.valid("param");
    const { confirm } = c.req.valid("query");
    if (confirm !== "true") {
      return jsonError(c, "VALIDATION_ERROR", "削除には ?confirm=true の指定が必要です", 400);
    }

    const db = getDb(c.env);
    const existing = await db.select().from(media).where(eq(media.id, id)).get();
    if (!existing) return jsonError(c, "NOT_FOUND", `media id=${id} が見つかりません`, 404);

    await c.env.MEDIA.delete(existing.r2Key);
    await db.delete(media).where(eq(media.id, id)).run();
    return c.body(null, 204);
  });
}
