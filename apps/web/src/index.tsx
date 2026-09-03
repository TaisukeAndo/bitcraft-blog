import { Hono } from "hono";
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { bookChapters, books, postTags, posts, tags } from "@bitcraft/blog-db";
import type { Bindings } from "./lib/bindings";
import { getDb } from "./lib/db";
import { withEdgeCache, CACHE_TTL_SECONDS } from "./lib/cache";
import { toIsoDate, toRfc822Date } from "./lib/format";
import { mediaUrl } from "./lib/media-url";
import { buildCanonicalUrl, SITE_NAME, SITE_ORIGIN } from "./lib/seo/meta";
import { blogPostingJsonLd, bookJsonLd, breadcrumbJsonLd, webSiteJsonLd } from "./lib/seo/jsonld";
import {
  ARCHIVE_MONTHS_LIMIT,
  POPULAR_TAGS_LIMIT,
  POSTS_PAGE_SIZE,
  RSS_ITEM_LIMIT,
  SITEMAP_URL_LIMIT,
} from "./lib/constants";
import { Layout, renderPage } from "./components/layout";
import { NotFoundPage } from "./components/not-found";
import { HomePage, type ArchiveMonth, type PopularTag } from "./pages/home";
import { PostDetailPage } from "./pages/post-detail";
import { TagPostsPage } from "./pages/tag-posts";
import { BookListPage } from "./pages/book-list";
import { BookDetailPage } from "./pages/book-detail";
import { ChapterDetailPage, type ChapterPagerLink } from "./pages/chapter-detail";
import type { BookSidebarChapter } from "./components/book-sidebar";
import type { PostCardData } from "./components/post-card";

// bitcraft-blog 公開サイトのエントリポイント（実装プラン7章・6章）。
// D1へはSELECTのみ（apps/apiが書き込みを一元管理。実装プラン1章）。
// .tsx（JSX構文）にしているのは、hono/jsxのFCを直接関数呼び出し
// （Layout({...})のような形）すると、JSXファクトリ経由で生成される
// JSX.Elementと型が一致せずrenderPage()に渡せないため（components/以下と
// 同じ<Component />構文で呼ぶ必要がある）。
const app = new Hono<{ Bindings: Bindings }>();

type TagRow = typeof tags.$inferSelect;
type PostRow = typeof posts.$inferSelect;

function toTagLite(row: TagRow): { slug: string; name: string } {
  return { slug: row.slug, name: row.name };
}

/** postTags経由でpostId群のタグ一覧をまとめて引く（N+1回避。apps/api routes/posts.tsと同じ発想）。 */
async function loadTagsByPostId(
  db: ReturnType<typeof getDb>,
  postIds: number[],
): Promise<Map<number, { slug: string; name: string }[]>> {
  const map = new Map<number, { slug: string; name: string }[]>();
  if (postIds.length === 0) return map;
  const rows = await db
    .select({ postId: postTags.postId, tag: tags })
    .from(postTags)
    .innerJoin(tags, eq(postTags.tagId, tags.id))
    .where(inArray(postTags.postId, postIds));
  for (const row of rows) {
    const list = map.get(row.postId) ?? [];
    list.push(toTagLite(row.tag));
    map.set(row.postId, list);
  }
  return map;
}

function toPostCard(row: PostRow, tagList: { slug: string; name: string }[]): PostCardData {
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    ogImageKey: row.ogImageKey,
    publishedAt: row.publishedAt,
    readingTimeMin: row.readingTimeMin,
    tags: tagList,
  };
}

function parseToc(tocJson: string | null): { depth: number; text: string; id: string }[] {
  if (!tocJson) return [];
  try {
    const parsed: unknown = JSON.parse(tocJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// GET / --------------------------------------------------------------------------
app.get("/", async (c) => {
  return withEdgeCache(c, CACHE_TTL_SECONDS.list, async () => {
    const db = getDb(c.env);
    const page = Math.max(1, Number(c.req.query("page") ?? "1") || 1);
    const q = c.req.query("q")?.trim() || undefined;
    const month = c.req.query("month")?.trim() || undefined;
    const limit = POSTS_PAGE_SIZE;
    const offset = (page - 1) * limit;

    const conditions = [eq(posts.status, "published")];
    if (q) {
      conditions.push(
        or(like(posts.title, `%${q}%`), like(posts.excerpt, `%${q}%`)) ?? sql`1=1`,
      );
    }
    if (month) {
      conditions.push(sql`substr(${posts.publishedAt}, 1, 7) = ${month}`);
    }
    const whereClause = and(...conditions);

    const rows = await db
      .select()
      .from(posts)
      .where(whereClause)
      .orderBy(desc(posts.publishedAt))
      .limit(limit)
      .offset(offset);
    const totalRow = await db.select({ count: sql<number>`count(*)` }).from(posts).where(whereClause).get();
    const total = totalRow?.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const tagsByPostId = await loadTagsByPostId(db, rows.map((r) => r.id));
    const postCards = rows.map((row) => toPostCard(row, tagsByPostId.get(row.id) ?? []));

    const popularTagRows = await db
      .select({ slug: tags.slug, name: tags.name, count: sql<number>`count(*)` })
      .from(postTags)
      .innerJoin(tags, eq(postTags.tagId, tags.id))
      .innerJoin(posts, eq(postTags.postId, posts.id))
      .where(eq(posts.status, "published"))
      .groupBy(tags.id)
      .orderBy(desc(sql`count(*)`))
      .limit(POPULAR_TAGS_LIMIT);
    const popularTags: PopularTag[] = popularTagRows.map((r) => ({ slug: r.slug, name: r.name, count: r.count }));

    const archiveRows = await db
      .select({ month: sql<string>`substr(${posts.publishedAt}, 1, 7)`, count: sql<number>`count(*)` })
      .from(posts)
      .where(eq(posts.status, "published"))
      .groupBy(sql`substr(${posts.publishedAt}, 1, 7)`)
      .orderBy(desc(sql`substr(${posts.publishedAt}, 1, 7)`))
      .limit(ARCHIVE_MONTHS_LIMIT);
    const archive: ArchiveMonth[] = archiveRows
      .filter((r) => r.month)
      .map((r) => ({ month: r.month, count: r.count }));

    const jsonLd = page === 1 && !q && !month ? [webSiteJsonLd()] : [];

    return c.html(
      renderPage(
        <Layout
          title={q ? `「${q}」の検索結果` : "記事一覧"}
          description="AIを学ぶ人のための技術記事とBookを配信しています。"
          canonicalPath="/"
          adsenseClientId={c.env.ADSENSE_CLIENT_ID}
          jsonLd={jsonLd}
        >
          <HomePage
            posts={postCards}
            currentPage={page}
            totalPages={totalPages}
            popularTags={popularTags}
            archive={archive}
            query={q}
            adsenseClientId={c.env.ADSENSE_CLIENT_ID}
          />
        </Layout>,
      ),
    );
  });
});

// GET /posts/:slug -----------------------------------------------------------------
app.get("/posts/:slug", async (c) => {
  return withEdgeCache(c, CACHE_TTL_SECONDS.detail, async () => {
    const slug = c.req.param("slug");
    const db = getDb(c.env);
    const row = await db.select().from(posts).where(and(eq(posts.slug, slug), eq(posts.status, "published"))).get();
    if (!row) return c.notFound();

    const tagsByPostId = await loadTagsByPostId(db, [row.id]);
    const postTagList = tagsByPostId.get(row.id) ?? [];
    const toc = parseToc(row.tocJson);
    const ogImagePath = mediaUrl(row.ogImageKey);
    const ogImageAbsolute = ogImagePath ? `${SITE_ORIGIN}${ogImagePath}` : null;

    const jsonLd = [
      breadcrumbJsonLd([
        { name: "記事一覧", path: "/" },
        { name: row.title, path: `/posts/${row.slug}` },
      ]),
      blogPostingJsonLd({
        title: row.title,
        description: row.metaDescription,
        canonicalPath: `/posts/${row.slug}`,
        publishedAt: toIsoDate(row.publishedAt),
        updatedAt: toIsoDate(row.updatedAt) ?? row.updatedAt,
        authorName: row.authorName,
        image: ogImageAbsolute,
        tagNames: postTagList.map((t) => t.name),
      }),
    ];

    return c.html(
      renderPage(
        <Layout
          title={row.title}
          description={row.metaDescription}
          keywords={row.metaKeywords}
          canonicalPath={`/posts/${row.slug}`}
          canonicalUrlOverride={row.canonicalUrl}
          ogType="article"
          ogImage={ogImageAbsolute}
          noindex={row.noindex || !row.bodyHtml}
          jsonLd={jsonLd}
          adsenseClientId={c.env.ADSENSE_CLIENT_ID}
        >
          <PostDetailPage
            title={row.title}
            bodyHtml={row.bodyHtml}
            toc={toc}
            publishedAt={row.publishedAt}
            authorName={row.authorName}
            readingTimeMin={row.readingTimeMin}
            tags={postTagList}
            adsenseClientId={c.env.ADSENSE_CLIENT_ID}
          />
        </Layout>,
      ),
    );
  });
});

// GET /tags/:slug --------------------------------------------------------------------
app.get("/tags/:slug", async (c) => {
  return withEdgeCache(c, CACHE_TTL_SECONDS.list, async () => {
    const slug = c.req.param("slug");
    const db = getDb(c.env);
    const tag = await db.select().from(tags).where(eq(tags.slug, slug)).get();
    if (!tag) return c.notFound();

    const page = Math.max(1, Number(c.req.query("page") ?? "1") || 1);
    const limit = POSTS_PAGE_SIZE;
    const offset = (page - 1) * limit;

    const linkRows = await db.select({ postId: postTags.postId }).from(postTags).where(eq(postTags.tagId, tag.id));
    const postIds = linkRows.map((r) => r.postId);

    let rows: PostRow[] = [];
    let total = 0;
    if (postIds.length > 0) {
      const whereClause = and(eq(posts.status, "published"), inArray(posts.id, postIds));
      rows = await db
        .select()
        .from(posts)
        .where(whereClause)
        .orderBy(desc(posts.publishedAt))
        .limit(limit)
        .offset(offset);
      const totalRow = await db.select({ count: sql<number>`count(*)` }).from(posts).where(whereClause).get();
      total = totalRow?.count ?? 0;
    }
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const tagsByPostId = await loadTagsByPostId(db, rows.map((r) => r.id));
    const postCards = rows.map((row) => toPostCard(row, tagsByPostId.get(row.id) ?? []));

    return c.html(
      renderPage(
        <Layout
          title={`タグ: ${tag.name}`}
          description={tag.description ?? `「${tag.name}」タグが付いた記事一覧です。`}
          canonicalPath={`/tags/${tag.slug}`}
          adsenseClientId={c.env.ADSENSE_CLIENT_ID}
          jsonLd={[
            breadcrumbJsonLd([
              { name: "記事一覧", path: "/" },
              { name: `タグ: ${tag.name}`, path: `/tags/${tag.slug}` },
            ]),
          ]}
        >
          <TagPostsPage
            tagName={tag.name}
            tagSlug={tag.slug}
            posts={postCards}
            currentPage={page}
            totalPages={totalPages}
          />
        </Layout>,
      ),
    );
  });
});

// GET /books ---------------------------------------------------------------------
app.get("/books", async (c) => {
  return withEdgeCache(c, CACHE_TTL_SECONDS.list, async () => {
    const db = getDb(c.env);
    const rows = await db.select().from(books).where(eq(books.status, "published")).orderBy(desc(books.publishedAt));

    return c.html(
      renderPage(
        <Layout
          title="Book"
          description="まとまった分量で学べる長編コンテンツです。"
          canonicalPath="/books"
          adsenseClientId={c.env.ADSENSE_CLIENT_ID}
          jsonLd={[breadcrumbJsonLd([{ name: "記事一覧", path: "/" }, { name: "Book", path: "/books" }])]}
        >
          <BookListPage books={rows} />
        </Layout>,
      ),
    );
  });
});

/** book_chaptersをBookSidebar/JSON-LD向けの共通形式に変換する（公開済みのみ、chapterNumber昇順）。 */
async function loadPublishedChapters(db: ReturnType<typeof getDb>, bookId: number, pricingModel: "free" | "paid_planned") {
  const rows = await db
    .select()
    .from(bookChapters)
    .where(and(eq(bookChapters.bookId, bookId), eq(bookChapters.status, "published")))
    .orderBy(bookChapters.chapterNumber);
  const sidebarChapters: BookSidebarChapter[] = rows.map((r) => ({
    slug: r.slug,
    chapterNumber: r.chapterNumber,
    title: r.title,
    isFree: pricingModel === "free" || r.isFreePreview,
  }));
  return { rows, sidebarChapters };
}

// GET /books/:slug -----------------------------------------------------------------
app.get("/books/:slug", async (c) => {
  return withEdgeCache(c, CACHE_TTL_SECONDS.detail, async () => {
    const slug = c.req.param("slug");
    const db = getDb(c.env);
    const book = await db.select().from(books).where(and(eq(books.slug, slug), eq(books.status, "published"))).get();
    if (!book) return c.notFound();

    const { rows, sidebarChapters } = await loadPublishedChapters(db, book.id, book.pricingModel);
    const coverPath = mediaUrl(book.coverImageKey);
    const coverAbsolute = coverPath ? `${SITE_ORIGIN}${coverPath}` : null;

    return c.html(
      renderPage(
        <Layout
          title={book.title}
          description={book.metaDescription}
          keywords={book.metaKeywords}
          canonicalPath={`/books/${book.slug}`}
          ogImage={coverAbsolute}
          adsenseClientId={c.env.ADSENSE_CLIENT_ID}
          jsonLd={[
            breadcrumbJsonLd([{ name: "Book", path: "/books" }, { name: book.title, path: `/books/${book.slug}` }]),
            bookJsonLd({
              title: book.title,
              summary: book.summary,
              canonicalPath: `/books/${book.slug}`,
              image: coverAbsolute,
              priceYen: book.priceYen,
              pricingModel: book.pricingModel,
              chapters: rows.map((r) => ({ title: r.title, path: `/books/${book.slug}/${r.slug}`, position: r.chapterNumber })),
            }),
          ]}
        >
          <BookDetailPage
            slug={book.slug}
            title={book.title}
            summary={book.summary}
            coverImageKey={book.coverImageKey}
            priceYen={book.priceYen}
            pricingModel={book.pricingModel}
            chapters={sidebarChapters}
          />
        </Layout>,
      ),
    );
  });
});

// GET /books/:slug/:chapterSlug ------------------------------------------------------
app.get("/books/:slug/:chapterSlug", async (c) => {
  return withEdgeCache(c, CACHE_TTL_SECONDS.detail, async () => {
    const slug = c.req.param("slug");
    const chapterSlug = c.req.param("chapterSlug");
    const db = getDb(c.env);
    const book = await db.select().from(books).where(and(eq(books.slug, slug), eq(books.status, "published"))).get();
    if (!book) return c.notFound();

    const { rows, sidebarChapters } = await loadPublishedChapters(db, book.id, book.pricingModel);
    const index = rows.findIndex((r) => r.slug === chapterSlug);
    if (index === -1) return c.notFound();
    const chapter = rows[index];
    if (!chapter) return c.notFound();

    const prevRow = index > 0 ? rows[index - 1] : undefined;
    const nextRow = index < rows.length - 1 ? rows[index + 1] : undefined;
    const prevChapter: ChapterPagerLink | null = prevRow ? { slug: prevRow.slug, title: prevRow.title } : null;
    const nextChapter: ChapterPagerLink | null = nextRow ? { slug: nextRow.slug, title: nextRow.title } : null;
    const toc = parseToc(chapter.tocJson);

    return c.html(
      renderPage(
        <Layout
          title={`${chapter.title} - ${book.title}`}
          description={book.metaDescription}
          canonicalPath={`/books/${book.slug}/${chapter.slug}`}
          adsenseClientId={c.env.ADSENSE_CLIENT_ID}
          // 準備中（bodyHtml未生成）の章のみnoindexにする。決済ゲートが無いため
          // 有料予定チャプターも実際には閲覧できる＝isFreePreviewの値では出し分けない
          // （実装プラン2章・7章の防御的取り扱い方針）。
          noindex={!chapter.bodyHtml}
          jsonLd={[
            breadcrumbJsonLd([
              { name: "Book", path: "/books" },
              { name: book.title, path: `/books/${book.slug}` },
              { name: chapter.title, path: `/books/${book.slug}/${chapter.slug}` },
            ]),
          ]}
        >
          <ChapterDetailPage
            bookSlug={book.slug}
            bookTitle={book.title}
            priceYen={book.priceYen}
            pricingModel={book.pricingModel}
            chapters={sidebarChapters}
            currentChapterSlug={chapter.slug}
            chapterTitle={chapter.title}
            chapterNumber={chapter.chapterNumber}
            bodyHtml={chapter.bodyHtml}
            toc={toc}
            readingTimeMin={chapter.readingTimeMin}
            isFreePreview={chapter.isFreePreview}
            prevChapter={prevChapter}
            nextChapter={nextChapter}
          />
        </Layout>,
      ),
    );
  });
});

// GET /media/:key（R2実体の配信。owner配下のスラッシュを含むキーに対応するため正規表現パラメータを使う） --
app.get("/media/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const object = await c.env.MEDIA.get(key);
  if (!object) return c.notFound();

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
});

// GET /sitemap.xml -------------------------------------------------------------------
app.get("/sitemap.xml", async (c) => {
  return withEdgeCache(c, CACHE_TTL_SECONDS.feed, async () => {
    const db = getDb(c.env);
    const postRows = await db
      .select({ slug: posts.slug, updatedAt: posts.updatedAt })
      .from(posts)
      .where(eq(posts.status, "published"))
      .limit(SITEMAP_URL_LIMIT);
    const tagRows = await db.select({ slug: tags.slug }).from(tags).limit(SITEMAP_URL_LIMIT);
    const bookRows = await db
      .select({ slug: books.slug, updatedAt: books.updatedAt })
      .from(books)
      .where(eq(books.status, "published"))
      .limit(SITEMAP_URL_LIMIT);
    const chapterRows = await db
      .select({ bookSlug: books.slug, slug: bookChapters.slug, updatedAt: bookChapters.updatedAt })
      .from(bookChapters)
      .innerJoin(books, eq(bookChapters.bookId, books.id))
      .where(and(eq(bookChapters.status, "published"), eq(books.status, "published")))
      .limit(SITEMAP_URL_LIMIT);

    const urls: { loc: string; lastmod?: string | null }[] = [
      { loc: buildCanonicalUrl("/") },
      { loc: buildCanonicalUrl("/books") },
      ...postRows.map((r) => ({ loc: buildCanonicalUrl(`/posts/${r.slug}`), lastmod: toIsoDate(r.updatedAt) })),
      ...tagRows.map((r) => ({ loc: buildCanonicalUrl(`/tags/${r.slug}`) })),
      ...bookRows.map((r) => ({ loc: buildCanonicalUrl(`/books/${r.slug}`), lastmod: toIsoDate(r.updatedAt) })),
      ...chapterRows.map((r) => ({
        loc: buildCanonicalUrl(`/books/${r.bookSlug}/${r.slug}`),
        lastmod: toIsoDate(r.updatedAt),
      })),
    ];

    const body =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls
        .map((u) => `  <url>\n    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}\n  </url>`)
        .join("\n") +
      "\n</urlset>\n";

    return c.body(body, 200, { "Content-Type": "application/xml; charset=UTF-8" });
  });
});

// GET /robots.txt ----------------------------------------------------------------
app.get("/robots.txt", async (c) => {
  return withEdgeCache(c, CACHE_TTL_SECONDS.feed, async () => {
    const body = `User-agent: *\nAllow: /\n\nSitemap: ${buildCanonicalUrl("/sitemap.xml")}\n`;
    return c.body(body, 200, { "Content-Type": "text/plain; charset=UTF-8" });
  });
});

// GET /ads.txt -------------------------------------------------------------------
app.get("/ads.txt", async (c) => {
  return withEdgeCache(c, CACHE_TTL_SECONDS.feed, async () => {
    // AdSense本格導入（実装プラン12章Phase4）まではプレースホルダー。
    // env.ADSENSE_CLIENT_ID（"pub-xxxxxxxxxxxxxxxx"形式）を設定すると自動的に
    // 標準行を書き出す。
    const clientId = c.env.ADSENSE_CLIENT_ID;
    const body = clientId
      ? `google.com, ${clientId}, DIRECT, f08c47fec0942fa0\n`
      : "# AdSense未導入のため ads.txt は未設定です（実装プラン8章・Phase4）。\n";
    return c.body(body, 200, { "Content-Type": "text/plain; charset=UTF-8" });
  });
});

// GET /rss.xml -------------------------------------------------------------------
app.get("/rss.xml", async (c) => {
  return withEdgeCache(c, CACHE_TTL_SECONDS.feed, async () => {
    const db = getDb(c.env);
    const rows = await db
      .select()
      .from(posts)
      .where(eq(posts.status, "published"))
      .orderBy(desc(posts.publishedAt))
      .limit(RSS_ITEM_LIMIT);

    // 全文配信はしない（実装プラン7章）。抜粋（excerpt）とリンクのみ。
    const items = rows
      .map((r) => {
        const link = buildCanonicalUrl(`/posts/${r.slug}`);
        const pubDate = toRfc822Date(r.publishedAt);
        return (
          "  <item>\n" +
          `    <title>${escapeXml(r.title)}</title>\n` +
          `    <link>${link}</link>\n` +
          `    <guid>${link}</guid>\n` +
          (pubDate ? `    <pubDate>${pubDate}</pubDate>\n` : "") +
          (r.excerpt ? `    <description>${escapeXml(r.excerpt)}</description>\n` : "") +
          "  </item>"
        );
      })
      .join("\n");

    const body =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<rss version="2.0">\n' +
      "<channel>\n" +
      `  <title>${escapeXml(SITE_NAME)}</title>\n` +
      `  <link>${SITE_ORIGIN}</link>\n` +
      "  <description>AIを学ぶ人のための技術記事とBookを配信しています。</description>\n" +
      `${items}\n` +
      "</channel>\n</rss>\n";

    return c.body(body, 200, { "Content-Type": "application/rss+xml; charset=UTF-8" });
  });
});

function escapeXml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

app.notFound((c) => {
  return c.html(
    renderPage(
      <Layout
        title="ページが見つかりません"
        description="お探しのページは移動または削除された可能性があります。"
        canonicalPath={c.req.path}
        noindex
      >
        <NotFoundPage />
      </Layout>,
    ),
    404,
  );
});

export default app;
