import { toString } from "hast-util-to-string";
import { visit } from "unist-util-visit";
import type { Plugin } from "unified";
import type { Root, Element } from "hast";
import type { TocEntry } from "../types";

const HEADING_RE = /^h([1-6])$/;

declare module "vfile" {
  interface DataMap {
    toc: TocEntry[];
  }
}

/**
 * rehype-sanitizeの後段で使う前提のrehypeプラグイン。見出し要素(h1-h6)を集めて
 * file.data.toc に書き出す（実装プラン5章）。**rehype-sanitizeより後**に置くこと。
 * rehype-sanitizeの既定スキーマはDOM clobbering対策で見出しidに
 * `user-content-`プレフィックスを付与するため、sanitize前に抽出すると
 * toc_jsonのidと実際に描画されるHTMLのid属性が食い違う（markdown/index.tsのコメント参照）。
 */
export const rehypeExtractToc: Plugin<[], Root> = () => (tree, file) => {
  const toc: TocEntry[] = [];
  visit(tree, "element", (node: Element) => {
    const match = HEADING_RE.exec(node.tagName);
    if (!match) return;
    const id = typeof node.properties?.id === "string" ? node.properties.id : "";
    if (!id) return;
    toc.push({ depth: Number(match[1]), text: toString(node), id });
  });
  file.data.toc = toc;
};
