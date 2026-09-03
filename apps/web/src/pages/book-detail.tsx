import type { FC } from "hono/jsx";
import { BookSidebar, type BookSidebarChapter } from "../components/book-sidebar";
import { Badge } from "../components/tag-pill";
import { mediaUrl } from "../lib/media-url";

export interface BookDetailPageProps {
  slug: string;
  title: string;
  summary: string;
  coverImageKey: string | null;
  priceYen: number;
  pricingModel: "free" | "paid_planned";
  chapters: BookSidebarChapter[];
}

// Book詳細ページ（実装プラン6章）。左固定サイドバーは components/book-sidebar.tsx を
// /books/:slug と /books/:slug/:chapterSlug（chapter-detail.tsx）で共通利用する。
export const BookDetailPage: FC<BookDetailPageProps> = ({
  slug,
  title,
  summary,
  coverImageKey,
  priceYen,
  pricingModel,
  chapters,
}) => {
  const cover = mediaUrl(coverImageKey);
  const firstChapter = chapters[0];

  return (
    <div class="book-layout">
      <BookSidebar
        bookSlug={slug}
        bookTitle={title}
        priceYen={priceYen}
        pricingModel={pricingModel}
        chapters={chapters}
      />
      <main class="book-main">
        <nav class="article-header__breadcrumb" aria-label="パンくずリスト">
          <a href="/books">Book</a> / <span>{title}</span>
        </nav>

        {cover ? (
          <img class="book-detail__cover" src={cover} alt="" width={960} height={540} loading="lazy" />
        ) : null}

        <h1>{title}</h1>
        <div class="article-meta">
          {pricingModel === "free" ? (
            <Badge kind="free" />
          ) : (
            <>
              <Badge kind="paid" />
              <span>¥{priceYen.toLocaleString("ja-JP")}</span>
            </>
          )}
          <span>全{chapters.length}章</span>
        </div>

        <div class="prose">
          <p>{summary}</p>
        </div>

        <div class="book-cta">
          {firstChapter ? (
            <a class="book-detail__cta-button" href={`/books/${slug}/${firstChapter.slug}`}>
              最初の章から読む
            </a>
          ) : (
            <p>チャプターは準備中です。</p>
          )}
          {pricingModel === "paid_planned" ? (
            <>
              <p class="book-cta__price">¥{priceYen.toLocaleString("ja-JP")}（有料予定）</p>
              <p class="book-cta__note">
                現時点では決済機能が未実装のため、全チャプターをどなたでも無料でお読みいただけます。
              </p>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
};
