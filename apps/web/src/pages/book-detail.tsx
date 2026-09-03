import type { FC } from "hono/jsx";
import type { BookSidebarChapter } from "../components/book-sidebar";
import { Badge } from "../components/tag-pill";
import { ThumbPlaceholder } from "../components/thumb-placeholder";
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

// Book詳細ページ（Bookのトップページ）。表紙＋タイトル/バッジ/概要のヒーローと
// 章一覧、右にCTAという構成（Zennの本トップページを参考にしたレイアウト）。
// 一覧ページ（home.tsx等）と同じpage-container/list-layoutを流用し、サイト全体との
// 統一感を保つ。「無料」バッジはこのページにのみ出し、チャプターページ側
// （chapter-detail.tsx・その左サイドバーcomponents/book-sidebar.tsx）には繰り返さない
// （ユーザー指示により2026-09-04変更）。
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
    <main class="page-container">
      <nav class="article-header__breadcrumb" aria-label="パンくずリスト">
        <a href="/books">Book</a> / <span>{title}</span>
      </nav>

      <div class="list-layout">
        <div>
          <div class="book-hero">
            {cover ? (
              <img class="book-hero__cover" src={cover} alt="" width={220} height={124} loading="lazy" />
            ) : (
              <div class="book-hero__cover-placeholder">
                <ThumbPlaceholder kind="book" />
              </div>
            )}
            <div class="book-hero__body">
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
            </div>
          </div>

          {chapters.length > 0 ? (
            <section class="book-chapters">
              <h2 class="book-chapters__heading">章一覧</h2>
              <ol class="book-chapters__list">
                {chapters.map((chapter) => (
                  <li>
                    <a class="book-chapters__row" href={`/books/${slug}/${chapter.slug}`}>
                      <span class="book-sidebar__chapter-number">
                        {String(chapter.chapterNumber).padStart(2, "0")}
                      </span>
                      <span class="book-chapters__title">{chapter.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>

        <aside class="list-sidebar">
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
        </aside>
      </div>
    </main>
  );
};
