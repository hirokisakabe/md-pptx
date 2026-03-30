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
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { init } from "python-pptx-wasm";
import { loadPyodide } from "pyodide";
import { parseMarkdown } from "../../src/core/parser.js";
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
  imageResolver?: (src: string) => Uint8Array | undefined;
}

/** imageResolver が必要なフィクスチャ名のセット */
const FIXTURES_REQUIRING_IMAGE_RESOLVER = new Set(["with-image"]);

function buildPptx(
  mdContent: string,
  options?: { imageResolver?: (src: string) => Uint8Array | undefined },
): Uint8Array {
  const parseResult = parseMarkdown(mdContent);
  const templateInfo = readTemplate();
  const mappingResults = mapPresentation(parseResult, templateInfo);
  return generatePptx(parseResult, mappingResults, {
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
      const entry: FixtureEntry = { name, mdPath: join(VRT_FIXTURES, f) };
      if (FIXTURES_REQUIRING_IMAGE_RESOLVER.has(name)) {
        entry.imageResolver = imageResolver;
      }
      return entry;
    });

  // sample/sample.md は vrt/fixtures/ 外にあるため個別追加
  fixtures.push({ name: "sample", mdPath: join(SAMPLE_DIR, "sample.md") });

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
    if (!existsSync(fixture.mdPath)) {
      console.log(`  SKIP: ${fixture.mdPath} not found`);
      continue;
    }

    const md = readFileSync(fixture.mdPath, "utf-8");
    const pptxData = buildPptx(md, { imageResolver: fixture.imageResolver });
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
