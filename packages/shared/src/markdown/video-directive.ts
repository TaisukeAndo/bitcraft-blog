import { visit } from "unist-util-visit";
import type { Plugin } from "unified";
import type { Root } from "mdast";

const PROVIDERS = new Set(["youtube", "vimeo"]);

/**
 * `::youtube{id="dQw4w9WgXcQ" title="..."}` / `::vimeo{id="76979871"}` という
 * remark-directive記法を、クリックで読み込むlite-facade用のプレースホルダーdivに
 * 変換するremarkプラグイン（実装プラン5章）。
 *
 * 本文中に生の<iframe>を書かせず、許可した記法だけを埋め込み可能にすることで
 * rehype-sanitizeの穴を作らない設計にしている。実際のiframe化・サムネイル表示は
 * apps/web側の共通スクリプト（[data-video-provider]をクリックで<iframe>に差し替える）
 * が担当する。
 */
export const remarkVideoDirective: Plugin<[], Root> = () => (tree) => {
  visit(tree, (node) => {
    if (
      node.type !== "textDirective" &&
      node.type !== "leafDirective" &&
      node.type !== "containerDirective"
    ) {
      return;
    }
    // TypeScriptの型上はmdastのDirective系ノードがunist-util-visitのVisitor型に
    // 明示的に含まれないため、実行時のプロパティアクセスはunknown経由で行う。
    const directive = node as unknown as {
      name: string;
      attributes?: Record<string, string | null | undefined>;
      data?: Record<string, unknown>;
    };
    if (!PROVIDERS.has(directive.name)) return;

    const id = directive.attributes?.id;
    if (!id) return;
    const title = directive.attributes?.title ?? "";

    // hastの慣習に合わせ、data-*属性はcamelCaseのプロパティ名で持たせる
    // （hast-util-to-htmlがdata-video-provider等のkebab-case属性名へ変換する。
    // rehype-sanitizeのスキーマ側もこのcamelCase表記でマッチさせる必要がある
    // ＝sanitize-schema.tsのdiv許可属性と対応させておくこと）。
    const data = directive.data ?? (directive.data = {});
    data.hName = "div";
    data.hProperties = {
      className: ["video-embed"],
      dataVideoProvider: directive.name,
      dataVideoId: id,
      dataVideoTitle: title,
    };
    data.hChildren = [];
  });
};
