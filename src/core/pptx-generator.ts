import { Emu, Inches, Presentation, Pt } from "python-pptx-wasm";
import type {
  CodeBlockElement,
  ContentElement,
  HeadingElement,
  ImageElement,
  ListElement,
  ParagraphElement,
  ParseResult,
  SlideMappingResult,
  TableElement,
  TextRun,
} from "./types.js";

export interface GenerateOptions {
  templateData?: Uint8Array;
  imageResolver?: (src: string) => Uint8Array | undefined;
  orderedListHelper?: (pPrPackedId: string) => void;
}

export function generatePptx(
  parseResult: ParseResult,
  mappingResults: SlideMappingResult[],
  options?: GenerateOptions,
): Uint8Array {
  const prs = options?.templateData
    ? Presentation(options.templateData)
    : Presentation();

  try {
    // テンプレートなしの場合、デフォルトを 16:9 に設定
    if (!options?.templateData) {
      prs.slide_width = Emu(12192000); // 13.333 inches
      prs.slide_height = Emu(6858000); // 7.5 inches
    }

    // テンプレートの既存スライドを削除
    if (options?.templateData) {
      const sldIdLst = prs.slides._element;
      const count = sldIdLst.sldId_lst.length;
      for (let i = 0; i < count; i++) {
        sldIdLst.remove(sldIdLst.sldId_lst[0]);
      }
    }

    if (prs.slide_layouts.length === 0) {
      throw new Error("No slide layouts found in template");
    }

    for (let i = 0; i < mappingResults.length; i++) {
      const mapping = mappingResults[i];
      const slideData = parseResult.slides[i];

      const layout =
        prs.slide_layouts.get_by_name(mapping.layoutName) ??
        prs.slide_layouts.getItem(prs.slide_layouts.length - 1);

      const slide = prs.slides.add_slide(layout);

      const codeBlocks: CodeBlockElement[] = [];
      const tables: TableElement[] = [];
      const images: { element: ImageElement; data: Uint8Array }[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let bodyPlaceholder: any = undefined;
      let bodyNonSpecialContent: ContentElement[] = [];

      for (const assignment of mapping.assignments) {
        const ph = findPlaceholderByIdx(slide, assignment.placeholderIdx);
        if (!ph) continue;

        if (assignment.placeholderType === "picture") {
          injectImage(ph, assignment.content, options?.imageResolver);
        } else {
          // コードブロックとテーブルを分離して収集
          const nonSpecialContent = assignment.content.filter((c) => {
            if (c.type === "code-block") {
              codeBlocks.push(c);
              return false;
            }
            if (c.type === "table") {
              tables.push(c);
              return false;
            }
            if (c.type === "image" && options?.imageResolver) {
              const data = options.imageResolver(c.image.src);
              if (data) {
                images.push({ element: c, data });
                return false;
              }
            }
            return true;
          });
          if (nonSpecialContent.length > 0) {
            injectText(ph, nonSpecialContent, options?.orderedListHelper);
          }
          if (assignment.placeholderType === "body") {
            bodyPlaceholder = ph;
            bodyNonSpecialContent = nonSpecialContent;
            // body に非コードブロック・非テーブルコンテンツがあるかどうかを記録
            (bodyPlaceholder as Record<string, boolean>)._hasBodyTextContent =
              nonSpecialContent.length > 0;
          }
        }
      }

      // テキストと特殊要素が混在する場合、bodyプレースホルダの高さを
      // 実際のテキスト描画高さに縮小して、特殊要素との間に巨大なギャップが生じないようにする
      const hasSpecialElements =
        codeBlocks.length > 0 || tables.length > 0 || images.length > 0;
      if (
        bodyPlaceholder &&
        bodyNonSpecialContent.length > 0 &&
        hasSpecialElements
      ) {
        const estimatedHeight = estimateTextContentHeight(
          bodyNonSpecialContent,
        );
        try {
          // 推定高さが元の高さを超えないようクランプ（拡大防止）
          const currentHeight = Number(bodyPlaceholder.height);
          bodyPlaceholder.height = Emu(
            Math.min(currentHeight, estimatedHeight),
          );
        } catch {
          // height が設定不可の場合はフォールバック（既存動作）
        }
      }

      // テーブルとコードブロックを body プレースホルダ基準で縦に配置
      let shapeTopOffset: number | undefined;

      if (tables.length > 0) {
        shapeTopOffset = addTableShapes(
          slide,
          tables,
          prs,
          bodyPlaceholder,
          shapeTopOffset,
        );
      }

      if (images.length > 0) {
        shapeTopOffset = addImageShapes(
          slide,
          images,
          prs,
          bodyPlaceholder,
          shapeTopOffset,
        );
      }

      if (codeBlocks.length > 0) {
        addCodeBlockTextBoxes(
          slide,
          codeBlocks,
          prs,
          bodyPlaceholder,
          shapeTopOffset,
        );
      }

      if (slideData?.notes && slideData.notes.length > 0) {
        const notesText = slideData.notes.join("\n");
        const notesFrame = slide.notes_slide.notes_text_frame;
        if (notesFrame) {
          notesFrame.text = notesText;
        }
      }
    }

    return prs.save();
  } finally {
    prs.end();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findPlaceholderByIdx(slide: any, idx: number): any {
  // slide.placeholders は SlidePlaceholders であり、getItem() もイテレータも
  // 位置インデックスではなくプレースホルダー idx で検索するため、
  // 連番でない idx を持つテンプレートで KeyError になる。
  // slide.shapes は SlideShapes であり、位置ベースの getItem() を持つため安全に走査できる。
  const shapes = slide.shapes;
  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes.getItem(i);
    try {
      if (shape.placeholder_format?.idx === idx) {
        return shape;
      }
    } catch {
      // placeholder_format may throw for non-placeholder shapes
    }
  }
  return undefined;
}

function injectText(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  placeholder: any,
  content: ContentElement[],
  orderedListHelper?: (pPrPackedId: string) => void,
): void {
  const tf = placeholder.text_frame;
  if (!tf) return;

  tf.clear();
  let isFirst = true;

  for (const element of content) {
    switch (element.type) {
      case "heading":
        writeHeading(tf, element, isFirst);
        isFirst = false;
        break;
      case "paragraph":
        writeParagraph(tf, element, isFirst);
        isFirst = false;
        break;
      case "list":
        writeList(tf, element, isFirst, orderedListHelper);
        isFirst = false;
        break;
      case "image":
        // Images in text placeholders: write alt text as fallback
        writeImageFallback(tf, element, isFirst);
        isFirst = false;
        break;
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function writeHeading(tf: any, heading: HeadingElement, isFirst: boolean) {
  const p = isFirst ? tf.paragraphs[0] : tf.add_paragraph();
  writeRuns(p, heading.runs);

  if (heading.level <= 2) {
    try {
      p.font.bold = true;
      p.font.size = Pt(heading.level === 1 ? 28 : 24);
    } catch {
      // font properties may not be settable on paragraph level in some contexts
    }
  } else {
    try {
      p.font.bold = true;
      p.font.size = Pt(headingFontSize(heading.level));
    } catch {
      // ignore
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function writeParagraph(tf: any, para: ParagraphElement, isFirst: boolean) {
  const p = isFirst ? tf.paragraphs[0] : tf.add_paragraph();
  writeRuns(p, para.runs);
}

function writeList(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tf: any,
  list: ListElement,
  isFirst: boolean,
  orderedListHelper?: (pPrPackedId: string) => void,
) {
  for (let i = 0; i < list.items.length; i++) {
    const item = list.items[i];
    const p = isFirst && i === 0 ? tf.paragraphs[0] : tf.add_paragraph();
    p.level = item.level;
    if (item.ordered && orderedListHelper) {
      try {
        const pPr = p._p.pPr as { packed_id: string } | undefined;
        if (pPr) {
          orderedListHelper(pPr.packed_id);
        }
      } catch {
        // fallback: ordered list renders as bullet
      }
    }
    writeRuns(p, item.runs);
  }
}

function resolveShapePosition(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prs: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bodyPlaceholder?: any,
  topOffset?: number,
): { left: number; width: number; top: number } {
  const slideWidth = Number(prs.slide_width ?? Emu(12192000));
  const slideHeight = Number(prs.slide_height ?? Emu(6858000));
  const margin = Number(Inches(0.5));

  if (topOffset !== undefined) {
    // 前のシェイプの後に続ける
    const left = bodyPlaceholder ? Number(bodyPlaceholder.left) : margin;
    const width = bodyPlaceholder
      ? Number(bodyPlaceholder.width)
      : slideWidth - margin * 2;
    return { left, width, top: topOffset };
  }

  if (bodyPlaceholder) {
    try {
      const left = Number(bodyPlaceholder.left);
      const width = Number(bodyPlaceholder.width);
      const hasBodyTextContent =
        (bodyPlaceholder as Record<string, boolean>)._hasBodyTextContent ===
        true;
      const top = hasBodyTextContent
        ? Number(bodyPlaceholder.top) + Number(bodyPlaceholder.height)
        : Number(bodyPlaceholder.top);
      return { left, width, top };
    } catch {
      // fall through
    }
  }

  return {
    left: margin,
    width: slideWidth - margin * 2,
    top: Math.round(slideHeight * 0.3),
  };
}

function addTableShapes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  slide: any,
  tables: TableElement[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prs: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bodyPlaceholder?: any,
  topOffset?: number,
): number {
  const pos = resolveShapePosition(prs, bodyPlaceholder, topOffset);
  const tableLeft = pos.left;
  const tableWidth = pos.width;
  let currentTop = pos.top;

  const rowHeightEmu = Number(Inches(0.4));
  const tableGap = Number(Pt(8));

  for (const table of tables) {
    const rowCount = table.rows.length;
    const colCount = table.rows[0]?.cells.length ?? 0;
    if (rowCount === 0 || colCount === 0) continue;

    const tableHeight = rowHeightEmu * rowCount;

    const graphicFrame = slide.shapes.add_table(
      rowCount,
      colCount,
      Emu(tableLeft),
      Emu(currentTop),
      Emu(tableWidth),
      Emu(tableHeight),
    );

    const tbl = graphicFrame.table;
    tbl.first_row = true;

    for (let r = 0; r < rowCount; r++) {
      const row = table.rows[r];
      for (let c = 0; c < row.cells.length; c++) {
        const cellData = row.cells[c];
        const cell = tbl.cell(r, c);
        const tf = cell.text_frame;
        tf.clear();
        const p = tf.paragraphs[0];
        writeRuns(p, cellData.runs);

        if (cellData.isHeader) {
          try {
            p.font.bold = true;
          } catch {
            // font properties may not be settable
          }
        }
      }
    }

    currentTop += tableHeight + tableGap;
  }

  return currentTop;
}

function addCodeBlockTextBoxes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  slide: any,
  blocks: CodeBlockElement[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prs: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bodyPlaceholder?: any,
  topOffset?: number,
) {
  const pos = resolveShapePosition(prs, bodyPlaceholder, topOffset);
  const boxLeft = pos.left;
  const boxWidth = pos.width;
  let currentTop = pos.top;

  const lineHeightEmu = Number(Pt(14));
  const blockGap = Number(Pt(8));

  for (const block of blocks) {
    const lines = block.code.split("\n");
    const boxHeight = lineHeightEmu * (lines.length + 1);

    const txBox = slide.shapes.add_textbox(
      Emu(boxLeft),
      Emu(currentTop),
      Emu(boxWidth),
      Emu(boxHeight),
    );
    const tf = txBox.text_frame;
    tf.word_wrap = true;

    for (let i = 0; i < lines.length; i++) {
      const p = i === 0 ? tf.paragraphs[0] : tf.add_paragraph();
      const run = p.add_run();
      run.text = lines[i];
      try {
        run.font.name = "Courier New";
        run.font.size = Pt(10);
      } catch {
        // font properties may not be settable
      }
    }

    currentTop += boxHeight + blockGap;
  }
}

/** px → EMU 変換 (96 DPI 基準: 1px = 9525 EMU) */
const PX_TO_EMU = 9525;

function addImageShapes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  slide: any,
  images: { element: ImageElement; data: Uint8Array }[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prs: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bodyPlaceholder?: any,
  topOffset?: number,
): number {
  const pos = resolveShapePosition(prs, bodyPlaceholder, topOffset);
  let currentTop = pos.top;
  const imageGap = Number(Pt(8));

  for (const { element, data } of images) {
    const imgWidth = element.image.width;
    const imgHeight = element.image.height;

    const width = imgWidth ? Emu(imgWidth * PX_TO_EMU) : Emu(pos.width);
    const height = imgHeight ? Emu(imgHeight * PX_TO_EMU) : undefined;

    const pic = slide.shapes.add_picture(
      data,
      Emu(pos.left),
      Emu(currentTop),
      width,
      height,
    );

    currentTop += Number(pic.height ?? height ?? Inches(2)) + imageGap;
  }

  return currentTop;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function writeImageFallback(tf: any, img: ImageElement, isFirst: boolean) {
  const p = isFirst ? tf.paragraphs[0] : tf.add_paragraph();
  const displayText = img.image.alt || `[Image: ${img.image.src}]`;
  const run = p.add_run();
  run.text = displayText;
  run.font.italic = true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function writeRuns(paragraph: any, runs: TextRun[]) {
  for (const textRun of runs) {
    const run = paragraph.add_run();
    run.text = textRun.text;
    if (textRun.bold) run.font.bold = true;
    if (textRun.italic) run.font.italic = true;
    if (textRun.strikethrough) {
      try {
        run.font._rPr.set("strike", "sngStrike");
      } catch {
        // strikethrough may not be supported
      }
    }
    if (textRun.link) {
      try {
        run.hyperlink.address = textRun.link;
      } catch {
        // hyperlink may not be supported
      }
    }
    if (textRun.code) {
      try {
        run.font.name = "Courier New";
      } catch {
        // font name may not be settable
      }
    }
  }
}

function injectImage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  placeholder: any,
  content: ContentElement[],
  imageResolver?: (src: string) => Uint8Array | undefined,
): void {
  if (!imageResolver) return;

  const imageElement = content.find(
    (c): c is ImageElement => c.type === "image",
  );
  if (!imageElement) return;

  const imageData = imageResolver(imageElement.image.src);
  if (!imageData) return;

  if (typeof placeholder.insert_picture === "function") {
    placeholder.insert_picture(imageData);
  }
}

/**
 * テキストコンテンツの推定描画高さを EMU で返す。
 * フォントサイズと行数から概算し、bodyプレースホルダの高さリサイズに使用する。
 */
function estimateTextContentHeight(content: ContentElement[]): number {
  const defaultFontPt = 18;
  const lineHeightMultiplier = 1.5;
  let totalHeight = 0;

  for (const element of content) {
    switch (element.type) {
      case "heading": {
        const fontSize = headingFontSize(element.level);
        const lineCount = countTextLines(element.runs);
        totalHeight += Number(Pt(fontSize)) * lineHeightMultiplier * lineCount;
        break;
      }
      case "paragraph": {
        const lineCount = countTextLines(element.runs);
        totalHeight +=
          Number(Pt(defaultFontPt)) * lineHeightMultiplier * lineCount;
        break;
      }
      case "list": {
        totalHeight +=
          element.items.length *
          Number(Pt(defaultFontPt)) *
          lineHeightMultiplier;
        break;
      }
    }
  }

  // テキストと後続要素の間に適度な余白を確保
  totalHeight += Number(Pt(8));

  return totalHeight;
}

/** テキストランの結合テキストに含まれる改行を数え、最低1行を返す */
function countTextLines(runs: TextRun[]): number {
  const text = runs.map((r) => r.text).join("");
  const newlines = (text.match(/\n/g) || []).length;
  return Math.max(1, newlines + 1);
}

function headingFontSize(level: number): number {
  switch (level) {
    case 1:
      return 28;
    case 2:
      return 24;
    case 3:
      return 20;
    case 4:
      return 18;
    case 5:
      return 16;
    default:
      return 14;
  }
}
