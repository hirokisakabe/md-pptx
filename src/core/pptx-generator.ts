import { Emu, Presentation, Pt } from "python-pptx-wasm";
import type {
  CodeBlockElement,
  ContentElement,
  HeadingElement,
  ImageElement,
  ListElement,
  ParagraphElement,
  ParseResult,
  SlideMappingResult,
  TextRun,
} from "./types.js";

export interface GenerateOptions {
  templateData?: Uint8Array;
  imageResolver?: (src: string) => Uint8Array | undefined;
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

      for (const assignment of mapping.assignments) {
        const ph = findPlaceholderByIdx(slide, assignment.placeholderIdx);
        if (!ph) continue;

        if (assignment.placeholderType === "picture") {
          injectImage(ph, assignment.content, options?.imageResolver);
        } else {
          injectText(ph, assignment.content);
        }
      }

      if (slideData?.notes && slideData.notes.length > 0) {
        const notesText = slideData.notes.join("\n");
        const notesFrame = slide.notes_slide.notes_text_frame;
        if (notesFrame) {
          notesFrame.text = notesText;
        }
      }
    }

    return prs.save() as Uint8Array;
  } finally {
    prs.end();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findPlaceholderByIdx(slide: any, idx: number): any {
  const placeholders = slide.placeholders;
  for (let i = 0; i < placeholders.length; i++) {
    const ph = placeholders.getItem(i);
    try {
      if (ph.placeholder_format?.idx === idx) {
        return ph;
      }
    } catch {
      // placeholder_format may throw for non-placeholder shapes
    }
  }
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function injectText(placeholder: any, content: ContentElement[]): void {
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
        writeList(tf, element, isFirst);
        isFirst = false;
        break;
      case "code-block":
        writeCodeBlock(tf, element, isFirst);
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function writeList(tf: any, list: ListElement, isFirst: boolean) {
  for (let i = 0; i < list.items.length; i++) {
    const item = list.items[i];
    const p = isFirst && i === 0 ? tf.paragraphs[0] : tf.add_paragraph();
    p.level = item.level;
    writeRuns(p, item.runs);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function writeCodeBlock(tf: any, block: CodeBlockElement, isFirst: boolean) {
  const lines = block.code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const p = isFirst && i === 0 ? tf.paragraphs[0] : tf.add_paragraph();
    const run = p.add_run();
    run.text = lines[i];
    try {
      run.font.name = "Courier New";
      run.font.size = Pt(10);
    } catch {
      // font properties may not be settable
    }
  }
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
    // strikethrough is not supported by python-pptx-wasm; skipped
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
