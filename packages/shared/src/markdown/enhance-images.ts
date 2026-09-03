import { visit } from "unist-util-visit";
import type { Plugin } from "unified";
import type { Root, Element, ElementContent } from "hast";

export interface ImageDimensions {
  width?: number;
  height?: number;
}

/** `src`（R2で配信するURL）から既知の寸法を引く同期関数。apps/api側がmediaテーブルの
 * 内容から事前にMapを作り、`(src) => map.get(src)` の形で渡すことを想定する
 * （packages/shared自体はD1に触れない、実装プラン5章）。 */
export type ImageDimensionResolver = (src: string) => ImageDimensions | undefined;

/**
 * <img>にwidth/height（CLS対策、実装プラン8章）・loading="lazy"・decoding="async"を
 * 付与し、altがあれば<figure><figcaption>で包むrehypeプラグイン。
 */
export function rehypeEnhanceImages(resolveImage?: ImageDimensionResolver): Plugin<[], Root> {
  return () => (tree) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName !== "img" || !parent || index === undefined) return;

      const src = typeof node.properties?.src === "string" ? node.properties.src : undefined;
      const alt = typeof node.properties?.alt === "string" ? node.properties.alt : "";
      const dims = src ? resolveImage?.(src) : undefined;

      node.properties = {
        ...node.properties,
        loading: "lazy",
        decoding: "async",
        ...(dims?.width ? { width: dims.width } : {}),
        ...(dims?.height ? { height: dims.height } : {}),
      };

      if (!alt) return;

      const figcaption: Element = {
        type: "element",
        tagName: "figcaption",
        properties: {},
        children: [{ type: "text", value: alt }],
      };
      const figure: Element = {
        type: "element",
        tagName: "figure",
        properties: { className: ["post-image"] },
        children: [node, figcaption],
      };
      (parent.children as ElementContent[])[index] = figure;
    });
  };
}
