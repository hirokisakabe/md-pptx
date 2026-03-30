/**
 * VRT フィクスチャの Markdown から PPTX を生成し、LibreOffice VRT 用として保存する。
 *
 * Usage:
 *   npx tsx vrt/libreoffice/generate_fixtures.ts
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { init } from "python-pptx-wasm";
import { loadPyodide } from "pyodide";
import { parseMarkdown } from "../../src/core/parser.js";
import { extractFrontMatter } from "../../src/core/front-matter.js";
import { readTemplate } from "../../src/core/template-reader.js";
import { mapPresentation } from "../../src/core/placeholder-mapper.js";
import { generatePptx } from "../../src/core/pptx-generator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const VRT_FIXTURES = join(__dirname, "..", "fixtures");
const SAMPLE_DIR = join(__dirname, "..", "..", "sample");
const RECIPES = join(__dirname, "..", "..", "e2e", "assets", "recipes");
const OUTPUT_DIR = join(__dirname, "fixtures");

interface FixtureEntry {
  name: string;
  mdPath: string;
  mdContent: string;
  imageResolver?: (src: string) => Uint8Array | undefined;
  templateData?: Uint8Array;
}

/** imageResolver が必要なフィクスチャ名のセット */
const FIXTURES_REQUIRING_IMAGE_RESOLVER = new Set(["with-image"]);

/** テンプレートファイル名 → Uint8Array のキャッシュ */
const templateCache = new Map<string, Uint8Array>();

const TEMPLATE_BASE_DIR = join(__dirname, "..", "..", "e2e", "fixtures");

/**
 * テンプレートファイル名を解決して Uint8Array を返す。
 * テンプレートは e2e/fixtures/ 配下から読み込む。
 * パストラバーサル防止のため basename のみ許可する。
 */
function resolveTemplate(templateName: string): Uint8Array {
  const safeName = basename(templateName);
  if (templateCache.has(safeName)) {
    return templateCache.get(safeName)!;
  }
  const templatePath = resolve(TEMPLATE_BASE_DIR, safeName);
  if (!templatePath.startsWith(TEMPLATE_BASE_DIR)) {
    throw new Error(`Template path traversal detected: "${templateName}"`);
  }
  if (!existsSync(templatePath)) {
    throw new Error(`Template "${templateName}" not found at ${templatePath}`);
  }
  const data = new Uint8Array(readFileSync(templatePath));
  templateCache.set(safeName, data);
  return data;
}

function buildPptx(
  mdContent: string,
  options?: {
    imageResolver?: (src: string) => Uint8Array | undefined;
    templateData?: Uint8Array;
  },
): Uint8Array {
  const parseResult = parseMarkdown(mdContent);
  const templateInfo = readTemplate(options?.templateData);
  const mappingResults = mapPresentation(parseResult, templateInfo);
  return generatePptx(parseResult, mappingResults, {
    templateData: options?.templateData,
    imageResolver: options?.imageResolver,
  });
}

/** vrt/fixtures/ 内の .md ファイルと sample/sample.md からフィクスチャ一覧を自動生成する */
function collectFixtures(
  imageResolver: (src: string) => Uint8Array | undefined,
): FixtureEntry[] {
  const fixtures: FixtureEntry[] = readdirSync(VRT_FIXTURES)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const name = basename(f, ".md");
      const mdPath = join(VRT_FIXTURES, f);
      const mdContent = readFileSync(mdPath, "utf-8");
      const entry: FixtureEntry = { name, mdPath, mdContent };
      if (FIXTURES_REQUIRING_IMAGE_RESOLVER.has(name)) {
        entry.imageResolver = imageResolver;
      }
      const { frontMatter } = extractFrontMatter(mdContent);
      if (frontMatter.template) {
        entry.templateData = resolveTemplate(frontMatter.template);
      }
      return entry;
    });

  // sample/sample.md は vrt/fixtures/ 外にあるため個別追加
  const samplePath = join(SAMPLE_DIR, "sample.md");
  fixtures.push({
    name: "sample",
    mdPath: samplePath,
    mdContent: readFileSync(samplePath, "utf-8"),
  });

  return fixtures;
}

async function main() {
  console.log("Initializing python-pptx-wasm...");
  const lockFileURL = join(RECIPES, "pyodide-lock.json");
  const pyodide = await loadPyodide({ lockFileURL });
  await init(pyodide);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const testImagePath = join(VRT_FIXTURES, "test-image.png");
  const testImageData = existsSync(testImagePath)
    ? new Uint8Array(readFileSync(testImagePath))
    : undefined;

  const imageResolver = (src: string): Uint8Array | undefined => {
    if (src === "./test-image.png" && testImageData) return testImageData;
    return undefined;
  };

  const fixtures = collectFixtures(imageResolver);

  for (const fixture of fixtures) {
    const pptxData = buildPptx(fixture.mdContent, {
      imageResolver: fixture.imageResolver,
      templateData: fixture.templateData,
    });
    const outPath = join(OUTPUT_DIR, `${fixture.name}.pptx`);
    writeFileSync(outPath, pptxData);
    console.log(`  Generated: ${outPath} (${pptxData.length} bytes)`);
  }

  console.log("Fixture generation complete!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
