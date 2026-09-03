import { swaggerUI } from "@hono/swagger-ui";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Bindings } from "../lib/bindings";

/**
 * /openapi.json（OpenAPI 3.1仕様のJSON）と /docs（Swagger UI）。
 * どちらも認証不要（middleware/auth.tsのPUBLIC_PATHS。社内向けドキュメントだが
 * 公開しても実害が薄いため、実物bitcraft-cmsと同じ想定。実装計画3章）。
 */
export function registerDocsRoutes(app: OpenAPIHono<{ Bindings: Bindings }>) {
  app.doc("/openapi.json", {
    openapi: "3.1.0",
    info: {
      title: "bitcraft-blog CMS API",
      version: "0.0.0",
      description:
        "blog.bitcraft.work のMarkdown入稿・タグ・Book/チャプター・メディア・APIキーを操作するCMS API。" +
        "運用はapps/mcp（Claude経由）からの呼び出しを主とする。",
    },
  });

  app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    description: "api_keysテーブルで管理するAPIトークン。GET /v1/health のみ認証不要。",
  });

  app.get("/docs", swaggerUI({ url: "/openapi.json" }));
}
