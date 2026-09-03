import { visit } from "unist-util-visit";
import type { Plugin } from "unified";
import type { Root, Element } from "hast";

const HEADING_RE = /^h([1-6])$/;

/**
 * 本文中の見出しタグを1段シフトする（h1→h2, h2→h3, ...、h6はそのまま）。
 * 記事詳細ページ自体の<h1>は記事タイトル（pages/post-detail.tsx）が既に使っているため、
 * 本文側でMarkdownの`#`をそのまま<h1>として出力すると1ページに複数の<h1>が並んでしまう
 * （HTML的にもSEO的にも望ましくない）。実運用ではMCP経由の投稿者が`#`を本文の
 * 最上位見出しとして書く（実装当初これでbody_htmlが<h1>だらけになる不具合を実機で確認）
 * ため、Markdown側の記法は変えずレンダリング側でずらして解決する。
 *
 * TOC抽出（toc.ts）はこのシフトより前に行うこと。目次のインデント（depth）は
 * 見出しの見た目のHTMLタグではなく、著者が書いたMarkdown上の相対的な階層
 * （`#`=1, `##`=2, ...）をそのまま使いたいため。
 */
export const rehypeShiftHeadings: Plugin<[], Root> = () => (tree) => {
  visit(tree, "element", (node: Element) => {
    const match = HEADING_RE.exec(node.tagName);
    if (!match) return;
    const level = Number(match[1]);
    node.tagName = `h${Math.min(level + 1, 6)}`;
  });
};
