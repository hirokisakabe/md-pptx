import * as vscode from "vscode";
import { PreviewPanel } from "../webview/preview-panel";

export function registerPreviewCommand(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand("md-pptx.preview", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("Markdownファイルを開いてください。");
      return;
    }

    const document = editor.document;
    if (document.languageId !== "markdown") {
      vscode.window.showErrorMessage("Markdownファイルを開いてください。");
      return;
    }

    PreviewPanel.createOrShow(context.extensionUri, document);
  });

  context.subscriptions.push(disposable);
}
