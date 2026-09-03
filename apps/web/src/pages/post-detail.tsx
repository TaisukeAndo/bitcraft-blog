import type { FC } from "hono/jsx";
import type { TocEntry } from "@bitcraft/blog-shared";
import { formatDate, readingTimeLabel } from "../lib/format";
import { TagPill } from "../components/tag-pill";
import { AdSlot } from "../components/ads/AdSlot";
import { splitBodyForInlineAd } from "../lib/content-ads";

export interface PostDetailPageProps {
  title: string;
  bodyHtml: string | null; // nullなら「準備中」のフォールバック表示（実装プラン5章の防御的取り扱い）
  toc: TocEntry[];
  publishedAt: string | null;
  authorName: string;
  readingTimeMin: number | null;
  tags: { slug: string; name: string }[];
  adsenseClientId?: string;
}

export const PostDetailPage: FC<PostDetailPageProps> = ({
  title,
  bodyHtml,
  toc,
  publishedAt,
  authorName,
  readingTimeMin,
  tags,
  adsenseClientId,
}) => {
  const reading = readingTimeLabel(readingTimeMin);
  const headingToc = toc.filter((entry) => entry.depth <= 3);

  return (
    <main class="article-layout">
      <div class="article-main">
        <div class="article-header">
          <nav class="article-header__breadcrumb" aria-label="パンくずリスト">
            <a href="/">記事一覧</a> / <span>{title}</span>
          </nav>
          <h1>{title}</h1>
          <div class="article-meta">
            <span>{authorName}</span>
            {publishedAt ? <span>{formatDate(publishedAt)}</span> : null}
            {reading ? <span>{reading}</span> : null}
          </div>
        </div>

        {bodyHtml ? (
          <>
            <div class="ad-slot-wrap">
              <AdSlot placement="in-article-top" adsenseClientId={adsenseClientId} />
            </div>
            {(() => {
              const { before, after } = splitBodyForInlineAd(bodyHtml);
              return (
                <>
                  <div class="prose" dangerouslySetInnerHTML={{ __html: before }} />
                  {after ? (
                    <>
                      <div class="ad-slot-wrap">
                        <AdSlot placement="in-article-bottom" adsenseClientId={adsenseClientId} lazy />
                      </div>
                      <div class="prose" dangerouslySetInnerHTML={{ __html: after }} />
                    </>
                  ) : null}
                </>
              );
            })()}
          </>
        ) : (
          <div class="prose">
            <p>この記事は現在準備中です。もうしばらくお待ちください。</p>
          </div>
        )}

        {tags.length > 0 ? (
          <div class="article-tags">
            {tags.map((tag) => (
              <TagPill slug={tag.slug} name={tag.name} />
            ))}
          </div>
        ) : null}
      </div>

      {headingToc.length > 0 ? (
        <aside class="toc-sidebar">
          <p class="toc-sidebar__title">目次</p>
          <ol class="toc-list">
            {headingToc.map((entry) => (
              <li class={`toc-list__item toc-list__item--depth-${entry.depth}`}>
                <a href={`#${entry.id}`}>{entry.text}</a>
              </li>
            ))}
          </ol>
        </aside>
      ) : null}
    </main>
  );
};
