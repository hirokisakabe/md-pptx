/**
 * テスト用テンプレート PPTX を生成するスクリプト。
 *
 * python-pptx-wasm のデフォルト Presentation() をベースに、
 * 非連番プレースホルダー idx を持つカスタムレイアウトを追加する。
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
const OUTPUT_DIR = join(__dirname, "..", "fixtures");

/**
 * 非連番プレースホルダー idx を持つカスタムレイアウト XML を生成する。
 *
 * idx=0 (title), idx=10 (body) のように連番でない配置にすることで、
 * プレースホルダーアクセス時の KeyError 問題 (#107) をテストできる。
 */
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

/**
 * デフォルトテンプレートに非連番 idx レイアウトを追加して返す。
 */
async function addNonSequentialLayout(
  basePptx: Uint8Array,
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(basePptx);

  // 既存のスライドレイアウト数を数える
  let layoutCount = 0;
  zip.forEach((path) => {
    if (/^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(path)) {
      layoutCount++;
    }
  });
  const newLayoutIndex = layoutCount + 1;
  const layoutPath = `ppt/slideLayouts/slideLayout${newLayoutIndex}.xml`;

  // スライドマスターとの関係を設定するため、既存レイアウトの rels を参考にする
  const layout1RelsPath = "ppt/slideLayouts/_rels/slideLayout1.xml.rels";
  const layout1RelsContent = await zip.file(layout1RelsPath)!.async("string");

  // slideMaster への rId を取得
  const masterMatch = layout1RelsContent.match(
    /Id="(rId\d+)"[^>]*Target="[^"]*slideMaster/,
  );
  const masterRId = masterMatch ? masterMatch[1] : "rId1";
  const masterTarget = "../slideMasters/slideMaster1.xml";

  // 新しいレイアウトの rels ファイルを作成
  const newLayoutRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="${masterRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="${masterTarget}"/>
</Relationships>`;

  zip.file(layoutPath, buildNonSequentialLayoutXml());
  zip.file(
    `ppt/slideLayouts/_rels/slideLayout${newLayoutIndex}.xml.rels`,
    newLayoutRels,
  );

  // slideMaster1.xml.rels に新しいレイアウトへの関係を追加
  const masterRelsPath = "ppt/slideMasters/_rels/slideMaster1.xml.rels";
  const masterRelsContent = await zip.file(masterRelsPath)!.async("string");

  // 既存の最大 rId を取得して次の ID を算出
  const rIdMatches = [...masterRelsContent.matchAll(/Id="rId(\d+)"/g)];
  const maxRId = Math.max(...rIdMatches.map((m) => parseInt(m[1], 10)));
  const newRId = `rId${maxRId + 1}`;

  const updatedMasterRels = masterRelsContent.replace(
    "</Relationships>",
    `  <Relationship Id="${newRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout${newLayoutIndex}.xml"/>
</Relationships>`,
  );
  zip.file(masterRelsPath, updatedMasterRels);

  // slideMaster1.xml の sldLayoutIdLst に新しいレイアウト ID を追加
  const masterPath = "ppt/slideMasters/slideMaster1.xml";
  const masterContent = await zip.file(masterPath)!.async("string");

  // 既存の最大 sldLayoutId を取得
  const layoutIdMatches = [...masterContent.matchAll(/id="(\d+)"/g)];
  const maxLayoutId = Math.max(
    ...layoutIdMatches.map((m) => parseInt(m[1], 10)),
  );
  const newLayoutId = maxLayoutId + 1;

  const updatedMaster = masterContent.replace(
    "</p:sldLayoutIdLst>",
    `  <p:sldLayoutId id="${newLayoutId}" r:id="${newRId}"/>
    </p:sldLayoutIdLst>`,
  );
  zip.file(masterPath, updatedMaster);

  // [Content_Types].xml に新しいレイアウトのエントリを追加
  const contentTypesContent = await zip
    .file("[Content_Types].xml")!
    .async("string");
  const updatedContentTypes = contentTypesContent.replace(
    "</Types>",
    `  <Override PartName="/${layoutPath}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
</Types>`,
  );
  zip.file("[Content_Types].xml", updatedContentTypes);

  return new Uint8Array(
    await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }),
  );
}

async function main() {
  console.log("Initializing python-pptx-wasm...");
  const lockFileURL = join(RECIPES, "pyodide-lock.json");

  if (!existsSync(lockFileURL)) {
    console.error("Recipes not found. Run 'npm run test:e2e:setup' first.");
    process.exit(1);
  }

  const pyodide = await loadPyodide({ lockFileURL });
  await init(pyodide);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  // デフォルトの Presentation() を保存（標準レイアウト群を含む）
  console.log("Generating default template...");
  const prs = Presentation();
  const basePptx = prs.save();
  prs.end();

  // 非連番プレースホルダー idx レイアウトを追加
  console.log("Adding non-sequential placeholder idx layout...");
  const templatePptx = await addNonSequentialLayout(basePptx);

  const outPath = join(OUTPUT_DIR, "test-template.pptx");
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

  console.log("\nTemplate generation complete!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
