import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import type { Bindings } from "../lib/bindings";
import { checkApiKey } from "../middleware/auth";

/**
 * GET /v1/auth/verify。apps/mcpの事前ゲート専用エンドポイント（実装計画3章）。
 * middleware/auth.tsのブランケットミドルウェアの対象外パスなので、ここで
 * checkApiKeyを呼び直し、通過したかどうかだけをJSONで返す。
 */
export function registerAuthRoutes(app: OpenAPIHono<{ Bindings: Bindings }>) {
  const verifyRoute = createRoute({
    method: "get",
    path: "/v1/auth/verify",
    summary: "APIキーの有効性を確認する（apps/mcpの事前ゲート専用）",
    tags: ["meta"],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: "有効なAPIキー",
        content: { "application/json": { schema: z.object({ valid: z.literal(true) }) } },
      },
      401: { description: "APIキーが無い、または無効・失効している" },
    },
  });

  app.openapi(verifyRoute, async (c) => {
    const authError = await checkApiKey(c);
    if (authError) return authError;
    return c.json({ valid: true as const }, 200);
  });
}
