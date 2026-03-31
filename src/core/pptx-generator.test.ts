import { describe, expect, it, vi, beforeEach } from "vitest";
import type {
  ParseResult,
  SlideData,
  SlideMappingResult,
  ContentElement,
  CodeBlockElement,
  HeadingElement,
  ParagraphElement,
  ListElement,
  ImageElement,
  TableElement,
} from "./types.js";

// === Mock Setup ===

function createMockRun() {
  return {
    text: "",
    font: {
      bold: undefined as boolean | undefined,
      italic: undefined as boolean | undefined,
      size: undefined as unknown,
      name: undefined as string | undefined,
      underline: undefined as boolean | undefined,
      _rPr: {
        _attributes: {} as Record<string, string>,
        set(key: string, value: string) {
          this._attributes[key] = value;
        },
      },
    },
    hyperlink: {
      address: undefined as string | undefined,
    },
  };
}

function createMockParagraph() {
  const runs: ReturnType<typeof createMockRun>[] = [];
  const packedId = `@_pk:mock|mock|_element,pPr`;
  return {
    text: "",
    level: 0,
    font: {
      bold: undefined as boolean | undefined,
      italic: undefined as boolean | undefined,
      size: undefined as unknown,
    },
    runs,
    add_run: vi.fn(() => {
      const run = createMockRun();
      runs.push(run);
      return run;
    }),
    _p: {
      pPr: {
        packed_id: packedId,
      },
    },
  };
}

function createMockTextFrame() {
  const firstParagraph = createMockParagraph();
  const paragraphs = [firstParagraph] as ReturnType<
    typeof createMockParagraph
  >[];
  return {
    text: "",
    paragraphs,
    clear: vi.fn(() => {
      paragraphs.length = 0;
      const p = createMockParagraph();
      paragraphs.push(p);
    }),
    add_paragraph: vi.fn(() => {
      const p = createMockParagraph();
      paragraphs.push(p);
      return p;
    }),
  };
}

function createMockPlaceholder(idx: number, type: string) {
  const tf = createMockTextFrame();
  return {
    placeholder_format: { idx, type },
    text_frame: tf,
    text: "",
    insert_picture: vi.fn(),
    name: `Placeholder ${idx}`,
  };
}

function createMockTable(rows: number, cols: number) {
  const cells: ReturnType<typeof createMockTextFrame>[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: ReturnType<typeof createMockTextFrame>[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(createMockTextFrame());
    }
    cells.push(row);
  }
  return {
    first_row: false,
    cell: vi.fn((r: number, c: number) => ({
      text_frame: cells[r][c],
    })),
    _cells: cells,
  };
}

function createMockSlide(
  placeholders: ReturnType<typeof createMockPlaceholder>[],
) {
  const notesTextFrame = createMockTextFrame();
  return {
    placeholders: {
      length: placeholders.length,
      getItem: vi.fn((i: number) => placeholders[i]),
    },
    notes_slide: {
      notes_text_frame: notesTextFrame,
    },
    shapes: {
      // findPlaceholderByIdx は slide.shapes を位置ベースでイテレートする
      length: placeholders.length,
      getItem: vi.fn((i: number) => placeholders[i]),
      add_picture: vi.fn(() => ({ height: 1828800 })),
      add_textbox: vi.fn(() => {
        const tf = createMockTextFrame();
        return { text_frame: tf };
      }),
      add_table: vi.fn((_rows: number, _cols: number) => {
        const tbl = createMockTable(_rows, _cols);
        return { table: tbl };
      }),
    },
  };
}

function createMockSldIdLst(count: number) {
  const sldIds: { id: number; rId: string }[] = [];
  for (let i = 0; i < count; i++) {
    sldIds.push({ id: 256 + i, rId: `rId${i + 2}` });
  }
  return {
    sldId_lst: sldIds,
    remove: vi.fn((sldId: { id: number; rId: string }) => {
      const idx = sldIds.indexOf(sldId);
      if (idx !== -1) sldIds.splice(idx, 1);
    }),
  };
}

function createMockPresentation(
  layoutNames: string[],
  slidePlaceholderCreator?: (
    layoutName: string,
  ) => ReturnType<typeof createMockPlaceholder>[],
  existingSlideCount = 0,
) {
  const slides: ReturnType<typeof createMockSlide>[] = [];
  const layouts = layoutNames.map((name) => ({ name }));
  const sldIdLst = createMockSldIdLst(existingSlideCount);

  return {
    slide_layouts: {
      length: layouts.length,
      getItem: vi.fn((i: number) => layouts[i]),
      get_by_name: vi.fn((name: string) =>
        layouts.find((l) => l.name === name),
      ),
    },
    slides: {
      length: existingSlideCount,
      _element: sldIdLst,
      add_slide: vi.fn((layout: { name: string }) => {
        const phs = slidePlaceholderCreator
          ? slidePlaceholderCreator(layout.name)
          : [];
        const slide = createMockSlide(phs);
        slides.push(slide);
        return slide;
      }),
      getItem: (i: number) => slides[i],
    },
    slide_width: undefined as unknown,
    slide_height: undefined as unknown,
    save: vi.fn(() => new Uint8Array([0x50, 0x4b])),
    end: vi.fn(),
    _slides: slides,
    _sldIdLst: sldIdLst,
  };
}

// Mocking python-pptx-wasm
let mockPrs: ReturnType<typeof createMockPresentation>;

vi.mock("python-pptx-wasm", () => ({
  Presentation: vi.fn(() => {
    // the mock prs must be set before calling generatePptx
    return mockPrs;
  }),
  Emu: vi.fn((v: number) => v),
  Inches: vi.fn((v: number) => v * 914400),
  Pt: vi.fn((v: number) => v * 12700),
}));

// Import after mock
import { generatePptx } from "./pptx-generator.js";

// === Helpers ===

function heading(level: 1 | 2 | 3 | 4 | 5 | 6, text: string): HeadingElement {
  return { type: "heading", level, runs: [{ text }] };
}

function paragraph(text: string): ParagraphElement {
  return { type: "paragraph", runs: [{ text }] };
}

function list(
  items: { text: string; level?: number; ordered?: boolean }[],
): ListElement {
  return {
    type: "list",
    items: items.map((item) => ({
      runs: [{ text: item.text }],
      level: item.level ?? 0,
      ordered: item.ordered ?? false,
    })),
  };
}

function image(src: string, alt?: string): ImageElement {
  return { type: "image", image: { src, alt } };
}

function codeBlock(code: string, language?: string): CodeBlockElement {
  const element: CodeBlockElement = { type: "code-block", code };
  if (language) element.language = language;
  return element;
}

function table(headers: string[], bodyRows: string[][]): TableElement {
  const headerRow = {
    cells: headers.map((text) => ({
      runs: [{ text }],
      isHeader: true,
    })),
  };
  const dataRows = bodyRows.map((row) => ({
    cells: row.map((text) => ({
      runs: [{ text }],
      isHeader: false,
    })),
  }));
  return { type: "table", rows: [headerRow, ...dataRows] };
}

function slideData(
  content: ContentElement[],
  notes: string[] = [],
  layout?: string,
): SlideData {
  return { content, notes, directives: [], layout };
}

function mapping(
  layoutName: string,
  assignments: SlideMappingResult["assignments"],
  fallbackToBlank = false,
  unmappedContent: ContentElement[] = [],
): SlideMappingResult {
  return { layoutName, assignments, fallbackToBlank, unmappedContent };
}

// === Tests ===

describe("generatePptx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("基本動作", () => {
    it("空のプレゼンテーションを生成できる", () => {
      mockPrs = createMockPresentation(["Blank"]);
      const parseResult: ParseResult = { frontMatter: {}, slides: [] };
      const result = generatePptx(parseResult, []);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(mockPrs.save).toHaveBeenCalled();
      expect(mockPrs.end).toHaveBeenCalled();
    });

    it("テンプレートなしの場合スライドサイズを16:9に設定する", () => {
      mockPrs = createMockPresentation(["Blank"]);
      const parseResult: ParseResult = { frontMatter: {}, slides: [] };
      generatePptx(parseResult, []);

      expect(mockPrs.slide_width).toBe(12192000);
      expect(mockPrs.slide_height).toBe(6858000);
    });

    it("テンプレート指定時はスライドサイズを変更しない", () => {
      mockPrs = createMockPresentation(["Blank"]);
      const templateData = new Uint8Array([1, 2, 3]);
      const parseResult: ParseResult = { frontMatter: {}, slides: [] };
      generatePptx(parseResult, [], { templateData });

      expect(mockPrs.slide_width).toBeUndefined();
      expect(mockPrs.slide_height).toBeUndefined();
    });

    it("テンプレート指定時に既存スライドを削除する", () => {
      mockPrs = createMockPresentation(["Blank"], undefined, 2);
      const templateData = new Uint8Array([1, 2, 3]);
      const parseResult: ParseResult = { frontMatter: {}, slides: [] };
      generatePptx(parseResult, [], { templateData });

      expect(mockPrs._sldIdLst.remove).toHaveBeenCalledTimes(2);
      expect(mockPrs._sldIdLst.sldId_lst).toHaveLength(0);
    });

    it("テンプレート指定時に既存スライドを3枚以上でも全て削除する", () => {
      mockPrs = createMockPresentation(["Blank"], undefined, 5);
      const templateData = new Uint8Array([1, 2, 3]);
      const parseResult: ParseResult = { frontMatter: {}, slides: [] };
      generatePptx(parseResult, [], { templateData });

      expect(mockPrs._sldIdLst.remove).toHaveBeenCalledTimes(5);
      expect(mockPrs._sldIdLst.sldId_lst).toHaveLength(0);
    });

    it("テンプレートなしの場合は既存スライド削除を行わない", () => {
      mockPrs = createMockPresentation(["Blank"]);
      const parseResult: ParseResult = { frontMatter: {}, slides: [] };
      generatePptx(parseResult, []);

      expect(mockPrs._sldIdLst.remove).not.toHaveBeenCalled();
    });

    it("templateDataが渡された場合Presentationに渡す", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { Presentation } = (await import("python-pptx-wasm")) as any;
      mockPrs = createMockPresentation(["Blank"]);
      const templateData = new Uint8Array([1, 2, 3]);
      const parseResult: ParseResult = { frontMatter: {}, slides: [] };

      generatePptx(parseResult, [], { templateData });

      expect(Presentation).toHaveBeenCalledWith(templateData);
    });

    it("エラーが発生してもprs.end()が呼ばれる", () => {
      mockPrs = createMockPresentation(["Blank"]);
      mockPrs.save.mockImplementation(() => {
        throw new Error("save error");
      });
      const parseResult: ParseResult = { frontMatter: {}, slides: [] };

      expect(() => generatePptx(parseResult, [])).toThrow("save error");
      expect(mockPrs.end).toHaveBeenCalled();
    });
  });

  describe("スライド生成", () => {
    it("指定されたレイアウト名でスライドを追加する", () => {
      mockPrs = createMockPresentation(["Title and Content", "Blank"]);
      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [slideData([])],
      };
      const mappings = [mapping("Title and Content", [])];

      generatePptx(parseResult, mappings);

      expect(mockPrs.slides.add_slide).toHaveBeenCalledTimes(1);
      expect(mockPrs.slide_layouts.get_by_name).toHaveBeenCalledWith(
        "Title and Content",
      );
    });

    it("複数スライドを生成する", () => {
      mockPrs = createMockPresentation(["Title and Content", "Blank"]);
      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [slideData([]), slideData([]), slideData([])],
      };
      const mappings = [
        mapping("Title and Content", []),
        mapping("Blank", []),
        mapping("Title and Content", []),
      ];

      generatePptx(parseResult, mappings);

      expect(mockPrs.slides.add_slide).toHaveBeenCalledTimes(3);
    });

    it("レイアウトが見つからない場合最後のレイアウトを使用する", () => {
      mockPrs = createMockPresentation(["Title Slide", "Blank"]);
      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [slideData([])],
      };
      const mappings = [mapping("Non Existent", [])];

      generatePptx(parseResult, mappings);

      expect(mockPrs.slide_layouts.get_by_name).toHaveBeenCalledWith(
        "Non Existent",
      );
      expect(mockPrs.slide_layouts.getItem).toHaveBeenCalledWith(1);
    });

    it("レイアウトが0件の場合エラーを投げる", () => {
      mockPrs = createMockPresentation([]);
      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [slideData([])],
      };
      const mappings = [mapping("Blank", [])];

      expect(() => generatePptx(parseResult, mappings)).toThrow(
        "No slide layouts found in template",
      );
      expect(mockPrs.end).toHaveBeenCalled();
    });
  });

  describe("テキストコンテンツの注入", () => {
    it("タイトルプレースホルダにテキストを注入する", () => {
      const titlePh = createMockPlaceholder(0, "title");
      mockPrs = createMockPresentation(["Title and Content"], () => [titlePh]);
      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [slideData([heading(1, "テストタイトル")])],
      };
      const mappings = [
        mapping("Title and Content", [
          {
            placeholderIdx: 0,
            placeholderType: "title",
            content: [heading(1, "テストタイトル")],
          },
        ]),
      ];

      generatePptx(parseResult, mappings);

      expect(titlePh.text_frame.clear).toHaveBeenCalled();
      const firstParagraph = titlePh.text_frame.paragraphs[0];
      expect(firstParagraph.add_run).toHaveBeenCalled();
      const run = firstParagraph.runs[0];
      expect(run.text).toBe("テストタイトル");
    });

    it("bodyプレースホルダに複数コンテンツを注入する", () => {
      const bodyPh = createMockPlaceholder(1, "body");
      mockPrs = createMockPresentation(["Title and Content"], () => [bodyPh]);
      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [slideData([paragraph("段落1"), paragraph("段落2")])],
      };
      const mappings = [
        mapping("Title and Content", [
          {
            placeholderIdx: 1,
            placeholderType: "body",
            content: [paragraph("段落1"), paragraph("段落2")],
          },
        ]),
      ];

      generatePptx(parseResult, mappings);

      expect(bodyPh.text_frame.clear).toHaveBeenCalled();
      // First paragraph uses the existing one, second uses add_paragraph
      expect(bodyPh.text_frame.add_paragraph).toHaveBeenCalledTimes(1);
    });

    it("リストアイテムにlevelを設定する", () => {
      const bodyPh = createMockPlaceholder(1, "body");
      mockPrs = createMockPresentation(["Title and Content"], () => [bodyPh]);
      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [
          slideData([
            list([
              { text: "項目1", level: 0 },
              { text: "サブ項目", level: 1 },
              { text: "項目2", level: 0 },
            ]),
          ]),
        ],
      };
      const mappings = [
        mapping("Title and Content", [
          {
            placeholderIdx: 1,
            placeholderType: "body",
            content: [
              list([
                { text: "項目1", level: 0 },
                { text: "サブ項目", level: 1 },
                { text: "項目2", level: 0 },
              ]),
            ],
          },
        ]),
      ];

      generatePptx(parseResult, mappings);

      // 3 items: first uses existing paragraph, 2 more added
      expect(bodyPh.text_frame.add_paragraph).toHaveBeenCalledTimes(2);
      const paragraphs = bodyPh.text_frame.paragraphs;
      expect(paragraphs[0].level).toBe(0);
      expect(paragraphs[1].level).toBe(1);
      expect(paragraphs[2].level).toBe(0);
    });

    it("番号付きリストでorderedListHelperを呼び出す", () => {
      const bodyPh = createMockPlaceholder(1, "body");
      mockPrs = createMockPresentation(["Title and Content"], () => [bodyPh]);
      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [
          slideData([
            list([
              { text: "First", level: 0, ordered: true },
              { text: "Second", level: 0, ordered: true },
            ]),
          ]),
        ],
      };
      const mappings = [
        mapping("Title and Content", [
          {
            placeholderIdx: 1,
            placeholderType: "body",
            content: [
              list([
                { text: "First", level: 0, ordered: true },
                { text: "Second", level: 0, ordered: true },
              ]),
            ],
          },
        ]),
      ];

      const orderedListHelper = vi.fn();
      generatePptx(parseResult, mappings, { orderedListHelper });

      // orderedListHelper は各 ordered item の pPr.packed_id で呼ばれる
      expect(orderedListHelper).toHaveBeenCalledTimes(2);
      expect(orderedListHelper).toHaveBeenCalledWith(
        "@_pk:mock|mock|_element,pPr",
      );
    });

    it("箇条書きリストではorderedListHelperを呼び出さない", () => {
      const bodyPh = createMockPlaceholder(1, "body");
      mockPrs = createMockPresentation(["Title and Content"], () => [bodyPh]);
      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [
          slideData([
            list([
              { text: "Bullet1", level: 0, ordered: false },
              { text: "Bullet2", level: 0, ordered: false },
            ]),
          ]),
        ],
      };
      const mappings = [
        mapping("Title and Content", [
          {
            placeholderIdx: 1,
            placeholderType: "body",
            content: [
              list([
                { text: "Bullet1", level: 0, ordered: false },
                { text: "Bullet2", level: 0, ordered: false },
              ]),
            ],
          },
        ]),
      ];

      const orderedListHelper = vi.fn();
      generatePptx(parseResult, mappings, { orderedListHelper });

      expect(orderedListHelper).not.toHaveBeenCalled();
    });
  });

  describe("テキストフォーマット", () => {
    it("boldとitalicのフォーマットを適用する", () => {
      const bodyPh = createMockPlaceholder(1, "body");
      mockPrs = createMockPresentation(["Title and Content"], () => [bodyPh]);
      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [
          slideData([
            {
              type: "paragraph",
              runs: [
                { text: "通常", bold: false, italic: false },
                { text: "太字", bold: true },
                { text: "斜体", italic: true },
              ],
            } as ParagraphElement,
          ]),
        ],
      };
      const mappings = [
        mapping("Title and Content", [
          {
            placeholderIdx: 1,
            placeholderType: "body",
            content: parseResult.slides[0].content,
          },
        ]),
      ];

      generatePptx(parseResult, mappings);

      const p = bodyPh.text_frame.paragraphs[0];
      expect(p.runs).toHaveLength(3);
      expect(p.runs[0].text).toBe("通常");
      expect(p.runs[0].font.bold).toBeUndefined();
      expect(p.runs[1].text).toBe("太字");
      expect(p.runs[1].font.bold).toBe(true);
      expect(p.runs[2].text).toBe("斜体");
      expect(p.runs[2].font.italic).toBe(true);
    });

    it("strikethroughフォーマットを適用する", () => {
      const bodyPh = createMockPlaceholder(1, "body");
      mockPrs = createMockPresentation(["Title and Content"], () => [bodyPh]);
      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [
          slideData([
            {
              type: "paragraph",
              runs: [
                { text: "通常" },
                { text: "取り消し線", strikethrough: true },
              ],
            } as ParagraphElement,
          ]),
        ],
      };
      const mappings = [
        mapping("Title and Content", [
          {
            placeholderIdx: 1,
            placeholderType: "body",
            content: parseResult.slides[0].content,
          },
        ]),
      ];

      generatePptx(parseResult, mappings);

      const p = bodyPh.text_frame.paragraphs[0];
      expect(p.runs).toHaveLength(2);
      expect(p.runs[0].text).toBe("通常");
      expect(p.runs[0].font._rPr._attributes).toEqual({});
      expect(p.runs[1].text).toBe("取り消し線");
      expect(p.runs[1].font._rPr._attributes["strike"]).toBe("sngStrike");
    });

    it("codeフォーマットでCourier Newフォントを適用する", () => {
      const bodyPh = createMockPlaceholder(1, "body");
      mockPrs = createMockPresentation(["Title and Content"], () => [bodyPh]);
      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [
          slideData([
            {
              type: "paragraph",
              runs: [{ text: "code_text", code: true }],
            } as ParagraphElement,
          ]),
        ],
      };
      const mappings = [
        mapping("Title and Content", [
          {
            placeholderIdx: 1,
            placeholderType: "body",
            content: parseResult.slides[0].content,
          },
        ]),
      ];

      generatePptx(parseResult, mappings);

      const run = bodyPh.text_frame.paragraphs[0].runs[0];
      expect(run.font.name).toBe("Courier New");
    });

    it("linkフォーマットでハイパーリンクを設定する", () => {
      const bodyPh = createMockPlaceholder(1, "body");
      mockPrs = createMockPresentation(["Title and Content"], () => [bodyPh]);
      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [
          slideData([
            {
              type: "paragraph",
              runs: [{ text: "リンク", link: "https://example.com" }],
            } as ParagraphElement,
          ]),
        ],
      };
      const mappings = [
        mapping("Title and Content", [
          {
            placeholderIdx: 1,
            placeholderType: "body",
            content: parseResult.slides[0].content,
          },
        ]),
      ];

      generatePptx(parseResult, mappings);

      const run = bodyPh.text_frame.paragraphs[0].runs[0];
      expect(run.hyperlink.address).toBe("https://example.com");
    });
  });

  describe("画像コンテンツの注入", () => {
    it("pictureプレースホルダに画像を注入する", () => {
      const picPh = createMockPlaceholder(2, "picture");
      mockPrs = createMockPresentation(["Picture with Caption"], () => [picPh]);
      const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const imageResolver = vi.fn((src: string) => {
        if (src === "photo.png") return imageData;
        return undefined;
      });

      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [slideData([image("photo.png")])],
      };
      const mappings = [
        mapping("Picture with Caption", [
          {
            placeholderIdx: 2,
            placeholderType: "picture",
            content: [image("photo.png")],
          },
        ]),
      ];

      generatePptx(parseResult, mappings, { imageResolver });

      expect(imageResolver).toHaveBeenCalledWith("photo.png");
      expect(picPh.insert_picture).toHaveBeenCalledWith(imageData);
    });

    it("imageResolverが未指定の場合画像注入をスキップする", () => {
      const picPh = createMockPlaceholder(2, "picture");
      mockPrs = createMockPresentation(["Picture with Caption"], () => [picPh]);

      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [slideData([image("photo.png")])],
      };
      const mappings = [
        mapping("Picture with Caption", [
          {
            placeholderIdx: 2,
            placeholderType: "picture",
            content: [image("photo.png")],
          },
        ]),
      ];

      generatePptx(parseResult, mappings);

      expect(picPh.insert_picture).not.toHaveBeenCalled();
    });

    it("imageResolverがundefinedを返す場合画像注入をスキップする", () => {
      const picPh = createMockPlaceholder(2, "picture");
      mockPrs = createMockPresentation(["Picture with Caption"], () => [picPh]);
      const imageResolver = vi.fn(() => undefined);

      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [slideData([image("missing.png")])],
      };
      const mappings = [
        mapping("Picture with Caption", [
          {
            placeholderIdx: 2,
            placeholderType: "picture",
            content: [image("missing.png")],
          },
        ]),
      ];

      generatePptx(parseResult, mappings, { imageResolver });

      expect(picPh.insert_picture).not.toHaveBeenCalled();
    });
  });

  describe("bodyプレースホルダの画像シェイプ", () => {
    it("imageResolver付きでbodyプレースホルダの画像をpictureシェイプとして追加する", () => {
      const bodyPh = createMockPlaceholder(1, "body");
      mockPrs = createMockPresentation(["Title and Content"], () => [bodyPh]);
      const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const imageResolver = vi.fn((src: string) => {
        if (src === "photo.png") return imageData;
        return undefined;
      });

      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [slideData([image("photo.png")])],
      };
      const mappings = [
        mapping("Title and Content", [
          {
            placeholderIdx: 1,
            placeholderType: "body" as const,
            content: [image("photo.png")],
          },
        ]),
      ];

      generatePptx(parseResult, mappings, { imageResolver });

      const slide = mockPrs._slides[0];
      expect(slide.shapes.add_picture).toHaveBeenCalledWith(
        imageData,
        expect.anything(),
        expect.anything(),
        expect.anything(), // width: body幅またはpx指定値
        undefined, // height: 未指定
      );
    });

    it("imageResolver未指定の場合bodyプレースホルダの画像はフォールバックテキストになる", () => {
      const bodyPh = createMockPlaceholder(1, "body");
      mockPrs = createMockPresentation(["Title and Content"], () => [bodyPh]);

      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [slideData([image("photo.png")])],
      };
      const mappings = [
        mapping("Title and Content", [
          {
            placeholderIdx: 1,
            placeholderType: "body" as const,
            content: [image("photo.png")],
          },
        ]),
      ];

      generatePptx(parseResult, mappings);

      const slide = mockPrs._slides[0];
      expect(slide.shapes.add_picture).not.toHaveBeenCalled();
      // フォールバックテキストが書き込まれていること
      const tf = bodyPh.text_frame;
      const runs = tf.paragraphs[0].runs;
      expect(runs[0].text).toBe("[Image: photo.png]");
    });

    it("imageResolverがundefinedを返す場合bodyプレースホルダの画像はフォールバックテキストになる", () => {
      const bodyPh = createMockPlaceholder(1, "body");
      mockPrs = createMockPresentation(["Title and Content"], () => [bodyPh]);
      const imageResolver = vi.fn(() => undefined);

      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [slideData([image("missing.png")])],
      };
      const mappings = [
        mapping("Title and Content", [
          {
            placeholderIdx: 1,
            placeholderType: "body" as const,
            content: [image("missing.png")],
          },
        ]),
      ];

      generatePptx(parseResult, mappings, { imageResolver });

      const slide = mockPrs._slides[0];
      expect(slide.shapes.add_picture).not.toHaveBeenCalled();
      const tf = bodyPh.text_frame;
      const runs = tf.paragraphs[0].runs;
      expect(runs[0].text).toBe("[Image: missing.png]");
    });
  });

  describe("スピーカーノート", () => {
    it("スライドにノートを追加する", () => {
      mockPrs = createMockPresentation(["Blank"], () => []);
      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [slideData([], ["ノート1行目", "ノート2行目"])],
      };
      const mappings = [mapping("Blank", [])];

      generatePptx(parseResult, mappings);

      const slide = mockPrs._slides[0];
      expect(slide.notes_slide.notes_text_frame.text).toBe(
        "ノート1行目\nノート2行目",
      );
    });

    it("ノートが空の場合ノートを設定しない", () => {
      mockPrs = createMockPresentation(["Blank"], () => []);
      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [slideData([], [])],
      };
      const mappings = [mapping("Blank", [])];

      generatePptx(parseResult, mappings);

      const slide = mockPrs._slides[0];
      expect(slide.notes_slide.notes_text_frame.text).toBe("");
    });
  });

  describe("コードブロックの注入", () => {
    it("コードブロックをテキストボックスとして追加する", () => {
      const bodyPh = createMockPlaceholder(1, "body");
      mockPrs = createMockPresentation(["Title and Content"], () => [bodyPh]);
      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [slideData([codeBlock("const x = 1;", "typescript")])],
      };
      const mappings = [
        mapping("Title and Content", [
          {
            placeholderIdx: 1,
            placeholderType: "body",
            content: [codeBlock("const x = 1;", "typescript")],
          },
        ]),
      ];

      generatePptx(parseResult, mappings);

      const slide = mockPrs._slides[0];
      expect(slide.shapes.add_textbox).toHaveBeenCalledTimes(1);
      // テキストボックスの中身を検証
      const txBox = slide.shapes.add_textbox.mock.results[0].value;
      const p = txBox.text_frame.paragraphs[0];
      expect(p.runs[0].text).toBe("const x = 1;");
      expect(p.runs[0].font.name).toBe("Courier New");
    });

    it("複数行のコードブロックを行ごとに段落として注入する", () => {
      const bodyPh = createMockPlaceholder(1, "body");
      mockPrs = createMockPresentation(["Title and Content"], () => [bodyPh]);
      const code = "line1\nline2\nline3";
      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [slideData([codeBlock(code)])],
      };
      const mappings = [
        mapping("Title and Content", [
          {
            placeholderIdx: 1,
            placeholderType: "body",
            content: [codeBlock(code)],
          },
        ]),
      ];

      generatePptx(parseResult, mappings);

      const slide = mockPrs._slides[0];
      expect(slide.shapes.add_textbox).toHaveBeenCalledTimes(1);
      const txBox = slide.shapes.add_textbox.mock.results[0].value;
      const paragraphs = txBox.text_frame.paragraphs;
      // line1 uses existing paragraph, line2 and line3 use add_paragraph
      expect(txBox.text_frame.add_paragraph).toHaveBeenCalledTimes(2);
      expect(paragraphs).toHaveLength(3);
      expect(paragraphs[0].runs[0].text).toBe("line1");
      expect(paragraphs[1].runs[0].text).toBe("line2");
      expect(paragraphs[2].runs[0].text).toBe("line3");
      // All runs should use Courier New
      for (const p of paragraphs) {
        expect(p.runs[0].font.name).toBe("Courier New");
      }
    });
  });

  describe("テーブルの注入", () => {
    it("テーブルをシェイプとして追加する", () => {
      const bodyPh = createMockPlaceholder(1, "body");
      mockPrs = createMockPresentation(["Title and Content"], () => [bodyPh]);
      const tbl = table(["項目", "値"], [["A", "100"]]);
      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [slideData([tbl])],
      };
      const mappings = [
        mapping("Title and Content", [
          {
            placeholderIdx: 1,
            placeholderType: "body",
            content: [tbl],
          },
        ]),
      ];

      generatePptx(parseResult, mappings);

      const slide = mockPrs._slides[0];
      expect(slide.shapes.add_table).toHaveBeenCalledTimes(1);
      // 2 rows (1 header + 1 body), 2 columns
      expect(slide.shapes.add_table).toHaveBeenCalledWith(
        2,
        2,
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
      );
    });

    it("テーブルセルにテキストを注入する", () => {
      const bodyPh = createMockPlaceholder(1, "body");
      mockPrs = createMockPresentation(["Title and Content"], () => [bodyPh]);
      const tbl = table(["H1", "H2"], [["C1", "C2"]]);
      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [slideData([tbl])],
      };
      const mappings = [
        mapping("Title and Content", [
          {
            placeholderIdx: 1,
            placeholderType: "body",
            content: [tbl],
          },
        ]),
      ];

      generatePptx(parseResult, mappings);

      const slide = mockPrs._slides[0];
      const graphicFrame = slide.shapes.add_table.mock.results[0].value;
      const mockTable = graphicFrame.table;

      // first_row should be set to true
      expect(mockTable.first_row).toBe(true);

      // Verify cell() was called for each cell
      expect(mockTable.cell).toHaveBeenCalledWith(0, 0);
      expect(mockTable.cell).toHaveBeenCalledWith(0, 1);
      expect(mockTable.cell).toHaveBeenCalledWith(1, 0);
      expect(mockTable.cell).toHaveBeenCalledWith(1, 1);

      // Verify header cell content
      const headerCell = mockTable.cell.mock.results[0].value;
      expect(headerCell.text_frame.paragraphs[0].runs[0].text).toBe("H1");
      expect(headerCell.text_frame.paragraphs[0].font.bold).toBe(true);

      // Verify body cell content
      const bodyCell = mockTable.cell.mock.results[2].value;
      expect(bodyCell.text_frame.paragraphs[0].runs[0].text).toBe("C1");
      expect(bodyCell.text_frame.paragraphs[0].font.bold).toBeUndefined();
    });
  });

  describe("非連番プレースホルダー idx", () => {
    it("idx が連番でないプレースホルダーに正しくアクセスできる", () => {
      // 実際のテンプレートでは idx が 0, 10, 13 のように連番でないケースがある
      const titlePh = createMockPlaceholder(0, "title");
      const bodyPh = createMockPlaceholder(10, "body");
      mockPrs = createMockPresentation(["Custom Layout"], () => [
        titlePh,
        bodyPh,
      ]);

      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [
          slideData([heading(1, "タイトル"), paragraph("本文テキスト")]),
        ],
      };
      const mappings = [
        mapping("Custom Layout", [
          {
            placeholderIdx: 0,
            placeholderType: "title",
            content: [heading(1, "タイトル")],
          },
          {
            placeholderIdx: 10,
            placeholderType: "body",
            content: [paragraph("本文テキスト")],
          },
        ]),
      ];

      generatePptx(parseResult, mappings);

      // タイトルが正しく注入されていること
      const titleRun = titlePh.text_frame.paragraphs[0].runs[0];
      expect(titleRun.text).toBe("タイトル");

      // idx=10 の body プレースホルダーにも正しく注入されていること
      const bodyRun = bodyPh.text_frame.paragraphs[0].runs[0];
      expect(bodyRun.text).toBe("本文テキスト");
    });
  });

  describe("テキストと特殊要素が混在するスライドのレイアウト", () => {
    it("テキストとコードブロックが混在する場合、bodyプレースホルダの高さがテキスト描画高さにリサイズされる", () => {
      const bodyPh = createMockPlaceholder(1, "body");
      // bodyプレースホルダにレイアウト情報を設定（実際のテンプレート相当）
      Object.assign(bodyPh, {
        top: 0.5 * 914400, // 0.5 inches in EMU
        left: 0.5 * 914400,
        width: 9 * 914400,
        height: 4 * 914400, // 4 inches（大きな固定高さ）
      });
      mockPrs = createMockPresentation(["Title and Content"], () => [bodyPh]);

      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [
          slideData([
            paragraph("本文テキスト"),
            codeBlock('def greet(name):\n    print(f"Hello, {name}!")', "python"),
            paragraph("追加のテキスト"),
          ]),
        ],
      };
      const mappings = [
        mapping("Title and Content", [
          {
            placeholderIdx: 1,
            placeholderType: "body",
            content: [
              paragraph("本文テキスト"),
              codeBlock(
                'def greet(name):\n    print(f"Hello, {name}!")',
                "python",
              ),
              paragraph("追加のテキスト"),
            ],
          },
        ]),
      ];

      generatePptx(parseResult, mappings);

      // bodyプレースホルダの高さが元の4インチではなく、テキスト推定高さにリサイズされている
      const originalHeight = 4 * 914400;
      expect(bodyPh.height).toBeLessThan(originalHeight);
      // テキストボックス（コードブロック）が追加されている
      const slide = mockPrs._slides[0];
      expect(slide.shapes.add_textbox).toHaveBeenCalledTimes(1);
      // コードブロックの top 位置がリサイズ後の高さ基準で配置されている
      const addTextboxCall = slide.shapes.add_textbox.mock.calls[0];
      const codeBlockTop = addTextboxCall[1]; // 第2引数が top (Emu)
      const expectedTop = bodyPh.top + bodyPh.height; // リサイズ後の top + height
      expect(codeBlockTop).toBe(expectedTop);
    });

    it("テキストとテーブルが混在する場合、bodyプレースホルダの高さがリサイズされる", () => {
      const bodyPh = createMockPlaceholder(1, "body");
      Object.assign(bodyPh, {
        top: 0.5 * 914400,
        left: 0.5 * 914400,
        width: 9 * 914400,
        height: 4 * 914400,
      });
      mockPrs = createMockPresentation(["Title and Content"], () => [bodyPh]);

      const tbl = table(["Col1", "Col2"], [["A", "B"]]);
      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [slideData([paragraph("テキスト"), tbl])],
      };
      const mappings = [
        mapping("Title and Content", [
          {
            placeholderIdx: 1,
            placeholderType: "body",
            content: [paragraph("テキスト"), tbl],
          },
        ]),
      ];

      generatePptx(parseResult, mappings);

      const originalHeight = 4 * 914400;
      expect(bodyPh.height).toBeLessThan(originalHeight);
      const slide = mockPrs._slides[0];
      expect(slide.shapes.add_table).toHaveBeenCalledTimes(1);
      // テーブルの top 位置がリサイズ後の高さ基準で配置されている
      const addTableCall = slide.shapes.add_table.mock.calls[0];
      const tableTop = addTableCall[3]; // add_table(rows, cols, left, top, width, height)
      const expectedTop = bodyPh.top + bodyPh.height;
      expect(tableTop).toBe(expectedTop);
    });

    it("特殊要素のみの場合、bodyプレースホルダの高さはリサイズされない", () => {
      const bodyPh = createMockPlaceholder(1, "body");
      const originalHeight = 4 * 914400;
      Object.assign(bodyPh, {
        top: 0.5 * 914400,
        left: 0.5 * 914400,
        width: 9 * 914400,
        height: originalHeight,
      });
      mockPrs = createMockPresentation(["Title and Content"], () => [bodyPh]);

      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [slideData([codeBlock("const x = 1;")])],
      };
      const mappings = [
        mapping("Title and Content", [
          {
            placeholderIdx: 1,
            placeholderType: "body",
            content: [codeBlock("const x = 1;")],
          },
        ]),
      ];

      generatePptx(parseResult, mappings);

      // 特殊要素のみの場合、高さはリサイズされない
      expect(bodyPh.height).toBe(originalHeight);
    });
  });

  describe("複合シナリオ", () => {
    it("複数スライド・複数プレースホルダの注入を正しく行う", () => {
      const slide1Phs = [
        createMockPlaceholder(0, "title"),
        createMockPlaceholder(1, "body"),
      ];
      const slide2Phs = [
        createMockPlaceholder(0, "title"),
        createMockPlaceholder(2, "picture"),
      ];
      let slideIndex = 0;
      mockPrs = createMockPresentation(
        ["Title and Content", "Picture with Caption"],
        () => {
          const phs = slideIndex === 0 ? slide1Phs : slide2Phs;
          slideIndex++;
          return phs;
        },
      );

      const imageData = new Uint8Array([1, 2, 3]);
      const imageResolver = vi.fn(() => imageData);

      const parseResult: ParseResult = {
        frontMatter: {},
        slides: [
          slideData(
            [
              heading(1, "スライド1"),
              paragraph("本文"),
              list([{ text: "項目" }]),
            ],
            ["ノート1"],
          ),
          slideData([heading(1, "スライド2"), image("img.png")]),
        ],
      };

      const mappings = [
        mapping("Title and Content", [
          {
            placeholderIdx: 0,
            placeholderType: "title",
            content: [heading(1, "スライド1")],
          },
          {
            placeholderIdx: 1,
            placeholderType: "body",
            content: [paragraph("本文"), list([{ text: "項目" }])],
          },
        ]),
        mapping("Picture with Caption", [
          {
            placeholderIdx: 0,
            placeholderType: "title",
            content: [heading(1, "スライド2")],
          },
          {
            placeholderIdx: 2,
            placeholderType: "picture",
            content: [image("img.png")],
          },
        ]),
      ];

      const result = generatePptx(parseResult, mappings, { imageResolver });

      expect(result).toBeInstanceOf(Uint8Array);
      expect(mockPrs.slides.add_slide).toHaveBeenCalledTimes(2);

      // スライド1: タイトルとボディ
      const s1TitleRun = slide1Phs[0].text_frame.paragraphs[0].runs[0];
      expect(s1TitleRun.text).toBe("スライド1");

      // スライド2: 画像
      expect(slide2Phs[1].insert_picture).toHaveBeenCalledWith(imageData);

      // ノート
      const slide1 = mockPrs._slides[0];
      expect(slide1.notes_slide.notes_text_frame.text).toBe("ノート1");
    });
  });
});
