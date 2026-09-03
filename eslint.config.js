// @ts-check
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "**/dist/**",
      "**/.wrangler/**",
      "**/node_modules/**",
      "**/*.config.js",
      "**/.npm-cache/**",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // apps/web/public/js/*.js はビルドを通さずブラウザへ直接配信する素のクライアント
    // スクリプト（実装プラン6章・8章）。TypeScriptプロジェクトの外側にあるため
    // window/document等のDOMグローバルを明示的に許可する。
    files: ["apps/web/public/**/*.js"],
    languageOptions: {
      globals: globals.browser,
    },
  },
);
