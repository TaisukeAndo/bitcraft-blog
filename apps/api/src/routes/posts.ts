import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { postTags, posts, tags } from "@bitcraft/blog-db";
import { postCreateSchema, postListQuerySchema, postUpdateSchema } from "@bitcraft/blog-shared/schemas";
import { POST_STATUSES } from "@bitcraft/blog-shared";
import type { Post, Tag } from "@bitcraft/blog-shared";
import { renderMarkdown } from "@bitcraft/blog-shared/markdown";
import type { Bindings } from "../lib/bindings";
import { getDb } from "../lib/db";
import { jsonError } from "../middleware/error-handler";

type PostRow = typeof posts.$inferSelect;
type TagRow = typeof tags.$inferSelect;
type Db = ReturnType<typeof getDb>;

const tocEntrySchema = z.object({ depth: z.number(), text: z.string(), id: z.string() });

const tagResponseSchema = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string(),
});

const postResponseSchema = z.object({
  id: z.number(),
  slug: z.string(),
  title: z.string(),
  excerpt: z.string().nullable(),
  bodyMd: z.string(),
  bodyHtml: z.string().nullable(),
  toc: z.array(tocEntrySchema),
  readingTimeMin: z.number().nullable(),
  status: z.enum(POST_STATUSES),
  publishedAt: z.string().nullable(),
  authorName: z.string(),
  ogImageKey: z.string().nullable(),
  metaDescription: z.string(),
  metaKeywords: z.string().nullable(),
  canonicalUrl: z.string().nullable(),
  noindex: z.boolean(),
  likeCount: z.number(),
  tags: z.array(tagResponseSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const postListResponseSchema = z.object({
  items: z.array(postResponseSchema),
  page: z.number(),
  limit: z.number(),
  total: z.number(),
});

function parseToc(tocJson: string | null): Post["toc"] {
  if (!tocJson) return [];
  try {
    const parsed: unknown = JSON.parse(tocJson);
    return Array.isArray(parsed) ? (parsed as Post["toc"]) : [];
  } catch {
    return [];
  }
}

function toTagResponse(row: TagRow): Tag {
  return { id: row.id, slug: row.slug, name: row.name, description: row.description, createdAt: row.createdAt };
}

function toPostResponse(row: PostRow, tagList: Tag[]): Post {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    bodyMd: row.bodyMd,
    bodyHtml: row.bodyHtml,
    toc: parseToc(row.tocJson),
    readingTimeMin: row.readingTimeMin,
    status: row.status,
    publishedAt: row.publishedAt,
    authorName: row.authorName,
    ogImageKey: row.ogImageKey,
    metaDescription: row.metaDescription,
    metaKeywords: row.metaKeywords,
    canonicalUrl: row.canonicalUrl,
    noindex: row.noindex,
    likeCount: row.likeCount,
    tags: tagList,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** postTags経由でpostId群のタグ一覧をまとめて引く（N+1回避）。 */
async function loadTagsByPostId(db: Db, postIds: number[]): Promise<Map<number, Tag[]>> {
  const map = new Map<number, Tag[]>();
  if (postIds.length === 0) return map;

  const rows = await db
    .select({ postId: postTags.postId, tag: tags })
    .from(postTags)
    .innerJoin(tags, eq(postTags.tagId, tags.id))
    .where(inArray(postTags.postId, postIds));

  for (const row of rows) {
    const list = map.get(row.postId) ?? [];
    list.push(toTagResponse(row.tag));
    map.set(row.postId, list);
  }
  return map;
}

/**
 * tagSlugs（POST/PATCH bodyの配列）からtags.idの配列を解決する。
 * 存在しないslugが含まれる場合はVALIDATION_ERRORのResponseを返す
 * （タグは事前にPOST /v1/tagsで作っておく前提で、ここでは自動作成しない）。
 */
async function resolveTagIds(
  db: Db,
  slugs: string[],
  c: Context<{ Bindings: Bindings }>,
): Promise<number[] | Response> {
  if (slugs.length === 0) return [];

  const rows = await db.select({ id: tags.id, slug: tags.slug }).from(tags).where(inArray(tags.slug, slugs));
  const idBySlug = new Map(rows.map((r) => [r.slug, r.id]));
  const missing = slugs.filter((s) => !idBySlug.has(s));
  if (missing.length > 0) {
    return jsonError(
      c,
      "VALIDATION_ERROR",
      `存在しないタグslugが含まれています: ${missing.join(", ")}（先にPOST /v1/tagsで作成してください）`,
      400,
    );
  }
  return slugs.map((s) => idBySlug.get(s) as number);
}

// posts CRUD + publish/rerender（実装計画3章・5章）。
// bodyMdの保存時（POST/PATCH/rerender）に必ずrenderMarkdownを呼び、
// bodyHtml/tocJson/readingTimeMinを同期させる。apps/webはこの結果をSELECTするだけ。
export function registerPostRoutes(app: OpenAPIHono<{ Bindings: Bindings }>) {
  // GET /v1/posts ----------------------------------------------------------------
  const listRoute = createRoute({
    method: "get",
    path: "/v1/posts",
    summary: "記事一覧を取得（status/tag/page/limitでフィルタ・ページング）",
    tags: ["posts"],
    security: [{ bearerAuth: [] }],
    request: { query: postListQuerySchema },
    responses: {
      200: { description: "記事一覧", content: { "application/json": { schema: postListResponseSchema } } },
      401: { description: "認証エラー" },
    },
  });

  app.openapi(listRoute, async (c) => {
    const { status, tag, page, limit } = c.req.valid("query");
    const pageNum = page ?? 1;
    const limitNum = limit ?? 20;
    const offset = (pageNum - 1) * limitNum;
    const db = getDb(c.env);

    let postIdFilter: number[] | null = null;
    if (tag) {
      const tagRow = await db.select({ id: tags.id }).from(tags).where(eq(tags.slug, tag)).get();
      if (!tagRow) {
        return c.json({ items: [], page: pageNum, limit: limitNum, total: 0 }, 200);
      }
      const linkRows = await db.select({ postId: postTags.postId }).from(postTags).where(eq(postTags.tagId, tagRow.id));
      postIdFilter = linkRows.map((r) => r.postId);
      if (postIdFilter.length === 0) {
        return c.json({ items: [], page: pageNum, limit: limitNum, total: 0 }, 200);
      }
    }

    const conditions = [];
    if (status) conditions.push(eq(posts.status, status));
    if (postIdFilter) conditions.push(inArray(posts.id, postIdFilter));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select()
      .from(posts)
      .where(whereClause)
      .orderBy(desc(posts.createdAt))
      .limit(limitNum)
      .offset(offset);
    const totalRow = await db
      .select({ count: sql<number>`count(*)` })
      .from(posts)
      .where(whereClause)
      .get();

    const tagsByPostId = await loadTagsByPostId(db, rows.map((r) => r.id));
    const items = rows.map((row) => toPostResponse(row, tagsByPostId.get(row.id) ?? []));

    return c.json({ items, page: pageNum, limit: limitNum, total: totalRow?.count ?? 0 }, 200);
  });

  // POST /v1/posts -----------------------------------------------------------------
  const createRouteDef = createRoute({
    method: "post",
    path: "/v1/posts",
    summary: "記事を新規作成",
    tags: ["posts"],
    security: [{ bearerAuth: [] }],
    request: { body: { content: { "application/json": { schema: postCreateSchema } } } },
    responses: {
      201: { description: "作成した記事", content: { "application/json": { schema: postResponseSchema } } },
      400: { description: "バリデーションエラー（存在しないtagSlugsを含む場合など）" },
      401: { description: "認証エラー" },
      409: { description: "同じslugの記事が既に存在する" },
    },
  });

  app.openapi(createRouteDef, async (c) => {
    const body = c.req.valid("json");
    const db = getDb(c.env);

    const existing = await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, body.slug)).get();
    if (existing) return jsonError(c, "SLUG_CONFLICT", `slug '${body.slug}' は既に使用されています`, 409);

    const tagIdsOrError = await resolveTagIds(db, body.tagSlugs ?? [], c);
    if (tagIdsOrError instanceof Response) return tagIdsOrError;

    const rendered = await renderMarkdown(body.bodyMd);
    const status = body.status ?? "draft";

    const inserted = await db
      .insert(posts)
      .values({
        slug: body.slug,
        title: body.title,
        excerpt: body.excerpt ?? null,
        bodyMd: body.bodyMd,
        bodyHtml: rendered.html,
        tocJson: JSON.stringify(rendered.toc),
        readingTimeMin: rendered.readingTimeMin,
        status,
        // status="published"で新規作成された場合もpublished_atを設定する
        // （publishRouteを経由しない一発公開のケース。この分岐が無いと
        // 「公開済みなのにpublished_atがnull」のまま残るバグになる。実機で確認・修正）。
        ...(status === "published" ? { publishedAt: new Date().toISOString() } : {}),
        ...(body.authorName !== undefined ? { authorName: body.authorName } : {}),
        ogImageKey: body.ogImageKey ?? null,
        metaDescription: body.metaDescription,
        metaKeywords: body.metaKeywords ?? null,
        canonicalUrl: body.canonicalUrl ?? null,
        ...(body.noindex !== undefined ? { noindex: body.noindex } : {}),
      })
      .returning();

    const row = inserted[0];
    if (!row) return jsonError(c, "INTERNAL_ERROR", "記事の作成に失敗しました", 500);

    if (tagIdsOrError.length > 0) {
      await db.insert(postTags).values(tagIdsOrError.map((tagId) => ({ postId: row.id, tagId }))).run();
    }

    const tagsByPostId = await loadTagsByPostId(db, [row.id]);
    return c.json(toPostResponse(row, tagsByPostId.get(row.id) ?? []), 201);
  });

  // GET /v1/posts/{slug} -------------------------------------------------------------
  const getRoute = createRoute({
    method: "get",
    path: "/v1/posts/{slug}",
    summary: "記事を1件取得",
    tags: ["posts"],
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ slug: z.string() }) },
    responses: {
      200: { description: "記事", content: { "application/json": { schema: postResponseSchema } } },
      401: { description: "認証エラー" },
      404: { description: "見つからない" },
    },
  });

  app.openapi(getRoute, async (c) => {
    const { slug } = c.req.valid("param");
    const db = getDb(c.env);
    const row = await db.select().from(posts).where(eq(posts.slug, slug)).get();
    if (!row) return jsonError(c, "NOT_FOUND", `post '${slug}' が見つかりません`, 404);

    const tagsByPostId = await loadTagsByPostId(db, [row.id]);
    return c.json(toPostResponse(row, tagsByPostId.get(row.id) ?? []), 200);
  });

  // PATCH /v1/posts/{slug} -----------------------------------------------------------
  const updateRoute = createRoute({
    method: "patch",
    path: "/v1/posts/{slug}",
    summary: "記事を部分更新（渡したキーだけ更新する）",
    tags: ["posts"],
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ slug: z.string() }),
      body: { content: { "application/json": { schema: postUpdateSchema } } },
    },
    responses: {
      200: { description: "更新後の記事", content: { "application/json": { schema: postResponseSchema } } },
      400: { description: "バリデーションエラー" },
      401: { description: "認証エラー" },
      404: { description: "見つからない" },
    },
  });

  app.openapi(updateRoute, async (c) => {
    const { slug } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = getDb(c.env);

    const existing = await db.select().from(posts).where(eq(posts.slug, slug)).get();
    if (!existing) return jsonError(c, "NOT_FOUND", `post '${slug}' が見つかりません`, 404);

    let tagIds: number[] | undefined;
    if (body.tagSlugs !== undefined) {
      const resolved = await resolveTagIds(db, body.tagSlugs, c);
      if (resolved instanceof Response) return resolved;
      tagIds = resolved;
    }

    let bodyHtml = existing.bodyHtml;
    let tocJson = existing.tocJson;
    let readingTimeMin = existing.readingTimeMin;
    if (body.bodyMd !== undefined) {
      const rendered = await renderMarkdown(body.bodyMd);
      bodyHtml = rendered.html;
      tocJson = JSON.stringify(rendered.toc);
      readingTimeMin = rendered.readingTimeMin;
    }

    const nextStatus = body.status ?? existing.status;
    // PATCHでstatusをpublishedへ変更した際もpublished_atが未設定なら設定する
    // （post_publishを経由しない直接更新のケース。posts作成時と同じ理由の修正）。
    const nextPublishedAt =
      nextStatus === "published" && !existing.publishedAt ? new Date().toISOString() : existing.publishedAt;

    await db
      .update(posts)
      .set({
        title: body.title ?? existing.title,
        excerpt: body.excerpt === undefined ? existing.excerpt : body.excerpt,
        bodyMd: body.bodyMd ?? existing.bodyMd,
        bodyHtml,
        tocJson,
        readingTimeMin,
        status: nextStatus,
        publishedAt: nextPublishedAt,
        authorName: body.authorName ?? existing.authorName,
        ogImageKey: body.ogImageKey === undefined ? existing.ogImageKey : body.ogImageKey,
        metaDescription: body.metaDescription ?? existing.metaDescription,
        metaKeywords: body.metaKeywords === undefined ? existing.metaKeywords : body.metaKeywords,
        canonicalUrl: body.canonicalUrl === undefined ? existing.canonicalUrl : body.canonicalUrl,
        noindex: body.noindex ?? existing.noindex,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(posts.id, existing.id))
      .run();

    if (tagIds !== undefined) {
      // tagSlugsが渡された場合はpostTagsを洗い替える（実装計画3章）。
      await db.delete(postTags).where(eq(postTags.postId, existing.id)).run();
      if (tagIds.length > 0) {
        await db.insert(postTags).values(tagIds.map((tagId) => ({ postId: existing.id, tagId }))).run();
      }
    }

    const updated = await db.select().from(posts).where(eq(posts.id, existing.id)).get();
    if (!updated) return jsonError(c, "INTERNAL_ERROR", "更新後のpost取得に失敗しました", 500);
    const tagsByPostId = await loadTagsByPostId(db, [updated.id]);
    return c.json(toPostResponse(updated, tagsByPostId.get(updated.id) ?? []), 200);
  });

  // DELETE /v1/posts/{slug} ----------------------------------------------------------
  const deleteRoute = createRoute({
    method: "delete",
    path: "/v1/posts/{slug}",
    summary: "記事を削除（?confirm=true必須）",
    tags: ["posts"],
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
    const existing = await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, slug)).get();
    if (!existing) return jsonError(c, "NOT_FOUND", `post '${slug}' が見つかりません`, 404);

    // post_tagsはON DELETE CASCADEで自動削除される（packages/db/src/schema.ts）。
    await db.delete(posts).where(eq(posts.id, existing.id)).run();
    return c.body(null, 204);
  });

  // POST /v1/posts/{slug}/publish -----------------------------------------------------
  const publishRoute = createRoute({
    method: "post",
    path: "/v1/posts/{slug}/publish",
    summary: "記事を公開する（draft/archived→published）",
    tags: ["posts"],
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ slug: z.string() }) },
    responses: {
      200: { description: "公開後の記事", content: { "application/json": { schema: postResponseSchema } } },
      401: { description: "認証エラー" },
      404: { description: "見つからない" },
    },
  });

  app.openapi(publishRoute, async (c) => {
    const { slug } = c.req.valid("param");
    const db = getDb(c.env);
    const existing = await db.select().from(posts).where(eq(posts.slug, slug)).get();
    if (!existing) return jsonError(c, "NOT_FOUND", `post '${slug}' が見つかりません`, 404);

    await db
      .update(posts)
      .set({
        status: "published",
        // 既にpublishedAtがある（再公開）場合は最初の公開日時を保持する。
        publishedAt: existing.publishedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(posts.id, existing.id))
      .run();

    const updated = await db.select().from(posts).where(eq(posts.id, existing.id)).get();
    if (!updated) return jsonError(c, "INTERNAL_ERROR", "公開後のpost取得に失敗しました", 500);
    const tagsByPostId = await loadTagsByPostId(db, [updated.id]);
    return c.json(toPostResponse(updated, tagsByPostId.get(updated.id) ?? []), 200);
  });

  // POST /v1/posts/{slug}/rerender ----------------------------------------------------
  const rerenderRoute = createRoute({
    method: "post",
    path: "/v1/posts/{slug}/rerender",
    summary: "保存済みbodyMdからbodyHtml/tocJson/readingTimeMinを再生成する（本文は変えない）",
    tags: ["posts"],
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ slug: z.string() }) },
    responses: {
      200: { description: "再レンダリング後の記事", content: { "application/json": { schema: postResponseSchema } } },
      401: { description: "認証エラー" },
      404: { description: "見つからない" },
    },
  });

  app.openapi(rerenderRoute, async (c) => {
    const { slug } = c.req.valid("param");
    const db = getDb(c.env);
    const existing = await db.select().from(posts).where(eq(posts.slug, slug)).get();
    if (!existing) return jsonError(c, "NOT_FOUND", `post '${slug}' が見つかりません`, 404);

    const rendered = await renderMarkdown(existing.bodyMd);
    await db
      .update(posts)
      .set({
        bodyHtml: rendered.html,
        tocJson: JSON.stringify(rendered.toc),
        readingTimeMin: rendered.readingTimeMin,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(posts.id, existing.id))
      .run();

    const updated = await db.select().from(posts).where(eq(posts.id, existing.id)).get();
    if (!updated) return jsonError(c, "INTERNAL_ERROR", "再レンダリング後のpost取得に失敗しました", 500);
    const tagsByPostId = await loadTagsByPostId(db, [updated.id]);
    return c.json(toPostResponse(updated, tagsByPostId.get(updated.id) ?? []), 200);
  });

  // POST /v1/posts/{slug}/like・/unlike -------------------------------------------------
  // Zenn風の「ハート」ボタン用（実装プラン7章に追記、ユーザー指示により2026-09-04追加）。
  // サイト訪問者（CMS操作用のBearerトークンを持たない匿名ユーザー）がapps/web経由
  // （Service Binding、実装プラン9章と同じ委譲パターン）で叩くため、
  // middleware/auth.tsのPUBLIC_PATH_PATTERNSで認証対象外にしている。
  // 同一ブラウザからの多重カウントはapps/web側（localStorageでのトグル管理、
  // public/js/article-actions.js）で防ぐ想定で、サーバー側は素朴な加減算のみ行う。
  const likeResponseSchema = z.object({ likeCount: z.number() });

  const likeRoute = createRoute({
    method: "post",
    path: "/v1/posts/{slug}/like",
    summary: "記事のいいね数を1増やす（認証不要・サイト訪問者向け）",
    tags: ["posts"],
    request: { params: z.object({ slug: z.string() }) },
    responses: {
      200: { description: "更新後のいいね数", content: { "application/json": { schema: likeResponseSchema } } },
      404: { description: "見つからない、または公開されていない" },
    },
  });

  app.openapi(likeRoute, async (c) => {
    const { slug } = c.req.valid("param");
    const db = getDb(c.env);
    const existing = await db
      .select({ id: posts.id, status: posts.status })
      .from(posts)
      .where(eq(posts.slug, slug))
      .get();
    if (!existing || existing.status !== "published") {
      return jsonError(c, "NOT_FOUND", `post '${slug}' が見つかりません`, 404);
    }

    await db
      .update(posts)
      .set({ likeCount: sql`${posts.likeCount} + 1` })
      .where(eq(posts.id, existing.id))
      .run();
    const updated = await db.select({ likeCount: posts.likeCount }).from(posts).where(eq(posts.id, existing.id)).get();
    return c.json({ likeCount: updated?.likeCount ?? 0 }, 200);
  });

  const unlikeRoute = createRoute({
    method: "post",
    path: "/v1/posts/{slug}/unlike",
    summary: "記事のいいね数を1減らす（0未満にはしない。認証不要・サイト訪問者向け）",
    tags: ["posts"],
    request: { params: z.object({ slug: z.string() }) },
    responses: {
      200: { description: "更新後のいいね数", content: { "application/json": { schema: likeResponseSchema } } },
      404: { description: "見つからない、または公開されていない" },
    },
  });

  app.openapi(unlikeRoute, async (c) => {
    const { slug } = c.req.valid("param");
    const db = getDb(c.env);
    const existing = await db
      .select({ id: posts.id, status: posts.status })
      .from(posts)
      .where(eq(posts.slug, slug))
      .get();
    if (!existing || existing.status !== "published") {
      return jsonError(c, "NOT_FOUND", `post '${slug}' が見つかりません`, 404);
    }

    await db
      .update(posts)
      .set({ likeCount: sql`max(${posts.likeCount} - 1, 0)` })
      .where(eq(posts.id, existing.id))
      .run();
    const updated = await db.select({ likeCount: posts.likeCount }).from(posts).where(eq(posts.id, existing.id)).get();
    return c.json({ likeCount: updated?.likeCount ?? 0 }, 200);
  });
}
