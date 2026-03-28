/**
 * VRT フィクスチャの Markdown から PPTX を生成し、LibreOffice VRT 用として保存する。
 *
 * Usage:
 *   npx tsx vrt/libreoffice/generate_fixtures.ts
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
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

  const fixtures: FixtureEntry[] = [
    { name: "basic", mdPath: join(VRT_FIXTURES, "basic.md") },
    { name: "multi-slide", mdPath: join(VRT_FIXTURES, "multi-slide.md") },
    {
      name: "with-image",
      mdPath: join(VRT_FIXTURES, "with-image.md"),
      imageResolver,
    },
    {
      name: "with-formatting",
      mdPath: join(VRT_FIXTURES, "with-formatting.md"),
    },
    {
      name: "heading-divider",
      mdPath: join(VRT_FIXTURES, "heading-divider.md"),
    },
    {
      name: "with-code-block",
      mdPath: join(VRT_FIXTURES, "with-code-block.md"),
    },
    { name: "sample", mdPath: join(SAMPLE_DIR, "sample.md") },
  ];

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
