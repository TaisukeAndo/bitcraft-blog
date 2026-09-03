import type { Context } from "hono";

// Cloudflare Cache APIの薄いラッパー（実装プラン7章「凝りすぎなくてよい」の通り、
// キーはrequest.url、TTLは短めでよい）。GET以外・エラーレスポンスはキャッシュしない。
export const CACHE_TTL_SECONDS = {
  list: 60 * 5, // 一覧・タグ別一覧
  detail: 60 * 10, // 記事・Book・チャプター詳細
  feed: 60 * 15, // sitemap.xml / rss.xml / robots.txt / ads.txt
} as const;

export async function withEdgeCache(
  c: Context,
  ttlSeconds: number,
  build: () => Promise<Response>,
): Promise<Response> {
  if (c.req.method !== "GET") {
    return build();
  }

  const cache = caches.default;
  const cacheKey = new Request(c.req.url, c.req.raw);

  const cached = await cache.match(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await build();
  if (response.status === 200) {
    const cacheable = new Response(response.body, response);
    cacheable.headers.set("Cache-Control", `public, max-age=${ttlSeconds}`);
    c.executionCtx.waitUntil(cache.put(cacheKey, cacheable.clone()));
    return cacheable;
  }
  return response;
}
