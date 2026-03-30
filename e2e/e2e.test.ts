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
import { extractBackgrounds } from "../src/core/slide-master-extractor.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");
const RECIPES = join(__dirname, "assets", "recipes");

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf-8");
}

function readFixtureBinary(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(FIXTURES, name)));
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

/** スライドが参照するレイアウト XML の name 属性を取得するヘルパー */
async function getSlideLayoutName(
  zip: JSZip,
  slideIndex: number,
): Promise<string | null> {
  const relsPath = `ppt/slides/_rels/slide${slideIndex}.xml.rels`;
  const relsFile = zip.file(relsPath);
  if (!relsFile) return null;
  const relsXml = await relsFile.async("string");
  const layoutMatch = relsXml.match(
    /Target="(\.\.\/slideLayouts\/slideLayout\d+\.xml)"/,
  );
  if (!layoutMatch) return null;
  const layoutPath = layoutMatch[1].replace("../", "ppt/");
  const layoutFile = zip.file(layoutPath);
  if (!layoutFile) return null;
  const layoutXml = await layoutFile.async("string");
  const nameMatch = layoutXml.match(/name="([^"]+)"/);
  return nameMatch ? nameMatch[1] : null;
}

/** Markdown → PPTX 生成のE2Eパイプライン */
function buildPptx(
  mdContent: string,
  options?: {
    templateData?: Uint8Array;
    imageResolver?: (src: string) => Uint8Array | undefined;
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

beforeAll(async () => {
  // python-pptx-wasm の初期化（レシピから python-pptx パッケージをロード）
  const lockFileURL = join(RECIPES, "pyodide-lock.json");
  const pyodide = await loadPyodide({ lockFileURL });
  await init(pyodide);
}, 120_000);

describe("E2E: テンプレートPPTXを使用した生成", () => {
  it("テンプレート指定時にPPTXが正常に生成される", async () => {
    const templateData = readFixtureBinary("test-template.pptx");
    const md = readFixture("basic.md");
    const pptxData = buildPptx(md, { templateData });

    assertValidPptx(pptxData);
    const slideCount = await countSlides(pptxData);
    expect(slideCount).toBe(1);
  });

  it("テンプレートのレイアウトを明示的に指定して生成できる", async () => {
    const templateData = readFixtureBinary("test-template.pptx");
    const md = [
      "---",
      "layout: Section Header",
      "---",
      "",
      "# セクションタイトル",
      "",
      "セクションの説明テキスト",
    ].join("\n");
    const pptxData = buildPptx(md, { templateData });

    assertValidPptx(pptxData);
    const zip = await JSZip.loadAsync(pptxData);
    const slideXml = await zip.file("ppt/slides/slide1.xml")!.async("string");
    expect(slideXml).toContain("セクションタイトル");

    // 実際に Section Header レイアウトが使用されていることを検証
    const layoutName = await getSlideLayoutName(zip, 1);
    expect(layoutName).toBe("Section Header");
  });

  it("非連番プレースホルダー idx レイアウトでテキストが注入される", async () => {
    const templateData = readFixtureBinary("test-template.pptx");
    const md = [
      "---",
      "layout: Non Sequential Idx",
      "---",
      "",
      "# 非連番タイトル",
      "",
      "非連番ボディテキスト",
    ].join("\n");
    const pptxData = buildPptx(md, { templateData });

    assertValidPptx(pptxData);
    const zip = await JSZip.loadAsync(pptxData);
    const slideXml = await zip.file("ppt/slides/slide1.xml")!.async("string");
    expect(slideXml).toContain("非連番タイトル");
    expect(slideXml).toContain("非連番ボディテキスト");

    // 実際に Non Sequential Idx レイアウトが使用されていることを検証
    const layoutName = await getSlideLayoutName(zip, 1);
    expect(layoutName).toBe("Non Sequential Idx");
  });

  it("テンプレート使用時に複数スライドを生成できる", async () => {
    const templateData = readFixtureBinary("test-template.pptx");
    const md = [
      "# スライド1",
      "",
      "本文1",
      "",
      "---",
      "",
      "# スライド2",
      "",
      "本文2",
      "",
      "---",
      "",
      "# スライド3",
      "",
      "本文3",
    ].join("\n");
    const pptxData = buildPptx(md, { templateData });

    assertValidPptx(pptxData);
    const slideCount = await countSlides(pptxData);
    expect(slideCount).toBe(3);
  });
});

describe("E2E: テンプレートの背景画像抽出", () => {
  it("スライドマスター背景画像を抽出できる", async () => {
    const templateData = readFixtureBinary("test-template.pptx");
    const result = await extractBackgrounds(templateData);

    expect(result.masters).toHaveLength(1);
    expect(result.masters[0].contentType).toBe("image/jpeg");
    expect(result.masters[0].data.length).toBeGreaterThan(0);
    expect(result.masters[0].dataUrl).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("レイアウト固有の背景画像を抽出できる", async () => {
    const templateData = readFixtureBinary("test-template.pptx");
    const result = await extractBackgrounds(templateData);

    expect(result.layouts).toHaveLength(1);
    expect(result.layouts[0].layoutName).toBe("Section Header");
    expect(result.layouts[0].contentType).toBe("image/jpeg");
    expect(result.layouts[0].data.length).toBeGreaterThan(0);
  });

  it("テンプレートから生成したPPTXにも背景画像が引き継がれる", async () => {
    const templateData = readFixtureBinary("test-template.pptx");
    const md = "# テスト\n\nテスト本文";
    const pptxData = buildPptx(md, { templateData });

    const result = await extractBackgrounds(pptxData);
    // 生成後の PPTX にもマスター背景が保持されている
    expect(result.masters.length).toBeGreaterThanOrEqual(1);
    expect(result.masters[0].contentType).toBe("image/jpeg");
  });
});

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
