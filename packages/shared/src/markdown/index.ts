import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import type { RenderedMarkdown } from "../types";
import { type ImageDimensionResolver, rehypeEnhanceImages } from "./enhance-images";
import { estimateReadingTimeMin } from "./reading-time";
import { sanitizeSchema } from "./sanitize-schema";
import { rehypeShiftHeadings } from "./shift-headings";
import { rehypeExtractToc } from "./toc";
import { remarkVideoDirective } from "./video-directive";

export { type ImageDimensionResolver } from "./enhance-images";

export interface RenderMarkdownOptions {
  /** postsカードやOGPの`<img>`にwidth/height（CLS対策）を注入するための同期解決関数。
   * mediaテーブルの内容をapps/api側で事前にMap化して渡す想定。 */
  resolveImage?: ImageDimensionResolver;
}

/**
 * Markdown本文をこのCMSのデザインに沿ったHTMLへ変換する（実装プラン5章）。
 * apps/api の POST/PATCH /v1/posts, /v1/books/.../chapters からのみ呼ばれる
 * 「書き込み時レンダリング」。apps/webはこの結果（body_html/toc_json/reading_time_min）を
 * D1からSELECTするだけで、Markdownパースは行わない。
 *
 * パイプライン: remark-parse → remark-gfm → remark-directive(動画埋め込み記法)
 *   → remark-rehype(rehype-rawは使わない=本文中の生HTMLは無効化) → rehype-slug
 *   → rehype-highlight → 画像後処理 → rehype-sanitize → TOC抽出 → 見出しシフト
 *   → rehype-stringify
 *
 * TOC抽出をrehype-sanitizeの**後**に置いているのは意図的な設計（初期実装ではsanitize前に
 * 置いていたが、実機検証でtoc_jsonのidと実際のHTMLのid属性が一致しないバグを確認して
 * 修正した）。rehype-sanitizeの既定スキーマはDOM clobbering対策として見出しidに
 * `user-content-`プレフィックスを付与するため、sanitize前に抽出すると
 * TOCの`#id`リンクが本文中のidと食い違い、目次から見出しへジャンプできなくなる。
 *
 * 見出しシフト（shift-headings.ts）をTOC抽出の**後**に置いているのも同様に意図的。
 * ページの<h1>は記事タイトル（pages/post-detail.tsx）が既に使っているため、本文の
 * `#`（Markdown上の最上位見出し）はそのまま<h1>にせず<h2>にずらしてレンダリングする
 * （実機検証で1ページに<h1>が複数並ぶ不具合を確認して追加）。ただしtoc_jsonの
 * depthは著者が書いたMarkdown上の相対階層をそのまま表したいため、HTMLタグ名を
 * ずらす前の時点でTOCを抽出しておく。
 */
export async function renderMarkdown(
  markdown: string,
  options: RenderMarkdownOptions = {},
): Promise<RenderedMarkdown> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(remarkVideoDirective)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeHighlight, { detect: false })
    .use(rehypeEnhanceImages(options.resolveImage))
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeExtractToc)
    .use(rehypeShiftHeadings)
    .use(rehypeStringify);

  const file = await processor.process(markdown);

  return {
    html: String(file),
    toc: file.data.toc ?? [],
    readingTimeMin: estimateReadingTimeMin(markdown),
  };
}
