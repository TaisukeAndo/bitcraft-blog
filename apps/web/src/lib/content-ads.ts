// bodyHtmlはapps/api側で事前レンダリング済みの安全なHTML文字列で、apps/webはこれを
// パースしない方針（実装プラン5章）。本文中に1箇所だけ広告枠を挟むため、DOM解析はせず
// 文字列としての "</p>" 境界（本文中央以降の最初の段落末尾）だけを目印に分割する。
// タグの入れ子を壊す位置では絶対に切らない（見つからなければ分割せず末尾広告のみにする）。
export function splitBodyForInlineAd(bodyHtml: string): { before: string; after: string | null } {
  const midpoint = Math.floor(bodyHtml.length / 2);
  const closingTag = "</p>";
  const idx = bodyHtml.indexOf(closingTag, midpoint);
  if (idx === -1) {
    return { before: bodyHtml, after: null };
  }
  const splitAt = idx + closingTag.length;
  return { before: bodyHtml.slice(0, splitAt), after: bodyHtml.slice(splitAt) };
}
