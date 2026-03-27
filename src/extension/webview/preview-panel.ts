import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import { parseMarkdown, extractBackgrounds } from "../../index.js";
import type { BackgroundExtractionResult } from "../../index.js";
import { buildSlideRenderData, buildShellHtml } from "./slide-renderer";
import type { SlideRenderData } from "./slide-renderer";

/** Webview に送信するメッセージ */
interface UpdateMessage {
  type: "update";
  slides: SlideRenderData[];
}

/** Webview から受信するメッセージ */
interface WebviewMessage {
  type: "ready";
}

export class PreviewPanel {
  public static readonly viewType = "md-pptx.preview";

  private static instance: PreviewPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private document: vscode.TextDocument;
  private disposables: vscode.Disposable[] = [];

  /** 背景画像キャッシュ */
  private cachedTemplatePath: string | undefined;
  private cachedBackgrounds: BackgroundExtractionResult | undefined;

  /** 非同期 update の競合防止用シーケンス番号 */
  private updateSeq = 0;

  private constructor(
    panel: vscode.WebviewPanel,
    document: vscode.TextDocument,
  ) {
    this.panel = panel;
    this.document = document;

    this.panel.webview.html = buildShellHtml();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => {
        if (message.type === "ready") {
          void this.update();
        }
      },
      null,
      this.disposables,
    );

    vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() === this.document.uri.toString()) {
          void this.update();
        }
      },
      null,
      this.disposables,
    );

    vscode.window.onDidChangeActiveTextEditor(
      (editor) => {
        if (editor && editor.document.languageId === "markdown") {
          this.document = editor.document;
          void this.update();
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
      void PreviewPanel.instance.update();
      return;
    }

    const mdDir = path.dirname(document.uri.fsPath);

    const panel = vscode.window.createWebviewPanel(
      PreviewPanel.viewType,
      "md-pptx Preview",
      column,
      {
        enableScripts: true,
        localResourceRoots: [
          extensionUri,
          vscode.Uri.file(mdDir),
          ...(vscode.workspace.workspaceFolders?.map((f) => f.uri) ?? []),
        ],
      },
    );

    PreviewPanel.instance = new PreviewPanel(panel, document);
  }

  private async update(): Promise<void> {
    const seq = ++this.updateSeq;
    const mdContent = this.document.getText();

    try {
      const parseResult = parseMarkdown(mdContent);
      const backgrounds = await this.resolveBackgrounds(
        parseResult.frontMatter.template,
      );

      // 非同期処理中に新しい update が開始された場合は古い結果を破棄
      if (seq !== this.updateSeq) return;

      const webview = this.panel.webview;
      const mdDir = path.dirname(this.document.uri.fsPath);
      const resolveImageSrc = (src: string): string => {
        try {
          const imgPath = path.resolve(mdDir, src);
          return webview.asWebviewUri(vscode.Uri.file(imgPath)).toString();
        } catch {
          return src;
        }
      };

      const slides = buildSlideRenderData(
        parseResult.slides,
        backgrounds,
        resolveImageSrc,
      );

      const message: UpdateMessage = { type: "update", slides };
      void this.panel.webview.postMessage(message);
    } catch {
      if (seq !== this.updateSeq) return;
      const message: UpdateMessage = { type: "update", slides: [] };
      void this.panel.webview.postMessage(message);
    }
  }

  private async resolveBackgrounds(
    templateRelPath: string | undefined,
  ): Promise<BackgroundExtractionResult | undefined> {
    if (!templateRelPath) {
      this.cachedTemplatePath = undefined;
      this.cachedBackgrounds = undefined;
      return undefined;
    }

    const mdDir = path.dirname(this.document.uri.fsPath);
    const templatePath = path.resolve(mdDir, templateRelPath);

    if (this.cachedTemplatePath === templatePath && this.cachedBackgrounds) {
      return this.cachedBackgrounds;
    }

    try {
      const templateData = new Uint8Array(fs.readFileSync(templatePath));
      const backgrounds = await extractBackgrounds(templateData);
      this.cachedTemplatePath = templatePath;
      this.cachedBackgrounds = backgrounds;
      return backgrounds;
    } catch {
      return undefined;
    }
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
