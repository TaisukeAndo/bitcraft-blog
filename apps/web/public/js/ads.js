// Google AdSense本格導入までのプレースホルダー実装（実装プラン8章）。
// components/ads/AdSlot.tsx が data-ad-client 付きで描画した枠にのみ動作し、
// window.__ADSENSE_CLIENT_ID（components/layout.tsx がadsenseClientId設定時のみ埋め込む）
// が無ければこのファイル自体読み込まれない。data-ad-lazy="true" の枠は
// IntersectionObserverでビューポートに近づいてから読み込み、LCP/INPへの影響を避ける。
(function () {
  "use strict";

  var clientId = window.__ADSENSE_CLIENT_ID;
  if (!clientId) return;

  var scriptLoaded = false;
  function ensureAdsenseScript() {
    if (scriptLoaded) return;
    scriptLoaded = true;
    var script = document.createElement("script");
    script.async = true;
    script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(clientId);
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
  }

  function renderSlot(slot) {
    if (slot.dataset.adRendered === "true") return;
    slot.dataset.adRendered = "true";

    var adSlotId = slot.getAttribute("data-ad-slot");
    var ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.style.width = "100%";
    ins.style.height = "100%";
    ins.setAttribute("data-ad-client", clientId);
    if (adSlotId) ins.setAttribute("data-ad-slot", adSlotId);
    ins.setAttribute("data-ad-format", "auto");
    ins.setAttribute("data-full-width-responsive", "true");
    slot.appendChild(ins);

    ensureAdsenseScript();
    window.adsbygoogle = window.adsbygoogle || [];
    try {
      window.adsbygoogle.push({});
    } catch {
      // AdSense未承認・広告ブロッカー等でpushが失敗しても致命的ではないため握りつぶす。
    }
  }

  var slots = document.querySelectorAll(".ad-slot[data-ad-client]");
  var immediate = [];
  var lazy = [];
  slots.forEach(function (slot) {
    if (slot.getAttribute("data-ad-lazy") === "true") {
      lazy.push(slot);
    } else {
      immediate.push(slot);
    }
  });

  immediate.forEach(renderSlot);

  if (lazy.length > 0 && "IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            renderSlot(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "300px 0px" },
    );
    lazy.forEach(function (slot) {
      observer.observe(slot);
    });
  } else {
    lazy.forEach(renderSlot);
  }
})();
