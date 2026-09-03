import { createDb } from "@bitcraft/blog-db";
import type { Bindings } from "./bindings";

// apps/web はD1に対して読み取り専用で使う（SELECTのみ。書き込み・マイグレーション適用は
// apps/api側が担う）。createDb(d1) はpackages/db側の実装済みヘルパーをそのまま流用する。
export function getDb(env: Bindings) {
  return createDb(env.DB);
}
