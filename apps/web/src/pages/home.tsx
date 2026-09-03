import type { FC } from "hono/jsx";
import { PostCard, type PostCardData } from "../components/post-card";
import { Pagination } from "../components/pagination";
import { AdSlot } from "../components/ads/AdSlot";

export interface PopularTag {
  slug: string;
  name: string;
  count: number;
}

export interface ArchiveMonth {
  month: string; // "2026-08"
  count: number;
}

export interface HomePageProps {
  posts: PostCardData[];
  currentPage: number;
  totalPages: number;
  popularTags: PopularTag[];
  archive: ArchiveMonth[];
  query?: string;
  adsenseClientId?: string;
}

// 数件ごとにネイティブ風広告カードを挟む間隔（実装プラン8章）。
const AD_CARD_INTERVAL = 6;

export const HomePage: FC<HomePageProps> = ({
  posts,
  currentPage,
  totalPages,
  popularTags,
  archive,
  query,
  adsenseClientId,
}) => {
  return (
    <main class="page-container">
      <div class="page-header">
        <h1>{query ? `「${query}」の検索結果` : "記事一覧"}</h1>
        <p>AIを学ぶ人のための技術記事とBookを配信しています。</p>
        <form class="search-form" method="get" action="/">
          <input
            type="search"
            name="q"
            value={query ?? ""}
            placeholder="記事を検索"
            aria-label="記事を検索"
          />
          <button type="submit">検索</button>
        </form>
      </div>

      <div class="list-layout">
        <div>
          {posts.length === 0 ? (
            <p>該当する記事がありません。</p>
          ) : (
            <div class="card-grid">
              {posts.map((post, index) => (
                <>
                  <PostCard post={post} />
                  {(index + 1) % AD_CARD_INTERVAL === 0 && index !== posts.length - 1 ? (
                    <div class="post-card post-card--ad">
                      <AdSlot placement="list-native" adsenseClientId={adsenseClientId} lazy />
                    </div>
                  ) : null}
                </>
              ))}
            </div>
          )}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            basePath="/"
            extraQuery={query ? { q: query } : undefined}
          />
        </div>

        <aside class="list-sidebar">
          {popularTags.length > 0 ? (
            <div class="list-sidebar__section">
              <h2>人気タグ</h2>
              <div class="list-sidebar__tags">
                {popularTags.map((tag) => (
                  <a class="tag-pill tag-pill--count" href={`/tags/${tag.slug}`} data-count={`(${tag.count})`}>
                    {tag.name}
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          {archive.length > 0 ? (
            <div class="list-sidebar__section">
              <h2>アーカイブ</h2>
              <ul class="list-sidebar__archive">
                {archive.map((entry) => (
                  <li>
                    <a href={`/?month=${entry.month}`}>
                      {entry.month.replace("-", "年")}月（{entry.count}）
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div class="ad-slot-wrap ad-slot-wrap--sidebar">
            <AdSlot placement="sidebar" adsenseClientId={adsenseClientId} lazy />
          </div>
        </aside>
      </div>
    </main>
  );
};
