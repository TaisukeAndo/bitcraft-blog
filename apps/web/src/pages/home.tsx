import type { FC } from "hono/jsx";
import { PostCard, type PostCardData } from "../components/post-card";
import { Pagination } from "../components/pagination";

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
}

// 検索フォームはヘッダー（components/header.tsx）に集約したため、このページ自体は
// 持たない（ユーザー指示により2026-09-04変更）。広告も一覧ページには置かず記事詳細
// ページ内のみに限定する（実装プラン8章の方針をさらに絞り込み）。
export const HomePage: FC<HomePageProps> = ({ posts, currentPage, totalPages, popularTags, archive, query }) => {
  return (
    <main class="page-container">
      <div class="page-header">
        <h1>{query ? `「${query}」の検索結果` : "記事一覧"}</h1>
        <p>AIを学ぶ人のための技術記事とBookを配信しています。</p>
      </div>

      <div class="list-layout">
        <div>
          {posts.length === 0 ? (
            <p>該当する記事がありません。</p>
          ) : (
            <div class="card-grid">
              {posts.map((post) => (
                <PostCard post={post} />
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

        {popularTags.length > 0 || archive.length > 0 ? (
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
          </aside>
        ) : null}
      </div>
    </main>
  );
};
