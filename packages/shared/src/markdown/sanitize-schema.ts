import { defaultSchema } from "rehype-sanitize";
import type { Schema } from "hast-util-sanitize";

/**
 * rehype-sanitizeの既定スキーマ（GitHub相当）は安全側に倒してid・class・data-*属性の
 * ほとんどを落とす。TOCのアンカーリンク・シンタックスハイライトのクラス・動画埋め込み
 * プレースホルダーのdata属性はこのCMSの表示に必須のため、その分だけ明示的に許可を
 * 追加する（実装プラン5章）。生の<iframe>・<script>・on*イベント属性はここでも
 * 一切許可しない＝MCP経由でLLMが生成した文字列を安全側に倒すための境界。
 */
export const sanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "figure", "figcaption"],
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "className"],
    h1: [...(defaultSchema.attributes?.h1 ?? []), "id"],
    h2: [...(defaultSchema.attributes?.h2 ?? []), "id"],
    h3: [...(defaultSchema.attributes?.h3 ?? []), "id"],
    h4: [...(defaultSchema.attributes?.h4 ?? []), "id"],
    h5: [...(defaultSchema.attributes?.h5 ?? []), "id"],
    h6: [...(defaultSchema.attributes?.h6 ?? []), "id"],
    code: [...(defaultSchema.attributes?.code ?? []), ["className", /^language-/, /^hljs/]],
    span: [...(defaultSchema.attributes?.span ?? []), ["className", /^hljs/]],
    img: [
      ...(defaultSchema.attributes?.img ?? []),
      "width",
      "height",
      "loading",
      "decoding",
    ],
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      "dataVideoProvider",
      "dataVideoId",
      "dataVideoTitle",
    ],
  },
};
