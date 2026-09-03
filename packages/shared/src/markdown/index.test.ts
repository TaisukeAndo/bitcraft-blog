import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./index";

describe("renderMarkdown", () => {
  it("見出しをスラッグ化しTOCを抽出する", async () => {
    const result = await renderMarkdown("# はじめに\n\n本文。\n\n## 次の章\n\n続き。");
    expect(result.toc).toEqual([
      { depth: 1, text: "はじめに", id: expect.any(String) },
      { depth: 2, text: "次の章", id: expect.any(String) },
    ]);
    expect(result.html).toContain("<h1");
    expect(result.readingTimeMin).toBeGreaterThanOrEqual(1);
  });

  it("コードブロックにシンタックスハイライト用クラスを付与する", async () => {
    const result = await renderMarkdown("```ts\nconst x = 1;\n```");
    expect(result.html).toContain("hljs");
  });

  it("動画埋め込み記法をプレースホルダーdivへ変換する", async () => {
    const result = await renderMarkdown('::youtube{id="dQw4w9WgXcQ"}');
    expect(result.html).toContain('data-video-provider="youtube"');
    expect(result.html).toContain('data-video-id="dQw4w9WgXcQ"');
  });

  it("本文中の生HTMLは無効化される（remark-rehypeがrehype-rawを使わないため）", async () => {
    const result = await renderMarkdown('<script>alert(1)</script>\n\n本文');
    expect(result.html).not.toContain("<script>");
  });
});
