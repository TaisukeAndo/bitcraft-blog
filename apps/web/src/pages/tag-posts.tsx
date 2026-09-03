import type { FC } from "hono/jsx";
import { PostCard, type PostCardData } from "../components/post-card";
import { Pagination } from "../components/pagination";

export interface TagPostsPageProps {
  tagName: string;
  tagSlug: string;
  posts: PostCardData[];
  currentPage: number;
  totalPages: number;
}

export const TagPostsPage: FC<TagPostsPageProps> = ({
  tagName,
  tagSlug,
  posts,
  currentPage,
  totalPages,
}) => {
  return (
    <main class="page-container">
      <div class="page-header">
        <nav class="article-header__breadcrumb" aria-label="パンくずリスト">
          <a href="/">記事一覧</a> / <span>タグ: {tagName}</span>
        </nav>
        <h1>タグ: {tagName}</h1>
      </div>

      {posts.length === 0 ? (
        <p>このタグの記事はまだありません。</p>
      ) : (
        <div class="card-grid">
          {posts.map((post) => (
            <PostCard post={post} />
          ))}
        </div>
      )}

      <Pagination currentPage={currentPage} totalPages={totalPages} basePath={`/tags/${tagSlug}`} />
    </main>
  );
};
