/**
 * Webview 用スライドレンダリングの純粋関数群。
 * VS Code API に依存しないため、ユニットテスト可能。
 */
import type {
  SlideData,
  ContentElement,
  SlideLayoutBackground,
  BackgroundExtractionResult,
} from "md-pptx";

/** Webview に送信するスライドデータ */
export interface SlideRenderData {
  layout?: string;
  backgroundDataUrl?: string;
  content: ContentElement[];
  notes: string[];
}

/**
 * SlideData[] を WebView 用の SlideRenderData[] に変換する。
 *
 * @param slides パース済みスライドデータ
 * @param backgrounds テンプレートから抽出した背景画像（省略可）
 * @param resolveImageSrc 画像パスを webview URI 等に変換する関数（省略可）
 */
export function buildSlideRenderData(
  slides: SlideData[],
  backgrounds?: BackgroundExtractionResult,
  resolveImageSrc?: (src: string) => string,
): SlideRenderData[] {
  return slides.map((slide) => {
    const backgroundDataUrl = resolveBackground(slide, backgrounds);
    const content = resolveImageSrc
      ? slide.content.map((el: ContentElement) =>
          resolveContentImages(el, resolveImageSrc),
        )
      : slide.content;

    return {
      layout: slide.layout,
      backgroundDataUrl,
      content,
      notes: slide.notes,
    };
  });
}

/**
 * スライドのレイアウト名に基づいて背景画像を解決する。
 */
export function resolveBackground(
  slide: SlideData,
  backgrounds?: BackgroundExtractionResult,
): string | undefined {
  if (!backgrounds) return undefined;

  if (slide.layout) {
    const layoutBg = backgrounds.layouts.find(
      (l: SlideLayoutBackground) => l.layoutName === slide.layout,
    );
    if (layoutBg) return layoutBg.dataUrl;
  }

  // マスター背景にフォールバック
  if (backgrounds.masters.length > 0) {
    return backgrounds.masters[0].dataUrl;
  }

  return undefined;
}

/**
 * コンテンツ内の画像パスを変換する。
 */
export function resolveContentImages(
  element: ContentElement,
  resolveImageSrc: (src: string) => string,
): ContentElement {
  if (element.type !== "image") return element;

  const imgSrc = element.image.src;

  // 既に data URL や http URL の場合はそのまま
  if (imgSrc.startsWith("data:") || imgSrc.startsWith("http")) {
    return element;
  }

  const resolved = resolveImageSrc(imgSrc);
  return {
    ...element,
    image: { ...element.image, src: resolved },
  };
}

/**
 * Webview の初期 HTML シェルを構築する。
 * スライド描画は JS 側で postMessage 経由で行う。
 */
export function buildShellHtml(): string {
  return /* html */ `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src vscode-resource: https: data:;">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    /* ── Navigation bar ── */
    .nav-bar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 8px 16px;
      background: var(--vscode-editorWidget-background);
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-shrink: 0;
    }

    .nav-bar button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      padding: 4px 12px;
      cursor: pointer;
      font-size: 13px;
    }
    .nav-bar button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .nav-bar button:disabled {
      opacity: 0.4;
      cursor: default;
    }

    .slide-indicator {
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
      min-width: 60px;
      text-align: center;
    }

    /* ── Slide viewport ── */
    .slide-viewport {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      overflow: hidden;
    }

    .slide-frame {
      position: relative;
      width: 100%;
      max-width: 960px;
      aspect-ratio: 16 / 9;
      background: #ffffff;
      color: #333333;
      border-radius: 4px;
      overflow: hidden;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
    }

    .slide-bg {
      position: absolute;
      inset: 0;
      background-size: cover;
      background-position: center;
      z-index: 0;
    }

    .slide-content {
      position: absolute;
      inset: 0;
      z-index: 1;
      display: flex;
      flex-direction: column;
      padding: 8% 8%;
    }

    .slide-content[data-has-title="true"] .title-area {
      flex: 0 0 auto;
      margin-bottom: 4%;
    }

    .slide-content .body-area {
      flex: 1;
      overflow: hidden;
    }

    /* ── Typography ── */
    .slide-frame h1 {
      font-size: 2.4em;
      font-weight: 700;
      margin: 0 0 0.3em;
      line-height: 1.2;
    }
    .slide-frame h2 {
      font-size: 1.8em;
      font-weight: 600;
      margin: 0 0 0.3em;
      line-height: 1.2;
    }
    .slide-frame h3 {
      font-size: 1.4em;
      font-weight: 600;
      margin: 0 0 0.3em;
      line-height: 1.3;
    }
    .slide-frame h4, .slide-frame h5, .slide-frame h6 {
      font-size: 1.1em;
      font-weight: 600;
      margin: 0 0 0.2em;
      line-height: 1.3;
    }
    .slide-frame p {
      margin: 0.3em 0;
      line-height: 1.5;
      font-size: 1em;
    }
    .slide-frame ul, .slide-frame ol {
      margin: 0.3em 0;
      padding-left: 1.5em;
      line-height: 1.5;
    }
    .slide-frame li {
      margin: 0.15em 0;
    }
    .slide-frame code {
      font-family: "SF Mono", Monaco, Consolas, "Liberation Mono", monospace;
      background: rgba(0, 0, 0, 0.06);
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 0.9em;
    }
    .slide-frame a {
      color: #0066cc;
      text-decoration: underline;
    }
    .slide-frame s {
      text-decoration: line-through;
    }

    .slide-frame .slide-image {
      max-width: 100%;
      max-height: 300px;
      object-fit: contain;
      border-radius: 4px;
    }

    .slide-frame .image-placeholder {
      display: inline-block;
      padding: 8px 12px;
      border: 1px dashed #999;
      border-radius: 4px;
      font-style: italic;
      color: #999;
    }

    /* ── Title Slide layout ── */
    .layout-title-slide .slide-content {
      justify-content: center;
      align-items: center;
      text-align: center;
    }

    /* ── Empty state ── */
    .empty-state {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
      text-align: center;
      padding-top: 40%;
    }

    /* ── Layout label ── */
    .slide-layout-label {
      position: absolute;
      bottom: 6px;
      left: 10px;
      font-size: 10px;
      color: rgba(0,0,0,0.3);
      z-index: 2;
    }
  </style>
</head>
<body>
  <div class="nav-bar">
    <button id="btn-prev" disabled>&larr; Prev</button>
    <span class="slide-indicator" id="indicator">-</span>
    <button id="btn-next" disabled>Next &rarr;</button>
  </div>
  <div class="slide-viewport" id="viewport">
    <p class="empty-state">スライドを読み込み中...</p>
  </div>

  <script>
    (function () {
      const vscode = acquireVsCodeApi();
      const viewport = document.getElementById("viewport");
      const indicator = document.getElementById("indicator");
      const btnPrev = document.getElementById("btn-prev");
      const btnNext = document.getElementById("btn-next");

      let slides = [];
      let currentIndex = 0;

      // ── Message handler ──
      window.addEventListener("message", (event) => {
        const msg = event.data;
        if (msg.type === "update") {
          slides = msg.slides || [];
          if (currentIndex >= slides.length) {
            currentIndex = Math.max(0, slides.length - 1);
          }
          render();
        }
      });

      // ── Navigation ──
      btnPrev.addEventListener("click", () => navigate(-1));
      btnNext.addEventListener("click", () => navigate(1));

      document.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          navigate(-1);
        } else if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
          e.preventDefault();
          navigate(1);
        } else if (e.key === "Home") {
          e.preventDefault();
          currentIndex = 0;
          render();
        } else if (e.key === "End") {
          e.preventDefault();
          currentIndex = Math.max(0, slides.length - 1);
          render();
        }
      });

      function navigate(delta) {
        const next = currentIndex + delta;
        if (next >= 0 && next < slides.length) {
          currentIndex = next;
          render();
        }
      }

      // ── Render ──
      function render() {
        if (slides.length === 0) {
          viewport.innerHTML = '<p class="empty-state">スライドが見つかりません。</p>';
          indicator.textContent = "-";
          btnPrev.disabled = true;
          btnNext.disabled = true;
          return;
        }

        indicator.textContent = (currentIndex + 1) + " / " + slides.length;
        btnPrev.disabled = currentIndex === 0;
        btnNext.disabled = currentIndex === slides.length - 1;

        const slide = slides[currentIndex];
        viewport.innerHTML = renderSlide(slide);
      }

      function renderSlide(slide) {
        const layoutClass = isTitleSlideLayout(slide.layout) ? "layout-title-slide" : "";

        const bgStyle = slide.backgroundDataUrl
          ? ' style="background-image: url(' + escapeAttr(slide.backgroundDataUrl) + ')"'
          : "";

        const layoutLabel = slide.layout
          ? '<span class="slide-layout-label">' + escapeHtml(slide.layout) + "</span>"
          : "";

        const categorized = categorizeContent(slide.content);
        const hasTitle = categorized.titleHtml.length > 0;

        return '<div class="slide-frame ' + layoutClass + '">'
          + '<div class="slide-bg"' + bgStyle + "></div>"
          + '<div class="slide-content" data-has-title="' + hasTitle + '">'
            + (hasTitle ? '<div class="title-area">' + categorized.titleHtml + "</div>" : "")
            + '<div class="body-area">' + (categorized.bodyHtml || (!hasTitle ? '<p class="empty-state">(空のスライド)</p>' : "")) + "</div>"
          + "</div>"
          + layoutLabel
        + "</div>";
      }

      function isTitleSlideLayout(layout) {
        if (!layout) return false;
        const lower = layout.toLowerCase();
        return lower.includes("title slide") || lower === "title";
      }

      function categorizeContent(content) {
        let titleHtml = "";
        let bodyHtml = "";
        let titleFound = false;

        for (const el of content) {
          if (!titleFound && el.type === "heading" && (el.level === 1 || el.level === 2)) {
            titleFound = true;
            titleHtml += renderElement(el);
          } else {
            bodyHtml += renderElement(el);
          }
        }

        return { titleHtml: titleHtml, bodyHtml: bodyHtml };
      }

      function renderElement(el) {
        switch (el.type) {
          case "heading": {
            const tag = "h" + Math.min(el.level, 6);
            return "<" + tag + ">" + renderRuns(el.runs) + "</" + tag + ">";
          }
          case "paragraph":
            return "<p>" + renderRuns(el.runs) + "</p>";
          case "list":
            return renderList(el.items);
          case "image":
            return renderImage(el.image);
          default:
            return "";
        }
      }

      function renderList(items) {
        if (items.length === 0) return "";

        const result = [];
        const stack = [];

        for (const item of items) {
          const tag = item.ordered ? "ol" : "ul";
          const html = "<li>" + renderRuns(item.runs) + "</li>";

          // 階層が浅くなった場合、または同一階層でリストタグが変わった場合にclose
          while (stack.length > 0 && (
            stack[stack.length - 1].level > item.level ||
            (stack[stack.length - 1].level === item.level && stack[stack.length - 1].tag !== tag)
          )) {
            const popped = stack.pop();
            const closedList = "<" + popped.tag + ">" + popped.items.join("") + "</" + popped.tag + ">";
            if (stack.length > 0) {
              const parent = stack[stack.length - 1];
              parent.items[parent.items.length - 1] += closedList;
            } else {
              result.push(closedList);
            }
          }

          if (stack.length === 0 || item.level > stack[stack.length - 1].level) {
            stack.push({ level: item.level, tag: tag, items: [html] });
          } else {
            stack[stack.length - 1].items.push(html);
          }
        }

        while (stack.length > 0) {
          const popped = stack.pop();
          const closedList = "<" + popped.tag + ">" + popped.items.join("") + "</" + popped.tag + ">";
          if (stack.length > 0) {
            const parent = stack[stack.length - 1];
            parent.items[parent.items.length - 1] += closedList;
          } else {
            result.push(closedList);
          }
        }

        return result.join("");
      }

      function renderImage(image) {
        if (image.src && !image.src.startsWith("data:unsupported")) {
          const widthAttr = image.width ? ' width="' + image.width + '"' : "";
          const heightAttr = image.height ? ' height="' + image.height + '"' : "";
          const alt = escapeAttr(image.alt || image.src);
          return '<img class="slide-image" src="' + escapeAttr(image.src) + '" alt="' + alt + '"' + widthAttr + heightAttr + ">";
        }
        const label = image.alt || image.src;
        return '<span class="image-placeholder">[Image: ' + escapeHtml(label) + "]</span>";
      }

      function renderRuns(runs) {
        if (!runs) return "";
        return runs.map(function (run) {
          let html = escapeHtml(run.text);
          if (run.code) html = "<code>" + html + "</code>";
          if (run.bold) html = "<strong>" + html + "</strong>";
          if (run.italic) html = "<em>" + html + "</em>";
          if (run.strikethrough) html = "<s>" + html + "</s>";
          if (run.link && isSafeUrl(run.link)) html = '<a href="' + escapeAttr(run.link) + '">' + html + "</a>";
          return html;
        }).join("");
      }

      function isSafeUrl(url) {
        if (!url) return false;
        var lower = url.toLowerCase().trim();
        return lower.startsWith("http:") || lower.startsWith("https:") || lower.startsWith("mailto:") || lower.startsWith("#");
      }

      function escapeHtml(text) {
        if (!text) return "";
        return text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      }

      function escapeAttr(text) {
        return escapeHtml(text);
      }

      // ── Notify extension that webview is ready ──
      vscode.postMessage({ type: "ready" });
    })();
  </script>
</body>
</html>`;
}
