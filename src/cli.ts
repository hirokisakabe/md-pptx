import { readFileSync, writeFileSync, realpathSync } from "node:fs";
import { resolve, dirname, basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { parseMarkdown } from "./core/parser.js";
import { readTemplate } from "./core/template-reader.js";
import { mapPresentation } from "./core/placeholder-mapper.js";
import { generatePptx } from "./core/pptx-generator.js";

export function buildAction(
  markdownPath: string,
  options: { template?: string; output?: string },
): void {
  const resolvedMdPath = resolve(markdownPath);
  const mdContent = readFileSync(resolvedMdPath, "utf-8");
  const mdDir = dirname(resolvedMdPath);

  const parseResult = parseMarkdown(mdContent);

  const templatePath = options.template ?? parseResult.frontMatter.template;
  let templateData: Uint8Array | undefined;
  if (templatePath) {
    const resolvedTemplatePath = resolve(mdDir, templatePath);
    templateData = new Uint8Array(readFileSync(resolvedTemplatePath));
  }

  const templateInfo = readTemplate(templateData);
  const mappingResults = mapPresentation(parseResult, templateInfo);

  const imageResolver = (src: string): Uint8Array | undefined => {
    try {
      const imagePath = resolve(mdDir, src);
      return new Uint8Array(readFileSync(imagePath));
    } catch {
      console.error(`Warning: 画像ファイルが見つかりません: ${src}`);
      return undefined;
    }
  };

  const pptxData = generatePptx(parseResult, mappingResults, {
    templateData,
    imageResolver,
  });

  const outputPath =
    options.output ??
    join(
      dirname(resolvedMdPath),
      basename(resolvedMdPath, extname(resolvedMdPath)) + ".pptx",
    );
  const resolvedOutputPath = resolve(outputPath);
  writeFileSync(resolvedOutputPath, pptxData);

  console.log(`PPTX を生成しました: ${resolvedOutputPath}`);
}

export function inspectAction(templatePath: string): void {
  const resolvedPath = resolve(templatePath);
  const data = new Uint8Array(readFileSync(resolvedPath));
  const templateInfo = readTemplate(data);

  console.log(`テンプレート: ${resolvedPath}`);
  console.log(`レイアウト数: ${templateInfo.layouts.length}`);
  console.log("");

  for (const layout of templateInfo.layouts) {
    console.log(`  [${layout.name}]`);
    if (layout.placeholders.length === 0) {
      console.log("    (プレースホルダなし)");
    } else {
      for (const ph of layout.placeholders) {
        console.log(`    - idx: ${ph.idx}, type: ${ph.type}, name: ${ph.name}`);
      }
    }
    console.log("");
  }
}

export function createProgram(): Command {
  const program = new Command();

  program
    .name("md-pptx")
    .description(
      "Markdown とテンプレート PPTX から編集可能な PowerPoint ファイルを生成するツール",
    )
    .version("0.0.0");

  program
    .command("build")
    .description("MarkdownファイルからPPTXを生成する")
    .argument("<markdown>", "Markdownファイルパス")
    .option("-t, --template <path>", "テンプレートPPTXパス")
    .option("-o, --output <path>", "出力先パス")
    .action(
      (
        markdownPath: string,
        options: { template?: string; output?: string },
      ) => {
        try {
          buildAction(markdownPath, options);
        } catch (error) {
          console.error(
            `Error: ${error instanceof Error ? error.message : String(error)}`,
          );
          process.exitCode = 1;
        }
      },
    );

  program
    .command("inspect")
    .description("テンプレートPPTXのレイアウト情報を表示する")
    .argument("<template>", "テンプレートPPTXパス")
    .action((templatePath: string) => {
      try {
        inspectAction(templatePath);
      } catch (error) {
        console.error(
          `Error: ${error instanceof Error ? error.message : String(error)}`,
        );
        process.exitCode = 1;
      }
    });

  return program;
}

const thisFile = fileURLToPath(import.meta.url);
const argFile = process.argv[1];
const isDirectRun =
  argFile &&
  (argFile === thisFile || realpathSync(argFile) === realpathSync(thisFile));

if (isDirectRun) {
  createProgram().parse();
}
