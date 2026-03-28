import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
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

let tmpDir: string;

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf-8");
}

function outputPath(name: string): string {
  return join(tmpDir, name);
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

beforeAll(async () => {
  // python-pptx-wasm の初期化（レシピから python-pptx パッケージをロード）
  const lockFileURL = join(RECIPES, "pyodide-lock.json");
  const pyodide = await loadPyodide({ lockFileURL });
  await init(pyodide);

  // 一時出力ディレクトリ
  tmpDir = mkdtempSync(join(tmpdir(), "md-pptx-e2e-"));
}, 120_000);

afterAll(() => {
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe("E2E: PPTX生成パイプライン", () => {
  it("基本的なタイトル+コンテンツスライドを生成できる", async () => {
    const md = readFixture("basic.md");
    const pptxData = buildPptx(md);

    assertValidPptx(pptxData);

    const slideCount = await countSlides(pptxData);
    expect(slideCount).toBe(1);

    // ファイルとして保存し、存在・サイズを確認
    const out = outputPath("basic.pptx");
    writeFileSync(out, pptxData);
    expect(existsSync(out)).toBe(true);
    expect(readFileSync(out).length).toBeGreaterThan(0);
  });

  it("複数スライドを生成できる（--- 区切り）", async () => {
    const md = readFixture("multi-slide.md");
    const pptxData = buildPptx(md);

    assertValidPptx(pptxData);

    const slideCount = await countSlides(pptxData);
    expect(slideCount).toBe(3);
  });

  it("画像を含むスライドを生成できる", async () => {
    const md = readFixture("with-image.md");
    const imageData = new Uint8Array(
      readFileSync(join(FIXTURES, "test-image.png")),
    );

    const imageResolver = (src: string): Uint8Array | undefined => {
      if (src === "./test-image.png") return imageData;
      return undefined;
    };

    const pptxData = buildPptx(md, { imageResolver });

    assertValidPptx(pptxData);

    const slideCount = await countSlides(pptxData);
    expect(slideCount).toBe(1);

    // デフォルトテンプレート（Blankレイアウト）にはpictureプレースホルダがないため
    // 画像はフォールバックテキストとして処理される（正常動作）
    const zip = await JSZip.loadAsync(pptxData);
    expect(zip.file("ppt/slides/slide1.xml")).not.toBeNull();
  });

  it("テキスト書式（太字・斜体・コード）を含むスライドを生成できる", async () => {
    const md = readFixture("with-formatting.md");
    const pptxData = buildPptx(md);

    assertValidPptx(pptxData);

    const slideCount = await countSlides(pptxData);
    expect(slideCount).toBe(1);
  });

  it("コードブロックを含むスライドを生成できる", async () => {
    const md = readFixture("with-code-block.md");
    const pptxData = buildPptx(md);

    assertValidPptx(pptxData);

    const slideCount = await countSlides(pptxData);
    expect(slideCount).toBe(3);

    const zip = await JSZip.loadAsync(pptxData);
    const slide1 = await zip.file("ppt/slides/slide1.xml")!.async("string");
    expect(slide1).toContain("コードブロックのテスト");
    expect(slide1).toContain("function hello");
  });

  it("headingDivider で自動分割されたスライドを生成できる", async () => {
    const md = readFixture("heading-divider.md");
    const pptxData = buildPptx(md);

    assertValidPptx(pptxData);

    // headingDivider: 2 → h1「セクション1」、h2「スライドA」、h2「スライドB」で3スライド
    const slideCount = await countSlides(pptxData);
    expect(slideCount).toBe(3);
  });
});

describe("E2E: テンプレート情報の取得（inspect相当）", () => {
  it("デフォルトテンプレートのレイアウト一覧を取得できる", () => {
    const templateInfo = readTemplate();

    expect(templateInfo.layouts.length).toBeGreaterThan(0);

    // デフォルトテンプレートには少なくとも "Title Slide" と "Blank" が含まれる
    const layoutNames = templateInfo.layouts.map((l) => l.name);
    expect(layoutNames).toContain("Title Slide");
    expect(layoutNames).toContain("Blank");
  });

  it("各レイアウトのプレースホルダ情報を取得できる", () => {
    const templateInfo = readTemplate();

    const titleSlide = templateInfo.layouts.find(
      (l) => l.name === "Title Slide",
    );
    expect(titleSlide).toBeDefined();
    expect(titleSlide!.placeholders.length).toBeGreaterThan(0);

    // Title Slide には title プレースホルダが含まれる
    const titlePh = titleSlide!.placeholders.find((p) => p.type === "title");
    expect(titlePh).toBeDefined();
    expect(titlePh!.idx).toBeDefined();
    expect(titlePh!.name).toBeTruthy();
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

  it("sample.mdからPPTXを生成すると全スライド・全要素が含まれる", async () => {
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

    // --- スライド1: Title Slide レイアウト ---
    const slide1 = await zip.file("ppt/slides/slide1.xml")!.async("string");
    expect(slide1).toContain("md-pptx サンプル");
    expect(slide1).toContain("VS Code拡張の動作確認用");

    // --- スライド2: 概要（箇条書き + 書式 + プレゼンターノート） ---
    const slide2 = await zip.file("ppt/slides/slide2.xml")!.async("string");
    expect(slide2).toContain("概要");
    expect(slide2).toContain("MarkdownからPPTXを生成するツール");
    // 太字テキスト
    expect(slide2).toContain("テンプレートPPTX");
    // 斜体テキスト
    expect(slide2).toContain("編集可能な");
    // PPTXを出力
    expect(slide2).toContain("PPTXを出力");
    // プレゼンターノート（スライド2に紐づくnotesSlideを検証）
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

    // --- スライド3: テキスト書式のサンプル ---
    const slide3 = await zip.file("ppt/slides/slide3.xml")!.async("string");
    expect(slide3).toContain("テキスト書式のサンプル");
    // 各書式のテキストが含まれる
    expect(slide3).toContain("通常テキスト");
    expect(slide3).toContain("太字テキスト");
    expect(slide3).toContain("斜体テキスト");
    expect(slide3).toContain("コード");
    expect(slide3).toContain("取り消し線");
    // リンクテキスト
    expect(slide3).toContain("リンクのサンプル");

    // --- スライド4: リストのサンプル（ネスト付き箇条書き） ---
    const slide4 = await zip.file("ppt/slides/slide4.xml")!.async("string");
    expect(slide4).toContain("リストのサンプル");
    expect(slide4).toContain("箇条書き項目1");
    expect(slide4).toContain("箇条書き項目2");
    expect(slide4).toContain("ネストされた項目");
    expect(slide4).toContain("さらにネスト");
    expect(slide4).toContain("箇条書き項目3");

    // --- スライド5: 番号付きリスト ---
    const slide5 = await zip.file("ppt/slides/slide5.xml")!.async("string");
    expect(slide5).toContain("番号付きリスト");
    expect(slide5).toContain("最初の項目");
    expect(slide5).toContain("二番目の項目");
    expect(slide5).toContain("三番目の項目");

    // --- スライド6: Title Slide レイアウト（締めスライド） ---
    const slide6 = await zip.file("ppt/slides/slide6.xml")!.async("string");
    expect(slide6).toContain("ご清聴ありがとうございました");
    // メールリンクテキスト
    expect(slide6).toContain("info@example.com");
  });

  it("生成PPTXをファイルに保存して再読み込みできる", () => {
    const md = readFixture("multi-slide.md");
    const pptxData = buildPptx(md);

    const out = outputPath("roundtrip.pptx");
    writeFileSync(out, pptxData);

    // 保存したファイルを再読み込みしてテンプレート情報を取得
    const reloadedData = new Uint8Array(readFileSync(out));
    const templateInfo = readTemplate(reloadedData);
    expect(templateInfo.layouts.length).toBeGreaterThan(0);
  });
});
