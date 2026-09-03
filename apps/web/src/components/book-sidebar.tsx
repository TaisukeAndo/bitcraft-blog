import type { FC } from "hono/jsx";
import { mediaUrl } from "../lib/media-url";
import { ThumbPlaceholder } from "./thumb-placeholder";

export interface BookSidebarChapter {
  slug: string;
  chapterNumber: number;
  title: string;
}

export interface BookSidebarProps {
  bookSlug: string;
  bookTitle: string;
  coverImageKey: string | null;
  chapters: BookSidebarChapter[];
  currentChapterSlug?: string; // 未指定ならBook詳細ページ扱い（現状はchapter-detail.tsxのみが利用）
}

// Bookチャプター本文ページ（chapter-detail.tsx）の左固定階層サイドバー。
// 無料/有料の表記はBook詳細ページ（book-detail.tsx）にのみ出す方針のため、
// ここでは価格・バッジ類を一切表示しない（Zennの本トップ/読書ページの出し分けに
// 合わせた。ユーザー指示により2026-09-04変更）。
export const BookSidebar: FC<BookSidebarProps> = ({
  bookSlug,
  bookTitle,
  coverImageKey,
  chapters,
  currentChapterSlug,
}) => {
  const cover = mediaUrl(coverImageKey);

  return (
    <aside class="book-sidebar">
      <div class="book-sidebar__header">
        <a class="book-sidebar__book" href={`/books/${bookSlug}`}>
          <div class="book-sidebar__cover">
            {cover ? (
              <img src={cover} alt="" width={56} height={56} loading="lazy" />
            ) : (
              <ThumbPlaceholder kind="book" />
            )}
          </div>
          <span class="book-sidebar__title">{bookTitle}</span>
        </a>
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
            </a>
          </li>
        ))}
      </ol>
    </aside>
  );
};
