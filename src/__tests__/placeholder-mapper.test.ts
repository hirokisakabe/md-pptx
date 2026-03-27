import { describe, expect, it } from "vitest";
import {
  mapSlideToPlaceholders,
  mapPresentation,
} from "../placeholder-mapper.js";
import type {
  SlideData,
  LayoutInfo,
  ContentElement,
  HeadingElement,
  ParagraphElement,
  ListElement,
  ImageElement,
  TemplateInfo,
  ParseResult,
} from "../types.js";

// === ヘルパー ===

function heading(level: 1 | 2 | 3 | 4 | 5 | 6, text: string): HeadingElement {
  return { type: "heading", level, runs: [{ text }] };
}

function paragraph(text: string): ParagraphElement {
  return { type: "paragraph", runs: [{ text }] };
}

function list(items: string[]): ListElement {
  return {
    type: "list",
    items: items.map((text) => ({
      runs: [{ text }],
      level: 0,
      ordered: false,
    })),
  };
}

function image(src: string): ImageElement {
  return { type: "image", image: { src } };
}

function slide(content: ContentElement[], layout?: string): SlideData {
  return { content, notes: [], directives: [], layout };
}

const TITLE_AND_CONTENT_LAYOUT: LayoutInfo = {
  name: "Title and Content",
  placeholders: [
    { idx: 0, type: "title", name: "Title 1" },
    { idx: 1, type: "body", name: "Content Placeholder 2" },
  ],
};

const TITLE_ONLY_LAYOUT: LayoutInfo = {
  name: "Title Only",
  placeholders: [{ idx: 0, type: "title", name: "Title 1" }],
};

const PICTURE_LAYOUT: LayoutInfo = {
  name: "Picture with Caption",
  placeholders: [
    { idx: 0, type: "title", name: "Title 1" },
    { idx: 1, type: "body", name: "Text Placeholder 2" },
    { idx: 2, type: "picture", name: "Picture Placeholder 3" },
  ],
};

const SUBTITLE_ONLY_LAYOUT: LayoutInfo = {
  name: "Subtitle Only",
  placeholders: [
    { idx: 0, type: "subtitle", name: "Subtitle 1" },
    { idx: 1, type: "body", name: "Body 1" },
  ],
};

const BLANK_LAYOUT: LayoutInfo = {
  name: "Blank",
  placeholders: [],
};

// === テスト ===

describe("mapSlideToPlaceholders", () => {
  describe("基本マッピング", () => {
    it("h1見出し → title、本文 → body にマッピングする", () => {
      const s = slide([heading(1, "タイトル"), paragraph("本文テキスト")]);
      const result = mapSlideToPlaceholders(s, TITLE_AND_CONTENT_LAYOUT);

      expect(result.layoutName).toBe("Title and Content");
      expect(result.fallbackToBlank).toBe(false);
      expect(result.assignments).toHaveLength(2);

      const titleAssignment = result.assignments.find(
        (a) => a.placeholderType === "title",
      );
      expect(titleAssignment).toBeDefined();
      expect(titleAssignment!.placeholderIdx).toBe(0);
      expect(titleAssignment!.content).toHaveLength(1);
      expect(titleAssignment!.content[0].type).toBe("heading");

      const bodyAssignment = result.assignments.find(
        (a) => a.placeholderType === "body",
      );
      expect(bodyAssignment).toBeDefined();
      expect(bodyAssignment!.placeholderIdx).toBe(1);
      expect(bodyAssignment!.content).toHaveLength(1);
      expect(bodyAssignment!.content[0].type).toBe("paragraph");
    });

    it("h2見出しもtitleプレースホルダにマッピングする", () => {
      const s = slide([heading(2, "サブタイトル"), paragraph("本文")]);
      const result = mapSlideToPlaceholders(s, TITLE_AND_CONTENT_LAYOUT);

      const titleAssignment = result.assignments.find(
        (a) => a.placeholderType === "title",
      );
      expect(titleAssignment).toBeDefined();
      expect(titleAssignment!.content[0]).toEqual(heading(2, "サブタイトル"));
    });

    it("h3以下の見出しはbodyにマッピングする", () => {
      const s = slide([heading(3, "小見出し"), paragraph("本文")]);
      const result = mapSlideToPlaceholders(s, TITLE_AND_CONTENT_LAYOUT);

      expect(result.assignments).toHaveLength(1);
      const bodyAssignment = result.assignments.find(
        (a) => a.placeholderType === "body",
      );
      expect(bodyAssignment).toBeDefined();
      expect(bodyAssignment!.content).toHaveLength(2);
    });

    it("リストをbodyにマッピングする", () => {
      const s = slide([heading(1, "タイトル"), list(["項目1", "項目2"])]);
      const result = mapSlideToPlaceholders(s, TITLE_AND_CONTENT_LAYOUT);

      const bodyAssignment = result.assignments.find(
        (a) => a.placeholderType === "body",
      );
      expect(bodyAssignment).toBeDefined();
      expect(bodyAssignment!.content).toHaveLength(1);
      expect(bodyAssignment!.content[0].type).toBe("list");
    });

    it("最初のh1/h2のみtitleに割り当て、2番目以降はbodyに入る", () => {
      const s = slide([
        heading(1, "最初の見出し"),
        heading(2, "2番目の見出し"),
        paragraph("本文"),
      ]);
      const result = mapSlideToPlaceholders(s, TITLE_AND_CONTENT_LAYOUT);

      const titleAssignment = result.assignments.find(
        (a) => a.placeholderType === "title",
      );
      expect(titleAssignment!.content).toHaveLength(1);

      const bodyAssignment = result.assignments.find(
        (a) => a.placeholderType === "body",
      );
      expect(bodyAssignment!.content).toHaveLength(2);
    });
  });

  describe("subtitleマッピング", () => {
    it("titleがなくsubtitleがあるレイアウトではsubtitleにフォールバックする", () => {
      const s = slide([heading(1, "タイトル"), paragraph("本文")]);
      const result = mapSlideToPlaceholders(s, SUBTITLE_ONLY_LAYOUT);

      const subtitleAssignment = result.assignments.find(
        (a) => a.placeholderType === "subtitle",
      );
      expect(subtitleAssignment).toBeDefined();
      expect(subtitleAssignment!.placeholderIdx).toBe(0);
      expect(subtitleAssignment!.content).toHaveLength(1);
      expect(subtitleAssignment!.content[0].type).toBe("heading");

      expect(result.unmappedContent).toHaveLength(0);
    });

    it("titleとsubtitle両方あるレイアウトではtitleが優先される", () => {
      const titleAndSubtitleLayout: LayoutInfo = {
        name: "Title and Subtitle",
        placeholders: [
          { idx: 0, type: "title", name: "Title 1" },
          { idx: 1, type: "subtitle", name: "Subtitle 1" },
        ],
      };
      const s = slide([heading(1, "タイトル")]);
      const result = mapSlideToPlaceholders(s, titleAndSubtitleLayout);

      const titleAssignment = result.assignments.find(
        (a) => a.placeholderType === "title",
      );
      expect(titleAssignment).toBeDefined();
      expect(titleAssignment!.content).toHaveLength(1);

      const subtitleAssignment = result.assignments.find(
        (a) => a.placeholderType === "subtitle",
      );
      expect(subtitleAssignment).toBeUndefined();
    });
  });

  describe("画像マッピング", () => {
    it("pictureプレースホルダがあれば画像をそこにマッピングする", () => {
      const s = slide([
        heading(1, "タイトル"),
        image("photo.png"),
        paragraph("キャプション"),
      ]);
      const result = mapSlideToPlaceholders(s, PICTURE_LAYOUT);

      const picAssignment = result.assignments.find(
        (a) => a.placeholderType === "picture",
      );
      expect(picAssignment).toBeDefined();
      expect(picAssignment!.placeholderIdx).toBe(2);
      expect(picAssignment!.content).toHaveLength(1);
      expect(picAssignment!.content[0].type).toBe("image");
    });

    it("pictureプレースホルダがない場合、画像をbodyにマッピングする", () => {
      const s = slide([heading(1, "タイトル"), image("photo.png")]);
      const result = mapSlideToPlaceholders(s, TITLE_AND_CONTENT_LAYOUT);

      const bodyAssignment = result.assignments.find(
        (a) => a.placeholderType === "body",
      );
      expect(bodyAssignment).toBeDefined();
      expect(bodyAssignment!.content).toHaveLength(1);
      expect(bodyAssignment!.content[0].type).toBe("image");
    });

    it("pictureもbodyもない場合、画像はunmappedになる", () => {
      const s = slide([image("photo.png")]);
      const result = mapSlideToPlaceholders(s, TITLE_ONLY_LAYOUT);

      expect(result.unmappedContent).toHaveLength(1);
      expect(result.unmappedContent[0].type).toBe("image");
    });
  });

  describe("フォールバック", () => {
    it("プレースホルダがないレイアウトでBlankにフォールバックする", () => {
      const s = slide([heading(1, "タイトル"), paragraph("本文")]);
      const result = mapSlideToPlaceholders(s, BLANK_LAYOUT);

      expect(result.fallbackToBlank).toBe(true);
      expect(result.layoutName).toBe("Blank");
      expect(result.assignments).toHaveLength(0);
      expect(result.unmappedContent).toHaveLength(2);
    });

    it("titleプレースホルダがない場合、見出しはunmappedになる", () => {
      const bodyOnlyLayout: LayoutInfo = {
        name: "Body Only",
        placeholders: [{ idx: 1, type: "body", name: "Body 1" }],
      };
      const s = slide([heading(1, "タイトル"), paragraph("本文")]);
      const result = mapSlideToPlaceholders(s, bodyOnlyLayout);

      expect(result.unmappedContent).toHaveLength(1);
      expect(result.unmappedContent[0].type).toBe("heading");

      const bodyAssignment = result.assignments.find(
        (a) => a.placeholderType === "body",
      );
      expect(bodyAssignment!.content).toHaveLength(1);
    });

    it("空のスライドではassignmentsもunmappedも空になる", () => {
      const s = slide([]);
      const result = mapSlideToPlaceholders(s, TITLE_AND_CONTENT_LAYOUT);

      expect(result.assignments).toHaveLength(0);
      expect(result.unmappedContent).toHaveLength(0);
      expect(result.fallbackToBlank).toBe(false);
    });
  });
});

describe("mapPresentation", () => {
  const templateInfo: TemplateInfo = {
    layouts: [
      TITLE_AND_CONTENT_LAYOUT,
      PICTURE_LAYOUT,
      BLANK_LAYOUT,
      TITLE_ONLY_LAYOUT,
    ],
  };

  it("各スライドのlayoutに応じてマッピングし、assignmentsの詳細が正しい", () => {
    const parseResult: ParseResult = {
      frontMatter: {},
      slides: [
        slide(
          [heading(1, "スライド1"), paragraph("本文1")],
          "Title and Content",
        ),
        slide(
          [heading(1, "スライド2"), image("photo.png")],
          "Picture with Caption",
        ),
      ],
    };

    const results = mapPresentation(parseResult, templateInfo);

    expect(results).toHaveLength(2);

    // スライド1: Title and Content
    expect(results[0].layoutName).toBe("Title and Content");
    expect(results[0].assignments).toHaveLength(2);
    const s1Title = results[0].assignments.find(
      (a) => a.placeholderType === "title",
    );
    expect(s1Title!.placeholderIdx).toBe(0);
    expect(s1Title!.content[0].type).toBe("heading");
    const s1Body = results[0].assignments.find(
      (a) => a.placeholderType === "body",
    );
    expect(s1Body!.placeholderIdx).toBe(1);
    expect(s1Body!.content[0].type).toBe("paragraph");

    // スライド2: Picture with Caption
    expect(results[1].layoutName).toBe("Picture with Caption");
    const s2Title = results[1].assignments.find(
      (a) => a.placeholderType === "title",
    );
    expect(s2Title!.placeholderIdx).toBe(0);
    const s2Pic = results[1].assignments.find(
      (a) => a.placeholderType === "picture",
    );
    expect(s2Pic!.placeholderIdx).toBe(2);
    expect(s2Pic!.content[0].type).toBe("image");
  });

  it("レイアウトが見つからない場合Blankにフォールバックする", () => {
    const parseResult: ParseResult = {
      frontMatter: {},
      slides: [
        slide(
          [heading(1, "タイトル"), paragraph("本文")],
          "Non Existent Layout",
        ),
      ],
    };

    const results = mapPresentation(parseResult, templateInfo);

    expect(results).toHaveLength(1);
    expect(results[0].fallbackToBlank).toBe(true);
    expect(results[0].layoutName).toBe("Blank");
    expect(results[0].unmappedContent).toHaveLength(2);
  });

  it("layoutが未指定のスライドはBlankにフォールバックする", () => {
    const parseResult: ParseResult = {
      frontMatter: {},
      slides: [slide([heading(1, "タイトル"), paragraph("本文")])],
    };

    const results = mapPresentation(parseResult, templateInfo);

    expect(results).toHaveLength(1);
    expect(results[0].fallbackToBlank).toBe(true);
    expect(results[0].layoutName).toBe("Blank");
  });

  it("テンプレートにBlankレイアウトがあればフォールバック時にそれを使う", () => {
    const blankWithBody: LayoutInfo = {
      name: "Blank",
      placeholders: [{ idx: 1, type: "body", name: "Body 1" }],
    };
    const templateWithBlankBody: TemplateInfo = {
      layouts: [TITLE_AND_CONTENT_LAYOUT, blankWithBody],
    };
    const parseResult: ParseResult = {
      frontMatter: {},
      slides: [slide([paragraph("本文")], "Non Existent Layout")],
    };

    const results = mapPresentation(parseResult, templateWithBlankBody);

    expect(results).toHaveLength(1);
    expect(results[0].fallbackToBlank).toBe(false);
    expect(results[0].layoutName).toBe("Blank");
    const bodyAssignment = results[0].assignments.find(
      (a) => a.placeholderType === "body",
    );
    expect(bodyAssignment).toBeDefined();
    expect(bodyAssignment!.content).toHaveLength(1);
  });
});
