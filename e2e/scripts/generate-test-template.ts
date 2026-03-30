/**
 * テスト用テンプレート PPTX を生成するスクリプト。
 *
 * python-pptx-wasm のデフォルト Presentation() をベースに、
 * - 非連番プレースホルダー idx を持つカスタムレイアウトを追加
 * - スライドマスター背景画像を設定
 * - 特定レイアウト（Section Header）に固有の背景画像を設定
 *
 * Usage:
 *   npx tsx e2e/scripts/generate-test-template.ts
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { init } from "python-pptx-wasm";
import { loadPyodide } from "pyodide";
import { Presentation } from "python-pptx-wasm";
import JSZip from "jszip";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RECIPES = join(__dirname, "..", "assets", "recipes");
const FIXTURES_DIR = join(__dirname, "..", "fixtures");

// --- ヘルパー: rels の rId 管理 ---

/** rels XML 内の最大 rId 番号を取得する */
function getMaxRId(relsXml: string): number {
  const matches = [...relsXml.matchAll(/Id="rId(\d+)"/g)];
  if (matches.length === 0) return 0;
  return Math.max(...matches.map((m) => parseInt(m[1], 10)));
}

/** rels XML に新しい Relationship を追加して返す */
function addRelationship(
  relsXml: string,
  rId: string,
  type: string,
  target: string,
): string {
  return relsXml.replace(
    "</Relationships>",
    `  <Relationship Id="${rId}" Type="${type}" Target="${target}"/>
</Relationships>`,
  );
}

// --- 非連番プレースホルダー idx レイアウト ---

function buildNonSequentialLayoutXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
             type="obj" preserve="1">
  <p:cSld name="Non Sequential Idx">
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title 1"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="title" idx="0"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="838200" y="365125"/>
            <a:ext cx="10515600" cy="1325563"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p><a:r><a:t>Title</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="Content Placeholder 10"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph idx="10"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="838200" y="1825625"/>
            <a:ext cx="10515600" cy="4351338"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p><a:r><a:t>Body</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`;
}

// --- カスタマイズ処理 ---

/**
 * デフォルトテンプレートに以下を追加して返す:
 * 1. 非連番 idx レイアウト
 * 2. スライドマスター背景画像 (bg-master.jpg)
 * 3. Section Header レイアウト固有背景画像 (bg-layout.jpg)
 */
async function customizeTemplate(basePptx: Uint8Array): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(basePptx);

  await addNonSequentialLayout(zip);
  await addBackgroundImages(zip);

  return new Uint8Array(
    await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }),
  );
}

/** 非連番 idx レイアウトを追加する */
async function addNonSequentialLayout(zip: JSZip): Promise<void> {
  // 既存のスライドレイアウト数を数える
  let layoutCount = 0;
  zip.forEach((path) => {
    if (/^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(path)) {
      layoutCount++;
    }
  });
  const newLayoutIndex = layoutCount + 1;
  const layoutPath = `ppt/slideLayouts/slideLayout${newLayoutIndex}.xml`;

  // 既存レイアウトの rels から slideMaster への rId を取得
  const layout1RelsPath = "ppt/slideLayouts/_rels/slideLayout1.xml.rels";
  const layout1RelsContent = await zip.file(layout1RelsPath)!.async("string");
  const masterMatch = layout1RelsContent.match(
    /Id="(rId\d+)"[^>]*Target="[^"]*slideMaster/,
  );
  const masterRId = masterMatch ? masterMatch[1] : "rId1";

  // 新しいレイアウトの XML と rels を追加
  zip.file(layoutPath, buildNonSequentialLayoutXml());
  zip.file(
    `ppt/slideLayouts/_rels/slideLayout${newLayoutIndex}.xml.rels`,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="${masterRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`,
  );

  // slideMaster1.xml.rels にレイアウトへの関係を追加
  const masterRelsPath = "ppt/slideMasters/_rels/slideMaster1.xml.rels";
  let masterRelsContent = await zip.file(masterRelsPath)!.async("string");
  const newRId = `rId${getMaxRId(masterRelsContent) + 1}`;
  masterRelsContent = addRelationship(
    masterRelsContent,
    newRId,
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout",
    `../slideLayouts/slideLayout${newLayoutIndex}.xml`,
  );
  zip.file(masterRelsPath, masterRelsContent);

  // slideMaster1.xml の sldLayoutIdLst に追加
  const masterPath = "ppt/slideMasters/slideMaster1.xml";
  let masterContent = await zip.file(masterPath)!.async("string");
  const layoutIdMatches = [...masterContent.matchAll(/id="(\d+)"/g)];
  const newLayoutId =
    Math.max(...layoutIdMatches.map((m) => parseInt(m[1], 10))) + 1;
  masterContent = masterContent.replace(
    "</p:sldLayoutIdLst>",
    `  <p:sldLayoutId id="${newLayoutId}" r:id="${newRId}"/>
    </p:sldLayoutIdLst>`,
  );
  zip.file(masterPath, masterContent);

  // [Content_Types].xml にエントリを追加
  let contentTypes = await zip.file("[Content_Types].xml")!.async("string");
  contentTypes = contentTypes.replace(
    "</Types>",
    `  <Override PartName="/${layoutPath}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
</Types>`,
  );
  zip.file("[Content_Types].xml", contentTypes);
}

/**
 * 背景画像を埋め込む:
 * - bg-master.jpg → スライドマスター背景
 * - bg-layout.jpg → Section Header レイアウト固有背景
 */
async function addBackgroundImages(zip: JSZip): Promise<void> {
  const bgMasterPath = join(FIXTURES_DIR, "bg-master.jpg");
  const bgLayoutPath = join(FIXTURES_DIR, "bg-layout.jpg");

  if (!existsSync(bgMasterPath) || !existsSync(bgLayoutPath)) {
    console.warn(
      "  WARN: bg-master.jpg or bg-layout.jpg not found, skipping background images",
    );
    return;
  }

  const bgMasterData = readFileSync(bgMasterPath);
  const bgLayoutData = readFileSync(bgLayoutPath);

  // メディアファイルを ZIP に追加
  zip.file("ppt/media/bg-master.jpg", bgMasterData);
  zip.file("ppt/media/bg-layout.jpg", bgLayoutData);

  // [Content_Types].xml に JPEG のデフォルトエントリを追加（まだなければ）
  let contentTypes = await zip.file("[Content_Types].xml")!.async("string");
  if (!contentTypes.includes('Extension="jpg"')) {
    contentTypes = contentTypes.replace(
      "</Types>",
      `  <Default Extension="jpg" ContentType="image/jpeg"/>
</Types>`,
    );
    zip.file("[Content_Types].xml", contentTypes);
  }

  // --- スライドマスター背景 ---
  await addMasterBackground(zip);

  // --- Section Header レイアウト固有背景 ---
  await addLayoutBackground(zip);
}

/** スライドマスターに背景画像を設定する */
async function addMasterBackground(zip: JSZip): Promise<void> {
  const masterPath = "ppt/slideMasters/slideMaster1.xml";
  const masterRelsPath = "ppt/slideMasters/_rels/slideMaster1.xml.rels";

  let masterRels = await zip.file(masterRelsPath)!.async("string");
  const bgRId = `rId${getMaxRId(masterRels) + 1}`;
  masterRels = addRelationship(
    masterRels,
    bgRId,
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
    "../media/bg-master.jpg",
  );
  zip.file(masterRelsPath, masterRels);

  // slideMaster XML に <p:bg> を追加
  let masterXml = await zip.file(masterPath)!.async("string");
  const bgXml = `<p:bg>
      <p:bgPr>
        <a:blipFill>
          <a:blip r:embed="${bgRId}"/>
          <a:stretch><a:fillRect/></a:stretch>
        </a:blipFill>
        <a:effectLst/>
      </p:bgPr>
    </p:bg>`;

  // <p:cSld> の直後の子要素として <p:bg> を挿入
  masterXml = masterXml.replace(/(<p:cSld[^>]*>)/, `$1\n    ${bgXml}`);
  zip.file(masterPath, masterXml);
}

/** Section Header レイアウトに固有の背景画像を設定する */
async function addLayoutBackground(zip: JSZip): Promise<void> {
  // Section Header レイアウトを探す
  const layoutFiles: string[] = [];
  zip.forEach((path) => {
    if (/^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(path)) {
      layoutFiles.push(path);
    }
  });

  let targetLayoutPath: string | undefined;
  for (const layoutPath of layoutFiles) {
    const xml = await zip.file(layoutPath)!.async("string");
    if (xml.includes('name="Section Header"')) {
      targetLayoutPath = layoutPath;
      break;
    }
  }

  if (!targetLayoutPath) {
    console.warn("  WARN: Section Header layout not found");
    return;
  }

  // レイアウトの rels にメディア参照を追加
  const layoutFileName = targetLayoutPath.split("/").pop()!;
  const layoutRelsPath = `ppt/slideLayouts/_rels/${layoutFileName}.rels`;
  let layoutRels = await zip.file(layoutRelsPath)!.async("string");
  const bgRId = `rId${getMaxRId(layoutRels) + 1}`;
  layoutRels = addRelationship(
    layoutRels,
    bgRId,
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
    "../media/bg-layout.jpg",
  );
  zip.file(layoutRelsPath, layoutRels);

  // レイアウト XML に <p:bg> を追加
  let layoutXml = await zip.file(targetLayoutPath)!.async("string");
  const bgXml = `<p:bg>
      <p:bgPr>
        <a:blipFill>
          <a:blip r:embed="${bgRId}"/>
          <a:stretch><a:fillRect/></a:stretch>
        </a:blipFill>
        <a:effectLst/>
      </p:bgPr>
    </p:bg>`;

  layoutXml = layoutXml.replace(/(<p:cSld[^>]*>)/, `$1\n    ${bgXml}`);
  zip.file(targetLayoutPath, layoutXml);
}

// --- メイン処理 ---

async function main() {
  console.log("Initializing python-pptx-wasm...");
  const lockFileURL = join(RECIPES, "pyodide-lock.json");

  if (!existsSync(lockFileURL)) {
    console.error("Recipes not found. Run 'npm run test:e2e:setup' first.");
    process.exit(1);
  }

  const pyodide = await loadPyodide({ lockFileURL });
  await init(pyodide);

  mkdirSync(FIXTURES_DIR, { recursive: true });

  // デフォルトの Presentation() を保存（標準レイアウト群を含む）
  console.log("Generating default template...");
  const prs = Presentation();
  const basePptx = prs.save();
  prs.end();

  // カスタマイズ（非連番レイアウト + 背景画像）
  console.log("Customizing template...");
  const templatePptx = await customizeTemplate(basePptx);

  const outPath = join(FIXTURES_DIR, "test-template.pptx");
  writeFileSync(outPath, templatePptx);
  console.log(`Generated: ${outPath} (${templatePptx.length} bytes)`);

  // テンプレートの検証: 読み込んでレイアウト一覧を表示
  console.log("\nVerifying template layouts:");
  const { readTemplate } = await import("../../src/core/template-reader.js");
  const templateData = new Uint8Array(readFileSync(outPath));
  const templateInfo = readTemplate(templateData);
  for (const layout of templateInfo.layouts) {
    const phDesc = layout.placeholders
      .map((p) => `idx=${p.idx}(${p.type})`)
      .join(", ");
    console.log(`  - ${layout.name}: [${phDesc}]`);
  }

  // 背景画像の検証
  console.log("\nVerifying background images:");
  const { extractBackgrounds } =
    await import("../../src/core/slide-master-extractor.js");
  const bgResult = await extractBackgrounds(templateData);
  for (const master of bgResult.masters) {
    console.log(
      `  - Master "${master.masterName}": ${master.contentType} (${master.data.length} bytes)`,
    );
  }
  for (const layout of bgResult.layouts) {
    console.log(
      `  - Layout "${layout.layoutName}": ${layout.contentType} (${layout.data.length} bytes)`,
    );
  }

  console.log("\nTemplate generation complete!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
