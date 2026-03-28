import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { init } from "python-pptx-wasm";
import { loadPyodide } from "pyodide";
import JSZip from "jszip";
import { parseMarkdown } from "../src/core/parser.js";
import { readTemplate } from "../src/core/template-reader.js";
import { mapPresentation } from "../src/core/placeholder-mapper.js";
import { generatePptx } from "../src/core/pptx-generator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");
const RECIPES = join(__dirname, "assets", "recipes");

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf-8");
}

/** 生成したPPTXバイナリを検証するヘルパー */
function assertValidPptx(data: Uint8Array) {
  // PPTXはZIP形式なのでマジックバイト PK (0x50, 0x4B) で始まる
  expect(data.length).toBeGreaterThan(0);
  expect(data[0]).toBe(0x50);
  expect(data[1]).toBe(0x4b);
}

/** PPTXバイナリまたはJSZipインスタンスからスライド数を取得するヘルパー */
async function countSlides(data: Uint8Array | JSZip): Promise<number> {
  const zip = data instanceof JSZip ? data : await JSZip.loadAsync(data);
  let count = 0;
  zip.forEach((relativePath) => {
    if (/^ppt\/slides\/slide\d+\.xml$/.test(relativePath)) {
      count++;
    }
  });
  return count;
}

/** Markdown → PPTX 生成のE2Eパイプライン */
function buildPptx(mdContent: string): Uint8Array {
  const parseResult = parseMarkdown(mdContent);
  const templateInfo = readTemplate();
  const mappingResults = mapPresentation(parseResult, templateInfo);
  return generatePptx(parseResult, mappingResults);
}

beforeAll(async () => {
  // python-pptx-wasm の初期化（レシピから python-pptx パッケージをロード）
  const lockFileURL = join(RECIPES, "pyodide-lock.json");
  const pyodide = await loadPyodide({ lockFileURL });
  await init(pyodide);
}, 120_000);

describe("E2E: 生成PPTXの内容検証", () => {
  it("生成PPTXにスライドXMLが含まれている", async () => {
    const md = readFixture("basic.md");
    const pptxData = buildPptx(md);

    const zip = await JSZip.loadAsync(pptxData);

    // 必須ファイルが含まれている
    expect(zip.file("[Content_Types].xml")).not.toBeNull();
    expect(zip.file("ppt/presentation.xml")).not.toBeNull();
    expect(zip.file("ppt/slides/slide1.xml")).not.toBeNull();
  });

  it("レイアウト指定時にプレースホルダ構造が含まれている", async () => {
    // デフォルトテンプレートの "Title Slide" レイアウトを明示的に指定
    const md = [
      "---",
      "layout: Title Slide",
      "---",
      "",
      "# プレゼンテーションタイトル",
    ].join("\n");
    const pptxData = buildPptx(md);

    const zip = await JSZip.loadAsync(pptxData);
    const slideXml = await zip.file("ppt/slides/slide1.xml")!.async("string");

    // Title Slide レイアウトのプレースホルダ構造が含まれている
    expect(slideXml).toContain("ctrTitle");
    expect(slideXml).toContain("Title 1");
  });

  it("テーブルを含むMarkdownからPPTXを生成するとテーブルXMLが含まれる", async () => {
    const md = readFixture("with-table.md");
    const pptxData = buildPptx(md);

    assertValidPptx(pptxData);

    const zip = await JSZip.loadAsync(pptxData);
    const slideCount = await countSlides(zip);
    expect(slideCount).toBe(1);

    const slideXml = await zip.file("ppt/slides/slide1.xml")!.async("string");
    // テーブルが含まれている (a:tbl はDrawingML Table要素)
    expect(slideXml).toContain("a:tbl");
    // セルの内容が含まれている
    expect(slideXml).toContain("項目");
    expect(slideXml).toContain("100");
    expect(slideXml).toContain("200");
  });

  it("sample.mdからPPTXを生成すると全スライドXMLが生成されノート関連付けが正しい", async () => {
    const md = readFileSync(
      join(__dirname, "..", "sample", "sample.md"),
      "utf-8",
    );
    const pptxData = buildPptx(md);

    assertValidPptx(pptxData);

    const zip = await JSZip.loadAsync(pptxData);

    // スライド数: 6枚
    const slideCount = await countSlides(zip);
    expect(slideCount).toBe(6);

    // 全スライドのXMLファイルが存在する
    for (let i = 1; i <= 6; i++) {
      expect(zip.file(`ppt/slides/slide${i}.xml`)).not.toBeNull();
    }

    // --- スライド2: プレゼンターノートの関連付け検証 ---
    const slide2Rels = zip.file("ppt/slides/_rels/slide2.xml.rels");
    expect(slide2Rels).not.toBeNull();
    const slide2RelsXml = await slide2Rels!.async("string");
    const notesMatch = slide2RelsXml.match(
      /Target="(\.\.\/notesSlides\/notesSlide\d+\.xml)"/,
    );
    expect(notesMatch).not.toBeNull();
    const notesPath = notesMatch![1].replace("../", "ppt/");
    const notesFile = zip.file(notesPath);
    expect(notesFile).not.toBeNull();
    const notesXml = await notesFile!.async("string");
    expect(notesXml).toContain("ここがプレゼンターノートになります");
  });
});
