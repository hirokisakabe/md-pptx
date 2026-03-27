import { init, Presentation, Inches, Pt } from "python-pptx-wasm";
import { loadPyodide } from "pyodide";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

interface VerifyResult {
  name: string;
  status: "OK" | "NG";
  detail: string;
}

const results: VerifyResult[] = [];

function record(name: string, status: "OK" | "NG", detail: string) {
  results.push({ name, status, detail });
  const icon = status === "OK" ? "\u2705" : "\u274C";
  console.log(`${icon} [${status}] ${name}: ${detail}`);
}

async function main() {
  console.log("=== python-pptx-wasm 動作検証 ===\n");

  // --- 初期化 ---
  console.log("Pyodide を初期化中...");
  const lockFileURL = path.join(
    PROJECT_ROOT,
    "assets/recipes/pyodide-lock.json"
  );
  const pyodide = await loadPyodide({ lockFileURL });
  await init(pyodide);
  console.log("初期化完了\n");

  // --- 検証 1: テンプレート PPTX の読み込み（Uint8Array） ---
  let prs: ReturnType<typeof Presentation>;
  try {
    prs = Presentation();
    record(
      "1. テンプレート PPTX の読み込み",
      "OK",
      "デフォルトテンプレートから Presentation を作成できた"
    );
  } catch (e) {
    record(
      "1. テンプレート PPTX の読み込み",
      "NG",
      `デフォルトテンプレートの読み込みに失敗: ${e}`
    );
    console.log("\n基本機能が動作しないため、検証を中断します。");
    printSummary();
    return;
  }

  // --- 検証 2: スライドレイアウト一覧の取得 ---
  try {
    const layouts = prs.slide_layouts;
    const layoutNames: string[] = [];
    for (let i = 0; i < layouts.length; i++) {
      const layout = layouts.getItem(i);
      layoutNames.push(`[${i}] ${layout.name}`);
    }
    record(
      "2. スライドレイアウト一覧の取得",
      "OK",
      `${layouts.length} 件のレイアウトを取得:\n    ${layoutNames.join("\n    ")}`
    );
  } catch (e) {
    record(
      "2. スライドレイアウト一覧の取得",
      "NG",
      `レイアウト一覧の取得に失敗: ${e}`
    );
  }

  // --- 検証 3: プレースホルダ情報（type/idx）の取得 ---
  try {
    const layouts = prs.slide_layouts;
    const placeholderInfos: string[] = [];
    for (let i = 0; i < layouts.length; i++) {
      const layout = layouts.getItem(i);
      const phs = layout.placeholders;
      for (let j = 0; j < phs.length; j++) {
        const ph = phs.getItem(j) as any;
        // placeholder_format 経由で idx と type を取得
        const fmt = ph.placeholder_format;
        const idx = fmt?.idx;
        const phType = fmt?.type;
        placeholderInfos.push(
          `Layout[${i}] "${layout.name}" - idx=${idx}, type=${phType}, name="${ph.name}"`
        );
      }
    }
    record(
      "3. プレースホルダ情報の取得",
      "OK",
      `プレースホルダ情報を取得:\n    ${placeholderInfos.join("\n    ")}`
    );
  } catch (e) {
    record(
      "3. プレースホルダ情報の取得",
      "NG",
      `プレースホルダ情報の取得に失敗: ${e}`
    );
  }

  // --- 検証 4: プレースホルダへのテキスト注入 ---
  try {
    // Title Slide レイアウト (index 0) を使用
    const titleLayout = prs.slide_layouts.getItem(0);
    const slide = prs.slides.add_slide(titleLayout);
    const placeholders = slide.placeholders;

    let textInjected = false;
    for (let i = 0; i < placeholders.length; i++) {
      const ph = placeholders.getItem(i) as any;
      const fmt = ph.placeholder_format;
      const idx = fmt?.idx;
      ph.text = `テストテキスト (idx=${idx})`;
      textInjected = true;
    }

    if (textInjected) {
      // 注入後のテキストを確認
      const verifyTexts: string[] = [];
      for (let i = 0; i < placeholders.length; i++) {
        const ph = placeholders.getItem(i) as any;
        const fmt = ph.placeholder_format;
        const idx = fmt?.idx;
        verifyTexts.push(`idx=${idx}: "${ph.text}"`);
      }
      record(
        "4. プレースホルダへのテキスト注入",
        "OK",
        `テキスト注入に成功:\n    ${verifyTexts.join("\n    ")}`
      );
    } else {
      record(
        "4. プレースホルダへのテキスト注入",
        "NG",
        "プレースホルダが見つからない"
      );
    }
  } catch (e) {
    record(
      "4. プレースホルダへのテキスト注入",
      "NG",
      `テキスト注入に失敗: ${e}`
    );
  }

  // --- 検証 5: プレースホルダへの画像注入 ---
  try {
    // Picture Placeholder を持つレイアウトを探す
    // デフォルトテンプレートには PicturePlaceholder がない可能性があるため、
    // 代替手段として add_picture でスライドに画像を追加する方法も検証
    const imagePath = path.join(PROJECT_ROOT, "assets/test-image.png");
    const imageData = new Uint8Array(fs.readFileSync(imagePath));

    // 方法A: PicturePlaceholder.insert_picture() を試す
    // "Picture with Caption" レイアウト (index 8) にはPicturePlaceholderがある
    let picturePlaceholderFound = false;
    const picLayout = prs.slide_layouts.getItem(8); // Picture with Caption
    const picSlide = prs.slides.add_slide(picLayout);
    const slidePhs = picSlide.placeholders;
    for (let k = 0; k < slidePhs.length; k++) {
      const slidePh = slidePhs.getItem(k) as any;
      if (typeof slidePh.insert_picture === "function") {
        slidePh.insert_picture(imageData);
        picturePlaceholderFound = true;
        record(
          "5. プレースホルダへの画像注入",
          "OK",
          `PicturePlaceholder.insert_picture() で画像注入に成功 (Layout[8] "${picLayout.name}")`
        );
        break;
      }
    }

    if (!picturePlaceholderFound) {
      // 方法B: SlideShapes.add_picture() で画像追加
      const blankLayout = prs.slide_layouts.getItem(
        prs.slide_layouts.length - 1
      );
      const picSlide = prs.slides.add_slide(blankLayout);
      picSlide.shapes.add_picture(
        imageData,
        Inches(1),
        Inches(1),
        Inches(3),
        Inches(2)
      );
      record(
        "5. プレースホルダへの画像注入",
        "OK",
        "PicturePlaceholder は見つからなかったが、shapes.add_picture() で画像追加に成功"
      );
    }
  } catch (e) {
    record(
      "5. プレースホルダへの画像注入",
      "NG",
      `画像注入に失敗: ${e}`
    );
  }

  // --- 検証 6: 出力 PPTX の保存 ---
  try {
    const outputDir = path.join(PROJECT_ROOT, "output");
    fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, "verify-output.pptx");

    const buffer = prs.save();
    if (buffer instanceof Uint8Array) {
      fs.writeFileSync(outputPath, buffer);
      const stat = fs.statSync(outputPath);
      record(
        "6. 出力 PPTX の保存",
        "OK",
        `ファイル保存に成功: ${outputPath} (${stat.size} bytes)\n    ※ PowerPoint で開いて正常に表示されるか手動で確認してください`
      );
    } else {
      record(
        "6. 出力 PPTX の保存",
        "NG",
        "save() が Uint8Array を返さなかった"
      );
    }
  } catch (e) {
    record("6. 出力 PPTX の保存", "NG", `ファイル保存に失敗: ${e}`);
  }

  // --- クリーンアップ ---
  prs.end();

  // --- テンプレート PPTX の読み込み検証 (Uint8Array 渡し) ---
  console.log("\n--- 追加検証: 外部 PPTX ファイルの Uint8Array 読み込み ---");
  try {
    const outputPath = path.join(PROJECT_ROOT, "output/verify-output.pptx");
    const pptxBuffer = new Uint8Array(fs.readFileSync(outputPath));
    const prs2 = Presentation(pptxBuffer);
    const slideCount = prs2.slides.length;
    const layoutCount = prs2.slide_layouts.length;
    record(
      "追加: 外部 PPTX の Uint8Array 読み込み",
      "OK",
      `保存した PPTX を再読み込み: スライド数=${slideCount}, レイアウト数=${layoutCount}`
    );
    prs2.end();
  } catch (e) {
    record(
      "追加: 外部 PPTX の Uint8Array 読み込み",
      "NG",
      `再読み込みに失敗: ${e}`
    );
  }

  printSummary();
}

function printSummary() {
  console.log("\n========================================");
  console.log("検証結果サマリ");
  console.log("========================================");
  const okCount = results.filter((r) => r.status === "OK").length;
  const ngCount = results.filter((r) => r.status === "NG").length;
  console.log(`OK: ${okCount} / NG: ${ngCount} / 合計: ${results.length}`);
  console.log("");
  for (const r of results) {
    const icon = r.status === "OK" ? "\u2705" : "\u274C";
    console.log(`${icon} ${r.name}`);
  }

  // 結果を RESULTS.md に書き出し
  const md = generateResultsMd();
  const resultsPath = path.join(PROJECT_ROOT, "RESULTS.md");
  fs.writeFileSync(resultsPath, md);
  console.log(`\n検証結果を ${resultsPath} に保存しました。`);
}

function generateResultsMd(): string {
  const lines: string[] = [];
  lines.push("# python-pptx-wasm 動作検証結果");
  lines.push("");
  lines.push(`検証日時: ${new Date().toISOString()}`);
  lines.push("python-pptx-wasm: v0.0.1");
  lines.push("");
  lines.push("## サマリ");
  lines.push("");

  const okCount = results.filter((r) => r.status === "OK").length;
  const ngCount = results.filter((r) => r.status === "NG").length;
  lines.push(`| 結果 | 件数 |`);
  lines.push(`|------|------|`);
  lines.push(`| OK | ${okCount} |`);
  lines.push(`| NG | ${ngCount} |`);
  lines.push(`| 合計 | ${results.length} |`);
  lines.push("");
  lines.push("## 詳細");
  lines.push("");

  for (const r of results) {
    const icon = r.status === "OK" ? "\u2705" : "\u274C";
    lines.push(`### ${icon} ${r.name}`);
    lines.push("");
    lines.push(`**結果**: ${r.status}`);
    lines.push("");
    lines.push("```");
    lines.push(r.detail);
    lines.push("```");
    lines.push("");
  }

  lines.push("## 備考");
  lines.push("");
  lines.push(
    '- v0.0.1 で "part components are not implemented" と明記されている'
  );
  lines.push("- 出力 PPTX の確認は手動で PowerPoint を使って行う必要がある");
  lines.push("");

  return lines.join("\n");
}

main().catch((e) => {
  console.error("検証中にエラーが発生しました:", e);
  process.exit(1);
});
