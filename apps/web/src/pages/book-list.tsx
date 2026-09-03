import type { FC } from "hono/jsx";
import { mediaUrl } from "../lib/media-url";
import { Badge } from "../components/tag-pill";
import { ThumbPlaceholder } from "../components/thumb-placeholder";

export interface BookListItem {
  slug: string;
  title: string;
  summary: string;
  coverImageKey: string | null;
  priceYen: number;
  pricingModel: "free" | "paid_planned";
}

export const BookListPage: FC<{ books: BookListItem[] }> = ({ books }) => {
  return (
    <main class="page-container">
      <div class="page-header">
        <h1>Book</h1>
        <p>まとまった分量で学べる長編コンテンツです。</p>
      </div>

      {books.length === 0 ? (
        <p>公開中のBookはまだありません。</p>
      ) : (
        <div class="card-grid">
          {books.map((book) => {
            const cover = mediaUrl(book.coverImageKey);
            return (
              <article class="post-card">
                <a class="post-card__link" href={`/books/${book.slug}`}>
                  <div class="post-card__thumb">
                    {cover ? (
                      <img src={cover} alt="" width={640} height={360} loading="lazy" />
                    ) : (
                      <ThumbPlaceholder kind="book" />
                    )}
                  </div>
                  <div class="post-card__body">
                    <h3 class="post-card__title">{book.title}</h3>
                    <p class="post-card__excerpt">{book.summary}</p>
                    <div class="post-card__meta">
                      {book.pricingModel === "free" ? (
                        <Badge kind="free" />
                      ) : (
                        <>
                          <Badge kind="paid" />
                          <span>¥{book.priceYen.toLocaleString("ja-JP")}</span>
                        </>
                      )}
                    </div>
                  </div>
                </a>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
};
