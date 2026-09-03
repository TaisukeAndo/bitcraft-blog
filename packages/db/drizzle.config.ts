import { defineConfig } from "drizzle-kit";

// `pnpm --filter @bitcraft/blog-db generate` でこのファイルを起点に
// src/schema.ts と migrations/ 配下の差分からマイグレーションSQLを生成する。
// wrangler側の migrations_dir（apps/api/wrangler.jsonc）と同じディレクトリを指すこと。
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema.ts",
  out: "./migrations",
});
