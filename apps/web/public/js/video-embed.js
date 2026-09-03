// packages/shared のMarkdownパイプラインが出力する
// <div class="video-embed" data-video-provider="youtube|vimeo" data-video-id="..."
//      data-video-title="...">
// を、クリックでサムネイル→実際の<iframe>に差し替えるlite-facade（実装プラン5章）。
// 初期状態ではiframeを埋め込まないため、ページ読み込み時のサードパーティ通信・
// レイアウトシフトを避けられる。
(function () {
  "use strict";

  function thumbnailUrl(provider, id) {
    if (provider === "youtube") {
      return "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg";
    }
    // Vimeoはサムネイル取得に追加APIが必要なため、プレースホルダー背景のみ表示する。
    return null;
  }

  function embedUrl(provider, id) {
    if (provider === "youtube") {
      return "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1";
    }
    if (provider === "vimeo") {
      return "https://player.vimeo.com/video/" + id + "?autoplay=1";
    }
    return null;
  }

  function activate(el) {
    var provider = el.getAttribute("data-video-provider");
    var id = el.getAttribute("data-video-id");
    var title = el.getAttribute("data-video-title") || "動画";
    var url = embedUrl(provider, id);
    if (!url) return;

    var iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.title = title;
    iframe.width = "100%";
    iframe.height = "100%";
    iframe.frameBorder = "0";
    iframe.allow = "accelerated-baseline-layers; autoplay; encrypted-media; picture-in-picture";
    iframe.allowFullscreen = true;

    el.innerHTML = "";
    el.appendChild(iframe);
    el.classList.add("video-embed--active");
  }

  function buildFacade(el) {
    var provider = el.getAttribute("data-video-provider");
    var id = el.getAttribute("data-video-id");
    var title = el.getAttribute("data-video-title") || "動画を再生";
    var thumb = thumbnailUrl(provider, id);

    if (thumb) {
      var img = document.createElement("img");
      img.className = "video-embed__thumb";
      img.src = thumb;
      img.alt = "";
      img.loading = "lazy";
      el.appendChild(img);
    }

    var circle = document.createElement("div");
    circle.className = "video-embed__play-circle";
    el.appendChild(circle);

    var button = document.createElement("button");
    button.type = "button";
    button.className = "video-embed__play";
    button.setAttribute("aria-label", title + " を再生");
    button.addEventListener("click", function () {
      activate(el);
    });
    el.appendChild(button);
  }

  document.querySelectorAll(".video-embed[data-video-provider]").forEach(buildFacade);
})();
