// rehype-highlight（packages/shared/src/markdown）が出力する
// <pre><code class="hljs language-xxx">...</code></pre> を、実行時に
// 言語ラベル＋コピーボタン付きの .code-block でラップする（実装プラン6章）。
// サーバー側でラップしないのは、apps/web が bodyHtml をそのままSELECTするだけの
// 設計（実装プラン5章）を崩さないため。
(function () {
  "use strict";

  function extractLanguage(codeEl) {
    var match = /language-(\S+)/.exec(codeEl.className);
    return match ? match[1] : "text";
  }

  function copyText(text, button) {
    var done = function () {
      button.setAttribute("data-copied", "true");
      button.textContent = "コピー済み";
      setTimeout(function () {
        button.removeAttribute("data-copied");
        button.textContent = "コピー";
      }, 1500);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {
        fallbackCopy(text);
        done();
      });
      return;
    }
    fallbackCopy(text);
    done();
  }

  function fallbackCopy(text) {
    var textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand("copy");
    } catch {
      // クリップボードAPIが使えない環境ではコピーを諦める（ボタンの見た目は変えない）。
    }
    document.body.removeChild(textarea);
  }

  function wrap(pre) {
    var code = pre.querySelector("code");
    if (!code) return;
    var lang = extractLanguage(code);

    var wrapper = document.createElement("div");
    wrapper.className = "code-block";

    var header = document.createElement("div");
    header.className = "code-block__header";

    var langLabel = document.createElement("span");
    langLabel.className = "code-block__lang";
    langLabel.textContent = lang;

    var copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "code-block__copy";
    copyButton.textContent = "コピー";
    copyButton.addEventListener("click", function () {
      copyText(code.textContent || "", copyButton);
    });

    header.appendChild(langLabel);
    header.appendChild(copyButton);

    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);
  }

  document.querySelectorAll(".prose pre > code.hljs").forEach(function (code) {
    wrap(code.parentElement);
  });
})();
