import * as vscode from "vscode";
import { parseMarkdown } from "md-pptx";
import type { SlideData, ContentElement } from "md-pptx";

export class PreviewPanel {
  public static readonly viewType = "md-pptx.preview";

  private static instance: PreviewPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private document: vscode.TextDocument;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    document: vscode.TextDocument,
  ) {
    this.panel = panel;
    this.document = document;

    this.update();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() === this.document.uri.toString()) {
          this.update();
        }
      },
      null,
      this.disposables,
    );

    vscode.window.onDidChangeActiveTextEditor(
      (editor) => {
        if (editor && editor.document.languageId === "markdown") {
          this.document = editor.document;
          this.update();
        }
      },
      null,
      this.disposables,
    );
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    document: vscode.TextDocument,
  ): void {
    const column = vscode.ViewColumn.Beside;

    if (PreviewPanel.instance) {
      PreviewPanel.instance.document = document;
      PreviewPanel.instance.panel.reveal(column);
      PreviewPanel.instance.update();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      PreviewPanel.viewType,
      "md-pptx Preview",
      column,
      {
        enableScripts: false,
        localResourceRoots: [extensionUri],
      },
    );

    PreviewPanel.instance = new PreviewPanel(panel, document);
  }

  private update(): void {
    const mdContent = this.document.getText();

    try {
      const parseResult = parseMarkdown(mdContent);
      this.panel.webview.html = this.buildHtml(parseResult.slides);
    } catch {
      this.panel.webview.html = this.buildErrorHtml(
        "Markdownのパースに失敗しました。",
      );
    }
  }

  private buildHtml(slides: SlideData[]): string {
    const slidesHtml = slides
      .map((slide, index) => this.renderSlide(slide, index))
      .join("\n");

    return /* html */ `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 16px;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
    }
    .slide {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 24px;
      margin-bottom: 16px;
      background: var(--vscode-editorWidget-background);
      aspect-ratio: 16 / 9;
      overflow: hidden;
      position: relative;
    }
    .slide-number {
      position: absolute;
      top: 8px;
      right: 12px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    .slide-layout {
      position: absolute;
      top: 8px;
      left: 12px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    h1 { font-size: 1.8em; margin: 0 0 0.5em; }
    h2 { font-size: 1.4em; margin: 0 0 0.5em; }
    h3 { font-size: 1.2em; margin: 0 0 0.5em; }
    p { margin: 0.3em 0; }
    ul, ol { margin: 0.3em 0; padding-left: 1.5em; }
    .image-placeholder {
      display: inline-block;
      padding: 8px 12px;
      border: 1px dashed var(--vscode-panel-border);
      border-radius: 4px;
      font-style: italic;
      color: var(--vscode-descriptionForeground);
    }
    code {
      font-family: var(--vscode-editor-font-family);
      background: var(--vscode-textCodeBlock-background);
      padding: 1px 4px;
      border-radius: 3px;
    }
    a {
      color: var(--vscode-textLink-foreground);
    }
    .empty {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
    }
  </style>
</head>
<body>
  ${slidesHtml || '<p class="empty">スライドが見つかりません。</p>'}
</body>
</html>`;
  }

  private renderSlide(slide: SlideData, index: number): string {
    const contentHtml = slide.content
      .map((el) => this.renderElement(el))
      .join("\n");

    const layoutLabel = slide.layout
      ? `<span class="slide-layout">${this.escapeHtml(slide.layout)}</span>`
      : "";

    return `<div class="slide">
  ${layoutLabel}
  <span class="slide-number">${index + 1}</span>
  ${contentHtml || '<p class="empty">(空のスライド)</p>'}
</div>`;
  }

  private renderElement(element: ContentElement): string {
    switch (element.type) {
      case "heading": {
        const tag = `h${Math.min(element.level, 6)}`;
        const text = element.runs.map((r) => this.renderTextRun(r)).join("");
        return `<${tag}>${text}</${tag}>`;
      }
      case "paragraph": {
        const text = element.runs.map((r) => this.renderTextRun(r)).join("");
        return `<p>${text}</p>`;
      }
      case "list": {
        const firstOrdered = element.items[0]?.ordered ?? false;
        const tag = firstOrdered ? "ol" : "ul";
        const items = element.items
          .map((item) => {
            const text = item.runs.map((r) => this.renderTextRun(r)).join("");
            return `<li>${text}</li>`;
          })
          .join("\n");
        return `<${tag}>${items}</${tag}>`;
      }
      case "image": {
        const alt = element.image.alt || element.image.src;
        return `<span class="image-placeholder">[Image: ${this.escapeHtml(alt)}]</span>`;
      }
    }
  }

  private renderTextRun(run: {
    text: string;
    bold?: boolean;
    italic?: boolean;
    code?: boolean;
    link?: string;
  }): string {
    let html = this.escapeHtml(run.text);
    if (run.code) html = `<code>${html}</code>`;
    if (run.bold) html = `<strong>${html}</strong>`;
    if (run.italic) html = `<em>${html}</em>`;
    if (run.link) html = `<a href="${this.escapeHtml(run.link)}">${html}</a>`;
    return html;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  private buildErrorHtml(message: string): string {
    return /* html */ `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 16px;
      background: var(--vscode-editor-background);
      color: var(--vscode-errorForeground);
    }
  </style>
</head>
<body>
  <p>${this.escapeHtml(message)}</p>
</body>
</html>`;
  }

  private dispose(): void {
    PreviewPanel.instance = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
