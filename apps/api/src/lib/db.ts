import { createDb } from "@bitcraft/blog-db";
import type { Bindings } from "./bindings";

/** env.DB から drizzle クライアントを作る薄いヘルパー。各routeから共通で呼ぶ。 */
export function getDb(env: Bindings) {
  return createDb(env.DB);
}
