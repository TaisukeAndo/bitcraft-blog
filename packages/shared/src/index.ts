// 軽量なエントリポイント。型・定数のみを公開し、zod（./schemas）や
// remark/rehype一式（./markdown）は含めない。apps/web・apps/mcpはこちらだけを使う
// ことで、Markdownパース関連の重い依存をバンドルに含めない（実装プラン5章）。
export * from "./constants";
export * from "./types";
