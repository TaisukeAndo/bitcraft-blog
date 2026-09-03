import type { FC } from "hono/jsx";
import type { TocEntry } from "@bitcraft/blog-shared";
import { BookSidebar, type BookSidebarChapter } from "../components/book-sidebar";
import { Badge } from "../components/tag-pill";
import { readingTimeLabel } from "../lib/format";

export interface ChapterPagerLink {
  slug: string;
  title: string;
}

export interface ChapterDetailPageProps {
  bookSlug: string;
  bookTitle: string;
  priceYen: number;
  pricingModel: "free" | "paid_planned";
  chapters: BookSidebarChapter[];
  currentChapterSlug: string;
  chapterTitle: string;
  chapterNumber: number;
  bodyHtml: string | null;
  toc: TocEntry[];
  readingTimeMin: number | null;
  isFreePreview: boolean;
  prevChapter: ChapterPagerLink | null;
  nextChapter: ChapterPagerLink | null;
}

// Bookチャプター本文ページ（実装プラン6章）。price_yen>0 かつ is_free_preview=false でも
// 決済ゲート未実装の現段階では閲覧を制限せず「有料予定」の告知のみ表示する
// （実装プラン2章「決済なしでの有料表現」）。
export const ChapterDetailPage: FC<ChapterDetailPageProps> = ({
  bookSlug,
  bookTitle,
  priceYen,
  pricingModel,
  chapters,
  currentChapterSlug,
  chapterTitle,
  chapterNumber,
  bodyHtml,
  toc,
  readingTimeMin,
  isFreePreview,
  prevChapter,
  nextChapter,
}) => {
  const reading = readingTimeLabel(readingTimeMin);
  const headingToc = toc.filter((entry) => entry.depth <= 3);
  const isFree = pricingModel === "free" || isFreePreview;
  const showsPaidNotice = pricingModel === "paid_planned" && !isFreePreview;

  return (
    <div class="book-layout">
      <BookSidebar
        bookSlug={bookSlug}
        bookTitle={bookTitle}
        priceYen={priceYen}
        pricingModel={pricingModel}
        chapters={chapters}
        currentChapterSlug={currentChapterSlug}
      />
      <main class="book-main">
        <nav class="article-header__breadcrumb" aria-label="パンくずリスト">
          <a href="/books">Book</a> / <a href={`/books/${bookSlug}`}>{bookTitle}</a> / <span>{chapterTitle}</span>
        </nav>

        <h1>
          <span class="book-sidebar__chapter-number">{String(chapterNumber).padStart(2, "0")}</span>{" "}
          {chapterTitle}
        </h1>
        <div class="article-meta">
          {isFree ? <Badge kind="free" /> : <Badge kind="paid" />}
          {reading ? <span>{reading}</span> : null}
        </div>

        {showsPaidNotice ? (
          <p class="book-cta__note">
            このチャプターは将来的に有料化を予定していますが、決済機能は未実装のため現時点ではどなたでも
            お読みいただけます。
          </p>
        ) : null}

        {headingToc.length > 0 ? (
          <details class="toc-sidebar toc-sidebar--inline" open>
            <summary class="toc-sidebar__title">目次</summary>
            <ol class="toc-list">
              {headingToc.map((entry) => (
                <li class={`toc-list__item toc-list__item--depth-${entry.depth}`}>
                  <a href={`#${entry.id}`}>{entry.text}</a>
                </li>
              ))}
            </ol>
          </details>
        ) : null}

        {bodyHtml ? (
          <div class="prose" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        ) : (
          <div class="prose">
            <p>このチャプターは現在準備中です。もうしばらくお待ちください。</p>
          </div>
        )}

        <nav class="chapter-pager" aria-label="前後の章">
          {prevChapter ? (
            <a class="chapter-pager__link" href={`/books/${bookSlug}/${prevChapter.slug}`}>
              <span class="chapter-pager__label">← 前の章</span>
              {prevChapter.title}
            </a>
          ) : (
            <span />
          )}
          {nextChapter ? (
            <a class="chapter-pager__link chapter-pager__link--next" href={`/books/${bookSlug}/${nextChapter.slug}`}>
              <span class="chapter-pager__label">次の章 →</span>
              {nextChapter.title}
            </a>
          ) : (
            <span />
          )}
        </nav>
      </main>
    </div>
  );
};
