import { OpenAPIHono } from "@hono/zod-openapi";
import type { Bindings } from "./lib/bindings";
import { authMiddleware } from "./middleware/auth";
import { errorHandler, zodValidationHook } from "./middleware/error-handler";
import { registerApiKeyRoutes } from "./routes/api-keys";
import { registerAuthRoutes } from "./routes/auth";
import { registerBookRoutes } from "./routes/books";
import { registerChapterRoutes } from "./routes/chapters";
import { registerDocsRoutes } from "./routes/docs";
import { registerHealthRoutes } from "./routes/health";
import { registerMediaRoutes } from "./routes/media";
import { registerPostRoutes } from "./routes/posts";
import { registerTagRoutes } from "./routes/tags";

// bitcraft-blog CMS API のエントリポイント（実装プラン3章）。
// 全ルートに認証ミドルウェアを適用してからルートを登録する（PUBLIC_PATHSのみ
// middleware/auth.ts内で除外）。zodバリデーション失敗時は統一エラー形式
// （VALIDATION_ERROR）に変換し、個別routeで捕捉しなかった例外はerrorHandlerで
// 統一エラー形式に変換する（UNIQUE制約違反→SLUG_CONFLICT等）。
const app = new OpenAPIHono<{ Bindings: Bindings }>({ defaultHook: zodValidationHook });

app.use("*", authMiddleware);

registerHealthRoutes(app);
registerAuthRoutes(app);
registerPostRoutes(app);
registerTagRoutes(app);
registerBookRoutes(app);
registerChapterRoutes(app);
registerMediaRoutes(app);
registerApiKeyRoutes(app);
// /openapi.json・/docs はルート定義がすべて登録された後に生成する
// （OpenAPIHonoのopenAPIRegistryは登録順にスキーマを蓄積するため）。
registerDocsRoutes(app);

app.onError(errorHandler);

export default app;
