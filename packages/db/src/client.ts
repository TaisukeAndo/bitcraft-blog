import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDb>;

/**
 * D1Databaseバインディングからdrizzleクライアントを作る。
 * apps/web（SELECT専用）・apps/api（読み書き）の両方から使う共通ヘルパー。
 */
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}
