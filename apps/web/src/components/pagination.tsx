import type { FC } from "hono/jsx";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  basePath: string; // 例: "/" や "/tags/nextjs"（クエリは付けない）
  extraQuery?: Record<string, string>; // 検索キーワード等、page以外に維持したいクエリ
}

function buildHref(basePath: string, page: number, extraQuery?: Record<string, string>): string {
  const params = new URLSearchParams(extraQuery);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export const Pagination: FC<PaginationProps> = ({
  currentPage,
  totalPages,
  basePath,
  extraQuery,
}) => {
  if (totalPages <= 1) return null;

  return (
    <nav class="pagination" aria-label="ページ送り">
      {currentPage > 1 ? (
        <a class="pagination__link" href={buildHref(basePath, currentPage - 1, extraQuery)}>
          ← 前へ
        </a>
      ) : (
        <span class="pagination__link pagination__link--disabled">← 前へ</span>
      )}
      <span class="pagination__status">
        {currentPage} / {totalPages}
      </span>
      {currentPage < totalPages ? (
        <a class="pagination__link" href={buildHref(basePath, currentPage + 1, extraQuery)}>
          次へ →
        </a>
      ) : (
        <span class="pagination__link pagination__link--disabled">次へ →</span>
      )}
    </nav>
  );
};
