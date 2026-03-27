import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import {
  parseMarkdown,
  readTemplate,
  mapPresentation,
  generatePptx,
} from "../../index.js";

export function registerBuildCommand(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand(
    "md-pptx.build",
    async () => {
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

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "md-pptx: PPTX を生成中...",
          cancellable: false,
        },
        async () => {
          try {
            await buildPptx(document);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(
              `PPTX の生成に失敗しました: ${message}`,
            );
          }
        },
      );
    },
  );

  context.subscriptions.push(disposable);
}

async function buildPptx(document: vscode.TextDocument): Promise<void> {
  const mdContent = document.getText();
  const mdPath = document.uri.fsPath;
  const mdDir = path.dirname(mdPath);

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
  });

  const parsed = path.parse(mdPath);
  const outputPath = path.join(parsed.dir, parsed.name + ".pptx");
  fs.writeFileSync(outputPath, pptxData);

  vscode.window.showInformationMessage(
    `PPTX を生成しました: ${path.basename(outputPath)}`,
  );
}
