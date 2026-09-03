// デスクトップ右マージンの追従目次（.toc-sidebar）で、現在読んでいる見出しに対応する
// リンクへ .is-active を付与する（実装プラン6章）。IntersectionObserverで
// ビューポート上部付近を通過した見出しを追跡する軽量実装。
(function () {
  "use strict";

  var tocLinks = document.querySelectorAll(".toc-list__item a[href^='#']");
  if (tocLinks.length === 0) return;

  var linkByHeadingId = new Map();
  tocLinks.forEach(function (link) {
    var id = decodeURIComponent(link.getAttribute("href").slice(1));
    linkByHeadingId.set(id, link);
  });

  var headings = [];
  linkByHeadingId.forEach(function (_link, id) {
    var el = document.getElementById(id);
    if (el) headings.push(el);
  });
  if (headings.length === 0) return;

  var currentActive = null;
  function setActive(id) {
    if (currentActive) currentActive.classList.remove("is-active");
    var link = linkByHeadingId.get(id);
    if (link) {
      link.classList.add("is-active");
      currentActive = link;
    }
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          setActive(entry.target.id);
        }
      });
    },
    {
      // ヘッダーの高さぶん上端を詰め、見出しがヘッダー直下に来たタイミングで
      // アクティブ化する。
      rootMargin: "-96px 0px -70% 0px",
      threshold: 0,
    },
  );

  headings.forEach(function (heading) {
    observer.observe(heading);
  });
})();
