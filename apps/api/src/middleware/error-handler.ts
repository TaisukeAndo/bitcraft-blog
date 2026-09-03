import type { Hook } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ApiErrorBody } from "@bitcraft/blog-shared";

type ErrorCode = ApiErrorBody["error"]["code"];

/** apps/api全体で統一するエラーレスポンス形式（実装プラン3章）を組み立てる。 */
export function buildApiError(code: ErrorCode, message: string, details?: unknown): ApiErrorBody {
  return details === undefined ? { error: { code, message } } : { error: { code, message, details } };
}

/** `buildApiError`をそのままJSONレスポンスとして返す共通ヘルパー。各routeから呼ぶ。 */
export function jsonError(
  c: Context,
  code: ErrorCode,
  message: string,
  status: ContentfulStatusCode,
  details?: unknown,
) {
  return c.json(buildApiError(code, message, details), status);
}

/**
 * `new OpenAPIHono({ defaultHook })` に渡すバリデーションフック。
 * query/param/json のzodバリデーション失敗時、Honoの生のZodError形式ではなく
 * 統一エラー形式（VALIDATION_ERROR）に変換する。
 */
// Hook<T, E, P, R>のT/E/Pは`OpenAPIHonoOptions.defaultHook`自体が`Hook<any, E, any, any>`で
// 受ける汎用フックのため、個別ルートの型を持たない（@hono/zod-openapiの型定義に合わせる）。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const zodValidationHook: Hook<any, any, any, Response | undefined> = (result, c) => {
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "入力内容に誤りがあります";
    return c.json(buildApiError("VALIDATION_ERROR", message, result.error.issues), 400);
  }
  return undefined;
};

const UNIQUE_CONSTRAINT_RE = /unique constraint failed/i;

/**
 * `app.onError()` に渡す最終防衛ライン。route内で個別にハンドリングしなかった例外
 * （代表例: D1のUNIQUE制約違反）を統一エラー形式に変換する。slug/keyの重複は
 * SLUG_CONFLICTとして扱う（book_chapters等、slug以外のUNIQUE列でも同じ意味合いのため）。
 */
export function errorHandler(err: unknown, c: Context): Response {
  const message = err instanceof Error ? err.message : String(err);

  if (UNIQUE_CONSTRAINT_RE.test(message)) {
    return jsonError(c, "SLUG_CONFLICT", "指定されたslugまたはキーは既に使用されています", 409, { message });
  }

  console.error("[bitcraft-blog-api] unhandled error", err);
  return jsonError(c, "INTERNAL_ERROR", "サーバー内部でエラーが発生しました", 500);
}
