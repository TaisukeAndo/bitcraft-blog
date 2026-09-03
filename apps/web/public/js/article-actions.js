// 記事詳細ページ左側の「ハート」ボタン（components/article-actions.tsx）。
// アカウント機能が無いため、押した状態はブラウザのlocalStorageだけで管理する
// （同一ブラウザでの多重カウントを防ぐ簡易な仕組み。厳密な不正防止ではない。
// ユーザー指示により2026-09-04追加）。カウントの増減自体はapps/web経由で
// apps/apiへ委譲する（POST /posts/:slug/like・/unlike）。
(function () {
  "use strict";

  var STORAGE_PREFIX = "bitcraft-blog:liked:";

  function isLiked(slug) {
    try {
      return window.localStorage.getItem(STORAGE_PREFIX + slug) === "true";
    } catch {
      return false;
    }
  }

  function setLiked(slug, liked) {
    try {
      if (liked) {
        window.localStorage.setItem(STORAGE_PREFIX + slug, "true");
      } else {
        window.localStorage.removeItem(STORAGE_PREFIX + slug);
      }
    } catch {
      // localStorageが使えない環境（プライベートブラウジング等）ではトグル状態を
      // 保持できないが、クリックごとにサーバーのカウントを増減するだけは行う。
    }
  }

  document.querySelectorAll("[data-like-button]").forEach(function (button) {
    var slug = button.getAttribute("data-post-slug");
    var countEl = button.querySelector("[data-like-count]");
    if (!slug || !countEl) return;

    var liked = isLiked(slug);
    button.setAttribute("data-liked", liked ? "true" : "false");

    var busy = false;
    button.addEventListener("click", function () {
      if (busy) return;
      busy = true;

      var nextLiked = button.getAttribute("data-liked") !== "true";
      var action = nextLiked ? "like" : "unlike";

      // 楽観的に見た目とカウントを先に更新し、失敗したら元に戻す。
      var previousCount = Number(countEl.textContent) || 0;
      button.setAttribute("data-liked", nextLiked ? "true" : "false");
      countEl.textContent = String(Math.max(0, previousCount + (nextLiked ? 1 : -1)));

      fetch("/posts/" + encodeURIComponent(slug) + "/" + action, { method: "POST" })
        .then(function (res) {
          if (!res.ok) throw new Error("failed");
          return res.json();
        })
        .then(function (data) {
          if (typeof data.likeCount === "number") {
            countEl.textContent = String(data.likeCount);
          }
          setLiked(slug, nextLiked);
        })
        .catch(function () {
          // 失敗時は見た目を元に戻す。
          button.setAttribute("data-liked", nextLiked ? "false" : "true");
          countEl.textContent = String(previousCount);
        })
        .finally(function () {
          busy = false;
        });
    });
  });
})();
