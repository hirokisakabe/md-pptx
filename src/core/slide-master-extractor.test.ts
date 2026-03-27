import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { extractBackgrounds } from "./slide-master-extractor.js";

/** テスト用のPPTXバイナリを生成するヘルパー */
async function createTestPptx(
  files: Record<string, string | Uint8Array>,
): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  const buf = await zip.generateAsync({ type: "arraybuffer" });
  return new Uint8Array(buf);
}

// 1x1 PNG画像のバイナリ（最小限の有効なPNG）
const TINY_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02,
  0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44,
  0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x00, 0x02, 0x00,
  0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
  0xae, 0x42, 0x60, 0x82,
]);

function slideMasterXml(name: string, rId: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld name="${name}">
    <p:bg>
      <p:bgPr>
        <a:blipFill>
          <a:blip r:embed="${rId}"/>
          <a:stretch><a:fillRect/></a:stretch>
        </a:blipFill>
      </p:bgPr>
    </p:bg>
    <p:spTree/>
  </p:cSld>
</p:sldMaster>`;
}

function slideLayoutXml(name: string, rId?: string): string {
  const bgSection = rId
    ? `<p:bg>
      <p:bgPr>
        <a:blipFill>
          <a:blip r:embed="${rId}"/>
          <a:stretch><a:fillRect/></a:stretch>
        </a:blipFill>
      </p:bgPr>
    </p:bg>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld name="${name}">
    ${bgSection}
    <p:spTree/>
  </p:cSld>
</p:sldLayout>`;
}

function relsXml(rId: string, target: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/>
</Relationships>`;
}

describe("extractBackgrounds", () => {
  describe("スライドマスター背景の抽出", () => {
    it("背景画像を持つスライドマスターから画像を抽出できる", async () => {
      const pptx = await createTestPptx({
        "ppt/slideMasters/slideMaster1.xml": slideMasterXml(
          "TestMaster",
          "rId2",
        ),
        "ppt/slideMasters/_rels/slideMaster1.xml.rels": relsXml(
          "rId2",
          "../media/image1.png",
        ),
        "ppt/media/image1.png": TINY_PNG,
      });

      const result = await extractBackgrounds(pptx);

      expect(result.masters).toHaveLength(1);
      expect(result.masters[0].masterName).toBe("TestMaster");
      expect(result.masters[0].contentType).toBe("image/png");
      expect(result.masters[0].data).toEqual(TINY_PNG);
      expect(result.masters[0].dataUrl).toMatch(
        /^data:image\/png;base64,[A-Za-z0-9+/=]+$/,
      );
    });

    it("背景画像がないスライドマスターは結果に含まれない", async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld name="NoBackground">
    <p:spTree/>
  </p:cSld>
</p:sldMaster>`;

      const pptx = await createTestPptx({
        "ppt/slideMasters/slideMaster1.xml": xml,
      });

      const result = await extractBackgrounds(pptx);
      expect(result.masters).toHaveLength(0);
    });

    it("複数のスライドマスターから背景画像を抽出できる", async () => {
      const pptx = await createTestPptx({
        "ppt/slideMasters/slideMaster1.xml": slideMasterXml("Master1", "rId2"),
        "ppt/slideMasters/_rels/slideMaster1.xml.rels": relsXml(
          "rId2",
          "../media/image1.png",
        ),
        "ppt/media/image1.png": TINY_PNG,
        "ppt/slideMasters/slideMaster2.xml": slideMasterXml("Master2", "rId3"),
        "ppt/slideMasters/_rels/slideMaster2.xml.rels": relsXml(
          "rId3",
          "../media/image2.png",
        ),
        "ppt/media/image2.png": TINY_PNG,
      });

      const result = await extractBackgrounds(pptx);

      expect(result.masters).toHaveLength(2);
      expect(result.masters[0].masterName).toBe("Master1");
      expect(result.masters[1].masterName).toBe("Master2");
    });

    it("JPEG画像の場合にMIMEタイプが正しく判定される", async () => {
      const pptx = await createTestPptx({
        "ppt/slideMasters/slideMaster1.xml": slideMasterXml(
          "TestMaster",
          "rId2",
        ),
        "ppt/slideMasters/_rels/slideMaster1.xml.rels": relsXml(
          "rId2",
          "../media/image1.jpeg",
        ),
        "ppt/media/image1.jpeg": TINY_PNG, // 拡張子だけ変えてテスト
      });

      const result = await extractBackgrounds(pptx);

      expect(result.masters).toHaveLength(1);
      expect(result.masters[0].contentType).toBe("image/jpeg");
    });
  });

  describe("スライドレイアウト背景の抽出", () => {
    it("背景画像を持つスライドレイアウトから画像を抽出できる", async () => {
      const pptx = await createTestPptx({
        "ppt/slideLayouts/slideLayout1.xml": slideLayoutXml(
          "TitleLayout",
          "rId2",
        ),
        "ppt/slideLayouts/_rels/slideLayout1.xml.rels": relsXml(
          "rId2",
          "../media/image1.png",
        ),
        "ppt/media/image1.png": TINY_PNG,
      });

      const result = await extractBackgrounds(pptx);

      expect(result.layouts).toHaveLength(1);
      expect(result.layouts[0].layoutName).toBe("TitleLayout");
      expect(result.layouts[0].contentType).toBe("image/png");
      expect(result.layouts[0].data).toEqual(TINY_PNG);
    });

    it("背景画像がないスライドレイアウトは結果に含まれない", async () => {
      const pptx = await createTestPptx({
        "ppt/slideLayouts/slideLayout1.xml": slideLayoutXml("BlankLayout"),
      });

      const result = await extractBackgrounds(pptx);
      expect(result.layouts).toHaveLength(0);
    });
  });

  describe("エッジケース", () => {
    it("スライドマスターもレイアウトもない場合は空の結果を返す", async () => {
      const pptx = await createTestPptx({
        "[Content_Types].xml": '<?xml version="1.0"?><Types/>',
      });

      const result = await extractBackgrounds(pptx);

      expect(result.masters).toHaveLength(0);
      expect(result.layouts).toHaveLength(0);
    });

    it("relsファイルが存在しない場合はスキップする", async () => {
      const pptx = await createTestPptx({
        "ppt/slideMasters/slideMaster1.xml": slideMasterXml(
          "TestMaster",
          "rId2",
        ),
        // _rels ファイルなし
      });

      const result = await extractBackgrounds(pptx);
      expect(result.masters).toHaveLength(0);
    });

    it("メディアファイルが存在しない場合はスキップする", async () => {
      const pptx = await createTestPptx({
        "ppt/slideMasters/slideMaster1.xml": slideMasterXml(
          "TestMaster",
          "rId2",
        ),
        "ppt/slideMasters/_rels/slideMaster1.xml.rels": relsXml(
          "rId2",
          "../media/missing.png",
        ),
        // メディアファイルなし
      });

      const result = await extractBackgrounds(pptx);
      expect(result.masters).toHaveLength(0);
    });

    it("relsにマッチするリレーションシップがない場合はスキップする", async () => {
      const pptx = await createTestPptx({
        "ppt/slideMasters/slideMaster1.xml": slideMasterXml(
          "TestMaster",
          "rId99",
        ),
        "ppt/slideMasters/_rels/slideMaster1.xml.rels": relsXml(
          "rId2",
          "../media/image1.png",
        ),
        "ppt/media/image1.png": TINY_PNG,
      });

      const result = await extractBackgrounds(pptx);
      expect(result.masters).toHaveLength(0);
    });

    it("Targetがルート絶対パスの場合でも画像を抽出できる", async () => {
      const pptx = await createTestPptx({
        "ppt/slideMasters/slideMaster1.xml": slideMasterXml(
          "AbsPathMaster",
          "rId2",
        ),
        "ppt/slideMasters/_rels/slideMaster1.xml.rels": relsXml(
          "rId2",
          "/ppt/media/image1.png",
        ),
        "ppt/media/image1.png": TINY_PNG,
      });

      const result = await extractBackgrounds(pptx);

      expect(result.masters).toHaveLength(1);
      expect(result.masters[0].masterName).toBe("AbsPathMaster");
      expect(result.masters[0].data).toEqual(TINY_PNG);
    });

    it("Relationship属性の順序がTarget→Idでも画像を抽出できる", async () => {
      const altRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="../media/image1.png" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Id="rId2"/>
</Relationships>`;

      const pptx = await createTestPptx({
        "ppt/slideMasters/slideMaster1.xml": slideMasterXml(
          "AltOrderMaster",
          "rId2",
        ),
        "ppt/slideMasters/_rels/slideMaster1.xml.rels": altRelsXml,
        "ppt/media/image1.png": TINY_PNG,
      });

      const result = await extractBackgrounds(pptx);

      expect(result.masters).toHaveLength(1);
      expect(result.masters[0].masterName).toBe("AltOrderMaster");
    });

    it("マスターとレイアウトの両方から同時に抽出できる", async () => {
      const pptx = await createTestPptx({
        "ppt/slideMasters/slideMaster1.xml": slideMasterXml("Master", "rId2"),
        "ppt/slideMasters/_rels/slideMaster1.xml.rels": relsXml(
          "rId2",
          "../media/bg-master.png",
        ),
        "ppt/media/bg-master.png": TINY_PNG,
        "ppt/slideLayouts/slideLayout1.xml": slideLayoutXml("Layout", "rId3"),
        "ppt/slideLayouts/_rels/slideLayout1.xml.rels": relsXml(
          "rId3",
          "../media/bg-layout.png",
        ),
        "ppt/media/bg-layout.png": TINY_PNG,
      });

      const result = await extractBackgrounds(pptx);

      expect(result.masters).toHaveLength(1);
      expect(result.masters[0].masterName).toBe("Master");
      expect(result.layouts).toHaveLength(1);
      expect(result.layouts[0].layoutName).toBe("Layout");
    });
  });
});
