import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import {
  parseMarkdown,
  readTemplate,
  mapPresentation,
  generatePptx,
} from "../../index.js";
import { convertPptxToSvg } from "pptx-glimpse";
import { ensureInitialized, getOrderedListHelper } from "../pyodide-loader";
import { buildHtml, buildLoadingHtml, buildErrorHtml } from "./slide-renderer";

export class PreviewPanel {
  public static readonly viewType = "md-pptx.preview";

  private static instance: PreviewPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionContext: vscode.ExtensionContext;
  private document: vscode.TextDocument;
  private disposables: vscode.Disposable[] = [];

  /** 非同期 update の競合防止用シーケンス番号 */
  private updateSeq = 0;

  /** debounce 用タイマー */
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionContext: vscode.ExtensionContext,
    document: vscode.TextDocument,
  ) {
    this.panel = panel;
    this.extensionContext = extensionContext;
    this.document = document;

    this.panel.webview.html = buildLoadingHtml();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() === this.document.uri.toString()) {
          this.scheduleUpdate();
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

    void this.update();
  }

  public static createOrShow(
    extensionContext: vscode.ExtensionContext,
    document: vscode.TextDocument,
  ): void {
    const column = vscode.ViewColumn.Beside;

    if (PreviewPanel.instance) {
      PreviewPanel.instance.document = document;
      PreviewPanel.instance.panel.reveal(column);
      void PreviewPanel.instance.update();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      PreviewPanel.viewType,
      "md-pptx Preview",
      column,
      {
        enableScripts: true,
      },
    );

    PreviewPanel.instance = new PreviewPanel(panel, extensionContext, document);
  }

  private scheduleUpdate(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      void this.update();
    }, 300);
  }

  private async update(): Promise<void> {
    const seq = ++this.updateSeq;

    try {
      await ensureInitialized(this.extensionContext.globalStorageUri);
      if (seq !== this.updateSeq) return;

      const mdContent = this.document.getText();
      const mdDir = path.dirname(this.document.uri.fsPath);

      const parseResult = parseMarkdown(mdContent);

      const templatePath = parseResult.frontMatter.template;
      let templateData: Uint8Array | undefined;
      if (templatePath) {
        const resolvedTemplatePath = path.resolve(mdDir, templatePath);
        templateData = new Uint8Array(fs.readFileSync(resolvedTemplatePath));
      }

      const templateInfo = readTemplate(templateData);
      const mappingResults = mapPresentation(parseResult, templateInfo);

      const imageResolver = (src: string): Uint8Array | undefined => {
        try {
          const imagePath = path.resolve(mdDir, src);
          return new Uint8Array(fs.readFileSync(imagePath));
        } catch {
          return undefined;
        }
      };

      const pptxData = generatePptx(parseResult, mappingResults, {
        templateData,
        imageResolver,
        orderedListHelper: getOrderedListHelper(),
      });

      if (seq !== this.updateSeq) return;

      const slides = await convertPptxToSvg(pptxData);
      const svgs = slides.map((s) => s.svg);

      if (seq !== this.updateSeq) return;

      this.panel.webview.html = buildHtml(svgs);
    } catch (error) {
      if (seq !== this.updateSeq) return;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.panel.webview.html = buildErrorHtml(errorMessage);
    }
  }

  private dispose(): void {
    PreviewPanel.instance = undefined;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
