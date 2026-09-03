import type { FC } from "hono/jsx";

export const NotFoundPage: FC = () => (
  <main>
    <div class="not-found">
      <h1>ページが見つかりません</h1>
      <p>お探しのページは移動または削除された可能性があります。</p>
      <p>
        <a href="/">トップページへ戻る</a>
      </p>
    </div>
  </main>
);
