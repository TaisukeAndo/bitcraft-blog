import type { FC } from "hono/jsx";
import { mediaUrl } from "../lib/media-url";
import { formatDate, readingTimeLabel } from "../lib/format";
import { TagPill } from "./tag-pill";
import { ThumbPlaceholder } from "./thumb-placeholder";

export interface PostCardData {
  slug: string;
  title: string;
  excerpt: string | null;
  ogImageKey: string | null;
  publishedAt: string | null;
  readingTimeMin: number | null;
  tags: { slug: string; name: string }[];
}

export const PostCard: FC<{ post: PostCardData }> = ({ post }) => {
  const thumb = mediaUrl(post.ogImageKey);
  const reading = readingTimeLabel(post.readingTimeMin);

  return (
    // タグは別ページへのリンクのため、記事へのリンク<a>の中にネストさせない
    // （<a>の入れ子はHTML仕様違反）。カード全体をリンクにしつつ、タグ行だけ
    // article直下の兄弟要素として外に出す。
    <article class="post-card">
      <a class="post-card__link" href={`/posts/${post.slug}`}>
        <div class="post-card__thumb">
          {thumb ? <img src={thumb} alt="" width={640} height={360} loading="lazy" /> : <ThumbPlaceholder />}
        </div>
        <div class="post-card__body">
          <h3 class="post-card__title">{post.title}</h3>
          {post.excerpt ? <p class="post-card__excerpt">{post.excerpt}</p> : null}
          <div class="post-card__meta">
            {post.publishedAt ? <span>{formatDate(post.publishedAt)}</span> : null}
            {reading ? <span>{reading}</span> : null}
          </div>
        </div>
      </a>
      {post.tags.length > 0 ? (
        <div class="post-card__tags-wrap">
          <div class="post-card__tags">
            {post.tags.slice(0, 3).map((tag) => (
              <TagPill slug={tag.slug} name={tag.name} />
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
};
