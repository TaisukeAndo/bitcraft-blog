import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import { and, eq, isNull } from "drizzle-orm";
import { apiKeys } from "@bitcraft/blog-db";
import type { Bindings } from "../lib/bindings";
import { getDb } from "../lib/db";
import { jsonError } from "./error-handler";

/** routes/api-keys.ts の発行・照合でも使う共通ハッシュ関数。 */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Authorization: Bearer <token> を検証する共通ロジック（実装計画3章・4章）。
 * トークンをSHA-256ハッシュ化し api_keys.key_hash と照合、revoked_at IS NULL
 * （失効していない）であれば有効と判定し、last_used_at をクリティカルパスを
 * ブロックしない非同期更新で反映する。
 *
 * 有効なら null を、無効なら401のResponseを返す。ブランケットミドルウェア
 * （下記authMiddleware）と GET /v1/auth/verify（routes/auth.ts。ブランケット
 * ミドルウェアの対象外パスなので、このヘルパーを自分で呼び直す）の両方から使う。
 */
export async function checkApiKey(c: Context<{ Bindings: Bindings }>): Promise<Response | null> {
  const header = c.req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) {
    return jsonError(c, "UNAUTHENTICATED", "Authorization: Bearer <token> ヘッダーが必要です", 401);
  }

  const tokenHash = await sha256Hex(token);
  const db = getDb(c.env);
  const row = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, tokenHash), isNull(apiKeys.revokedAt)))
    .get();

  if (!row) {
    return jsonError(c, "UNAUTHENTICATED", "APIキーが無効、または失効しています", 401);
  }

  // last_used_at の更新は認証のクリティカルパスをブロックしないよう非同期に行う。
  c.executionCtx.waitUntil(
    db.update(apiKeys).set({ lastUsedAt: new Date().toISOString() }).where(eq(apiKeys.id, row.id)).run(),
  );

  return null;
}

// ブランケットミドルウェアの対象外パス（完全一致）。
// - /v1/health: 認証を一切必要としないヘルスチェック
// - /v1/auth/verify: apps/mcpの事前ゲート専用。ここで一律401にしてしまうと
//   「トークンの有効性を確認する」という自身の役割を果たせないため、
//   ブランケットミドルウェアの外に出し、ハンドラ側でcheckApiKeyを呼び直して
//   有効/無効をそのままレスポンスにする（実装計画3章のGET /v1/auth/verify定義）。
// - /openapi.json, /docs: 社内向けAPIドキュメント。公開しても実害が薄いため
//   認証を課さない（実物bitcraft-cmsも同様の想定）。
const PUBLIC_PATHS = new Set(["/v1/health", "/v1/auth/verify", "/openapi.json", "/docs"]);

// - /v1/posts/{slug}/like・/unlike: サイト訪問者がapps/web経由（Service Binding、
//   実装プラン9章と同じ委譲パターン）でクリックする「いいね」ボタン用。CMS操作用の
//   Bearer認証を持たない匿名の一般訪問者からのリクエストのため認証対象外にする
//   （ユーザー指示により2026-09-04追加。routes/posts.ts参照）。
const PUBLIC_PATH_PATTERNS = [/^\/v1\/posts\/[^/]+\/(like|unlike)$/];

function isPublicPath(path: string): boolean {
  return (
    PUBLIC_PATHS.has(path) || path.startsWith("/docs/") || PUBLIC_PATH_PATTERNS.some((re) => re.test(path))
  );
}

/**
 * 全ルートに適用するブランケット認証ミドルウェア。src/index.tsでルート登録より先に
 * `app.use("*", authMiddleware)` として登録する。
 */
export const authMiddleware = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
  if (isPublicPath(c.req.path)) {
    await next();
    return;
  }

  const authError = await checkApiKey(c);
  if (authError) return authError;

  await next();
});
