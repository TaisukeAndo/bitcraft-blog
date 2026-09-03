import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import type { Bindings } from "../lib/bindings";

/** GET /v1/health。認証不要（middleware/auth.tsのPUBLIC_PATHS）。 */
export function registerHealthRoutes(app: OpenAPIHono<{ Bindings: Bindings }>) {
  const healthRoute = createRoute({
    method: "get",
    path: "/v1/health",
    summary: "ヘルスチェック（認証不要）",
    tags: ["meta"],
    responses: {
      200: {
        description: "OK",
        content: { "application/json": { schema: z.object({ status: z.literal("ok") }) } },
      },
    },
  });

  app.openapi(healthRoute, (c) => c.json({ status: "ok" as const }, 200));
}
