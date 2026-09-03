import type { FC } from "hono/jsx";
import { Badge } from "./tag-pill";

export interface BookSidebarChapter {
  slug: string;
  chapterNumber: number;
  title: string;
  isFree: boolean; // isFreePreview===true か、book.pricingModel==="free" のとき true
}

export interface BookSidebarProps {
  bookSlug: string;
  bookTitle: string;
  priceYen: number;
  pricingModel: "free" | "paid_planned";
  chapters: BookSidebarChapter[];
  currentChapterSlug?: string; // 未指定ならBook詳細ページ扱い
}

// Book閲覧の左固定階層サイドバー（実装プラン6章）。/books/:slug と
// /books/:slug/:chapterSlug の両方から共通で使う。
export const BookSidebar: FC<BookSidebarProps> = ({
  bookSlug,
  bookTitle,
  priceYen,
  pricingModel,
  chapters,
  currentChapterSlug,
}) => {
  return (
    <aside class="book-sidebar">
      <div class="book-sidebar__header">
        <h2 class="book-sidebar__title">
          <a href={`/books/${bookSlug}`}>{bookTitle}</a>
        </h2>
        <div class="book-sidebar__price">
          {pricingModel === "free" ? (
            <Badge kind="free" />
          ) : (
            <>
              <Badge kind="paid" />
              <strong>¥{priceYen.toLocaleString("ja-JP")}</strong>
            </>
          )}
        </div>
      </div>
      <ol class="book-sidebar__chapters">
        {chapters.map((chapter) => (
          <li
            class={`book-sidebar__chapter${
              chapter.slug === currentChapterSlug ? " book-sidebar__chapter--current" : ""
            }`}
          >
            <a href={`/books/${bookSlug}/${chapter.slug}`}>
              <span class="book-sidebar__chapter-number">
                {String(chapter.chapterNumber).padStart(2, "0")}
              </span>
              <span>{chapter.title}</span>
              {chapter.isFree ? (
                <span class="badge badge--free">無料</span>
              ) : (
                <span class="badge badge--paid">有料予定</span>
              )}
            </a>
          </li>
        ))}
      </ol>
    </aside>
  );
};
