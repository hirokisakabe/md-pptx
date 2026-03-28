/**
 * Webview 用 HTML 構築。
 * pptx-glimpse で生成した SVG を表示する。
 */

const SLIDE_WIDTH = 960;

const ZOOM_LEVELS = [
  { label: "Fit", value: "fit" },
  { label: "50%", value: "50" },
  { label: "75%", value: "75" },
  { label: "100%", value: "100" },
  { label: "150%", value: "150" },
];

/**
 * SVG スライドを埋め込んだ完全な HTML を構築する。
 */
export function buildHtml(svgs: string[], defaultZoom = "fit"): string {
  const zoomButtons = ZOOM_LEVELS.map(
    (z) =>
      `<button class="zoom-btn" data-zoom="${z.value}">${z.label}</button>`,
  ).join("\n        ");

  const zoomStyles = ZOOM_LEVELS.filter((z) => z.value !== "fit")
    .map(
      (z) =>
        `body[data-zoom="${z.value}"] .slide-frame svg { width: ${SLIDE_WIDTH * (parseInt(z.value) / 100)}px; height: auto; }`,
    )
    .join("\n    ");

  const slideElements =
    svgs.length > 0
      ? svgs
          .map(
            (svg, i) => `
    <div class="slide-wrapper">
      <div class="slide-label">Slide ${i + 1}</div>
      <div class="slide-frame">
        ${svg}
      </div>
    </div>`,
          )
          .join("")
      : '<p class="empty-state">スライドが見つかりません。</p>';

  return /* html */ `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src data:;">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      height: 100vh;
      overflow: hidden;
    }

    /* ── Toolbar ── */
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      gap: 4px;
      padding: 8px 16px;
      background: var(--vscode-editor-background);
      border-bottom: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.2));
    }

    .zoom-btn {
      padding: 4px 10px;
      font-size: 12px;
      border: 1px solid var(--vscode-button-border, rgba(128,128,128,0.3));
      border-radius: 3px;
      background: var(--vscode-button-secondaryBackground, transparent);
      color: var(--vscode-button-secondaryForeground, inherit);
      cursor: pointer;
    }

    .zoom-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground, rgba(128,128,128,0.2));
    }

    .zoom-btn.active {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-color: var(--vscode-button-background);
    }

    /* ── Slides container ── */
    .slides-container {
      height: calc(100vh - 41px);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 16px;
      gap: 24px;
    }

    .slide-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }

    .slide-label {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    .slide-frame {
      border-radius: 4px;
      overflow: hidden;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
      line-height: 0;
    }

    .slide-frame svg {
      display: block;
    }

    /* ── Zoom: fit ── */
    body[data-zoom="fit"] .slide-frame svg {
      width: 100%;
      max-width: ${SLIDE_WIDTH}px;
      height: auto;
    }

    /* ── Zoom: fixed sizes ── */
    ${zoomStyles}

    /* ── Empty / Error state ── */
    .empty-state, .error-state {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
      text-align: center;
      padding-top: 40%;
    }

    .error-state {
      color: var(--vscode-errorForeground, #f44);
    }
  </style>
</head>
<body data-zoom="${defaultZoom}">
  <div class="toolbar">
    ${zoomButtons}
  </div>
  <div class="slides-container" id="container">
    ${slideElements}
  </div>

  <script>
    (function () {
      var vscode = acquireVsCodeApi();

      // ── Restore zoom state ──
      var savedState = vscode.getState();
      if (savedState && savedState.zoom) {
        document.body.setAttribute("data-zoom", savedState.zoom);
      }
      updateActiveButton();

      // ── Zoom buttons ──
      document.querySelectorAll(".zoom-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var zoom = btn.getAttribute("data-zoom");
          document.body.setAttribute("data-zoom", zoom);
          vscode.setState({ zoom: zoom });
          updateActiveButton();
        });
      });

      function updateActiveButton() {
        var currentZoom = document.body.getAttribute("data-zoom");
        document.querySelectorAll(".zoom-btn").forEach(function (btn) {
          if (btn.getAttribute("data-zoom") === currentZoom) {
            btn.classList.add("active");
          } else {
            btn.classList.remove("active");
          }
        });
      }
    })();
  </script>
</body>
</html>`;
}

/**
 * 読み込み中の HTML シェルを構築する。
 */
export function buildLoadingHtml(): string {
  return buildHtml([], "fit").replace(
    '<p class="empty-state">スライドが見つかりません。</p>',
    '<p class="empty-state">スライドを読み込み中...</p>',
  );
}

/**
 * エラー表示用の HTML を構築する。
 */
export function buildErrorHtml(message: string): string {
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return buildHtml([], "fit").replace(
    '<p class="empty-state">スライドが見つかりません。</p>',
    `<p class="error-state">${escaped}</p>`,
  );
}
