import JSZip from "jszip";
import type {
  SlideMasterBackground,
  SlideLayoutBackground,
  BackgroundExtractionResult,
} from "./types.js";

/**
 * PPTXバイナリからスライドマスター・スライドレイアウトの背景画像を抽出する。
 */
export async function extractBackgrounds(
  pptxData: Uint8Array,
): Promise<BackgroundExtractionResult> {
  const zip = await JSZip.loadAsync(pptxData);

  const masters = await extractSlideMasterBackgrounds(zip);
  const layouts = await extractSlideLayoutBackgrounds(zip);

  return { masters, layouts };
}

/** XMLテキストから blipFill 内の r:embed 属性値を取得する */
function findBackgroundBlipEmbed(xml: string): string | undefined {
  // <p:bg> 要素内の <a:blip r:embed="rIdX"/> を探す
  const bgMatch = xml.match(/<p:bg\b[^>]*>([\s\S]*?)<\/p:bg>/);
  if (!bgMatch) return undefined;

  const bgContent = bgMatch[1];
  const blipMatch = bgContent.match(/<a:blip\b[^>]*r:embed="([^"]+)"/);
  return blipMatch?.[1];
}

/** .rels ファイルからリレーションシップIDに対応するTargetパスを取得する */
function resolveRelationship(relsXml: string, rId: string): string | undefined {
  const escapedId = rId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<Relationship\\b[^>]*Id="${escapedId}"[^>]*Target="([^"]+)"`,
  );
  const match = relsXml.match(pattern);
  if (match) return match[1];

  // Target が Id の前に来るケースにも対応
  const altPattern = new RegExp(
    `<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${escapedId}"`,
  );
  const altMatch = relsXml.match(altPattern);
  return altMatch?.[1];
}

/** パスを解決して ZIP 内の絶対パスにする（相対パス・ルート絶対パス両対応） */
function resolveMediaPath(basePath: string, targetPath: string): string {
  // ルート絶対パス (e.g. "/ppt/media/image1.png") の場合は先頭 "/" を除去して返す
  if (targetPath.startsWith("/")) {
    return targetPath.slice(1);
  }

  const dir = basePath.substring(0, basePath.lastIndexOf("/"));
  const parts = dir.split("/");
  for (const segment of targetPath.split("/")) {
    if (segment === ".." && parts.length > 0) {
      parts.pop();
    } else if (segment !== "." && segment !== "") {
      parts.push(segment);
    }
  }
  return parts.join("/");
}

/** ファイル拡張子からMIMEタイプを推定する */
function guessMimeType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "bmp":
      return "image/bmp";
    case "tiff":
    case "tif":
      return "image/tiff";
    case "svg":
      return "image/svg+xml";
    case "emf":
      return "image/x-emf";
    case "wmf":
      return "image/x-wmf";
    default:
      return "application/octet-stream";
  }
}

/** Uint8Array を Data URL に変換する */
function toDataUrl(data: Uint8Array, contentType: string): string {
  const base64 = Buffer.from(data).toString("base64");
  return `data:${contentType};base64,${base64}`;
}

/** XML から名前属性を取得する（スライドマスター / レイアウトの名前） */
function extractName(xml: string, tag: string): string {
  const pattern = new RegExp(`<${tag}\\b[^>]*name="([^"]+)"`);
  const match = xml.match(pattern);
  return match?.[1] ?? "";
}

interface BackgroundImageInfo {
  data: Uint8Array;
  contentType: string;
  dataUrl: string;
}

/** XML と rels から背景画像を抽出する共通処理 */
async function extractBackgroundImage(
  zip: JSZip,
  xmlPath: string,
  xml: string,
): Promise<BackgroundImageInfo | undefined> {
  const rId = findBackgroundBlipEmbed(xml);
  if (!rId) return undefined;

  // .rels ファイルのパスを算出
  const dir = xmlPath.substring(0, xmlPath.lastIndexOf("/"));
  const fileName = xmlPath.substring(xmlPath.lastIndexOf("/") + 1);
  const relsPath = `${dir}/_rels/${fileName}.rels`;

  const relsFile = zip.file(relsPath);
  if (!relsFile) return undefined;

  const relsXml = await relsFile.async("string");
  const target = resolveRelationship(relsXml, rId);
  if (!target) return undefined;

  const mediaPath = resolveMediaPath(xmlPath, target);
  const mediaFile = zip.file(mediaPath);
  if (!mediaFile) return undefined;

  const data = new Uint8Array(await mediaFile.async("arraybuffer"));
  const contentType = guessMimeType(mediaPath);
  const dataUrl = toDataUrl(data, contentType);

  return { data, contentType, dataUrl };
}

async function extractSlideMasterBackgrounds(
  zip: JSZip,
): Promise<SlideMasterBackground[]> {
  const results: SlideMasterBackground[] = [];
  const masterFiles: string[] = [];

  zip.forEach((path) => {
    if (/^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(path)) {
      masterFiles.push(path);
    }
  });

  masterFiles.sort();

  for (const masterPath of masterFiles) {
    const xml = await zip.file(masterPath)!.async("string");
    const bgInfo = await extractBackgroundImage(zip, masterPath, xml);
    if (!bgInfo) continue;

    const masterName = extractName(xml, "p:cSld");

    results.push({
      masterName,
      contentType: bgInfo.contentType,
      data: bgInfo.data,
      dataUrl: bgInfo.dataUrl,
    });
  }

  return results;
}

async function extractSlideLayoutBackgrounds(
  zip: JSZip,
): Promise<SlideLayoutBackground[]> {
  const results: SlideLayoutBackground[] = [];
  const layoutFiles: string[] = [];

  zip.forEach((path) => {
    if (/^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(path)) {
      layoutFiles.push(path);
    }
  });

  layoutFiles.sort();

  for (const layoutPath of layoutFiles) {
    const xml = await zip.file(layoutPath)!.async("string");
    const bgInfo = await extractBackgroundImage(zip, layoutPath, xml);
    if (!bgInfo) continue;

    const layoutName = extractName(xml, "p:cSld");

    results.push({
      layoutName,
      contentType: bgInfo.contentType,
      data: bgInfo.data,
      dataUrl: bgInfo.dataUrl,
    });
  }

  return results;
}
