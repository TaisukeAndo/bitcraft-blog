// wrangler.jsonc の rules（Text module）により、.cssファイルはビルド不要のまま
// 文字列としてimportできる（実装プラン6章）。apps/web はこの文字列を <style> タグへ
// そのまま埋め込んで配信し、PostCSS/Tailwind等の別ビルドステップを持たない。
declare module "*.css" {
  const content: string;
  export default content;
}
