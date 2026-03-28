import { describe, it, expect } from "vitest";
import MarkdownIt from "markdown-it";
import { convertTokensToSlide } from "./token-converter.js";

const md = new MarkdownIt({ html: true });
md.enable("strikethrough");

function tokensFor(input: string) {
  return md.parse(input, {});
}

describe("convertTokensToSlide", () => {
  describe("headings", () => {
    it("should extract h1 heading", () => {
      const slide = convertTokensToSlide(tokensFor("# Hello World"));
      expect(slide.content).toHaveLength(1);
      expect(slide.content[0]).toEqual({
        type: "heading",
        level: 1,
        runs: [{ text: "Hello World" }],
      });
    });

    it("should extract h2 heading", () => {
      const slide = convertTokensToSlide(tokensFor("## Sub Title"));
      expect(slide.content).toHaveLength(1);
      expect(slide.content[0]).toEqual({
        type: "heading",
        level: 2,
        runs: [{ text: "Sub Title" }],
      });
    });

    it("should handle heading with inline formatting", () => {
      const slide = convertTokensToSlide(tokensFor("# **Bold** Title"));
      expect(slide.content[0]).toEqual({
        type: "heading",
        level: 1,
        runs: [{ text: "Bold", bold: true }, { text: " Title" }],
      });
    });
  });

  describe("paragraphs", () => {
    it("should extract plain paragraph", () => {
      const slide = convertTokensToSlide(tokensFor("Hello world"));
      expect(slide.content).toHaveLength(1);
      expect(slide.content[0]).toEqual({
        type: "paragraph",
        runs: [{ text: "Hello world" }],
      });
    });

    it("should handle bold text", () => {
      const slide = convertTokensToSlide(tokensFor("**bold text**"));
      expect(slide.content[0]).toEqual({
        type: "paragraph",
        runs: [{ text: "bold text", bold: true }],
      });
    });

    it("should handle italic text", () => {
      const slide = convertTokensToSlide(tokensFor("*italic text*"));
      expect(slide.content[0]).toEqual({
        type: "paragraph",
        runs: [{ text: "italic text", italic: true }],
      });
    });

    it("should handle inline code", () => {
      const slide = convertTokensToSlide(tokensFor("`code`"));
      expect(slide.content[0]).toEqual({
        type: "paragraph",
        runs: [{ text: "code", code: true }],
      });
    });

    it("should handle strikethrough text", () => {
      const slide = convertTokensToSlide(tokensFor("~~deleted~~"));
      expect(slide.content[0]).toEqual({
        type: "paragraph",
        runs: [{ text: "deleted", strikethrough: true }],
      });
    });

    it("should handle hyperlinks", () => {
      const slide = convertTokensToSlide(
        tokensFor("[click here](https://example.com)"),
      );
      expect(slide.content[0]).toEqual({
        type: "paragraph",
        runs: [{ text: "click here", link: "https://example.com" }],
      });
    });

    it("should handle mixed formatting", () => {
      const slide = convertTokensToSlide(
        tokensFor("Normal **bold** and *italic* text"),
      );
      const paragraph = slide.content[0];
      expect(paragraph.type).toBe("paragraph");
      if (paragraph.type === "paragraph") {
        expect(paragraph.runs).toEqual([
          { text: "Normal " },
          { text: "bold", bold: true },
          { text: " and " },
          { text: "italic", italic: true },
          { text: " text" },
        ]);
      }
    });

    it("should handle hardbreak (trailing two spaces)", () => {
      const slide = convertTokensToSlide(tokensFor("line1  \nline2"));
      expect(slide.content[0]).toEqual({
        type: "paragraph",
        runs: [{ text: "line1" }, { text: "\n" }, { text: "line2" }],
      });
    });
  });

  describe("lists", () => {
    it("should extract unordered list", () => {
      const slide = convertTokensToSlide(tokensFor("- Item 1\n- Item 2"));
      expect(slide.content).toHaveLength(1);
      expect(slide.content[0]).toEqual({
        type: "list",
        items: [
          { runs: [{ text: "Item 1" }], level: 0, ordered: false },
          { runs: [{ text: "Item 2" }], level: 0, ordered: false },
        ],
      });
    });

    it("should extract ordered list", () => {
      const slide = convertTokensToSlide(tokensFor("1. First\n2. Second"));
      expect(slide.content).toHaveLength(1);
      expect(slide.content[0]).toEqual({
        type: "list",
        items: [
          { runs: [{ text: "First" }], level: 0, ordered: true },
          { runs: [{ text: "Second" }], level: 0, ordered: true },
        ],
      });
    });

    it("should handle nested lists", () => {
      const slide = convertTokensToSlide(
        tokensFor("- Parent\n  - Child\n    - Grandchild"),
      );
      expect(slide.content).toHaveLength(1);
      if (slide.content[0].type === "list") {
        expect(slide.content[0].items).toHaveLength(3);
        expect(slide.content[0].items[0].level).toBe(0);
        expect(slide.content[0].items[1].level).toBe(1);
        expect(slide.content[0].items[2].level).toBe(2);
      }
    });

    it("should handle list items with formatting", () => {
      const slide = convertTokensToSlide(tokensFor("- **Bold** item"));
      if (slide.content[0].type === "list") {
        expect(slide.content[0].items[0].runs).toEqual([
          { text: "Bold", bold: true },
          { text: " item" },
        ]);
      }
    });
  });

  describe("images", () => {
    it("should extract image", () => {
      const slide = convertTokensToSlide(tokensFor("![alt text](./image.png)"));
      expect(slide.content).toHaveLength(1);
      expect(slide.content[0]).toEqual({
        type: "image",
        image: { src: "./image.png", alt: "alt text" },
      });
    });

    it("should parse width from alt text", () => {
      const slide = convertTokensToSlide(tokensFor("![w:400](./img.png)"));
      expect(slide.content[0]).toEqual({
        type: "image",
        image: { src: "./img.png", width: 400 },
      });
    });

    it("should parse height from alt text", () => {
      const slide = convertTokensToSlide(tokensFor("![h:300](./img.png)"));
      expect(slide.content[0]).toEqual({
        type: "image",
        image: { src: "./img.png", height: 300 },
      });
    });

    it("should parse both width and height", () => {
      const slide = convertTokensToSlide(
        tokensFor("![w:400 h:300](./img.png)"),
      );
      expect(slide.content[0]).toEqual({
        type: "image",
        image: { src: "./img.png", width: 400, height: 300 },
      });
    });

    it("should parse width:px and height:px format", () => {
      const slide = convertTokensToSlide(
        tokensFor("![width:400px height:300px](./img.png)"),
      );
      expect(slide.content[0]).toEqual({
        type: "image",
        image: { src: "./img.png", width: 400, height: 300 },
      });
    });
  });

  describe("code blocks", () => {
    it("should extract fenced code block with language", () => {
      const slide = convertTokensToSlide(
        tokensFor("```typescript\nconst x = 1;\n```"),
      );
      expect(slide.content).toHaveLength(1);
      expect(slide.content[0]).toEqual({
        type: "code-block",
        language: "typescript",
        code: "const x = 1;",
      });
    });

    it("should extract fenced code block without language", () => {
      const slide = convertTokensToSlide(tokensFor("```\nhello world\n```"));
      expect(slide.content).toHaveLength(1);
      expect(slide.content[0]).toEqual({
        type: "code-block",
        code: "hello world",
      });
    });

    it("should extract multi-line code block", () => {
      const slide = convertTokensToSlide(
        tokensFor("```js\nfunction hello() {\n  return 1;\n}\n```"),
      );
      expect(slide.content).toHaveLength(1);
      expect(slide.content[0]).toEqual({
        type: "code-block",
        language: "js",
        code: "function hello() {\n  return 1;\n}",
      });
    });

    it("should handle code block with other content", () => {
      const input = "## Title\n\n```python\nprint('hello')\n```\n\nSome text";
      const slide = convertTokensToSlide(tokensFor(input));
      expect(slide.content).toHaveLength(3);
      expect(slide.content[0].type).toBe("heading");
      expect(slide.content[1].type).toBe("code-block");
      expect(slide.content[2].type).toBe("paragraph");
    });

    it("should extract only language name from fence info with metadata", () => {
      const slide = convertTokensToSlide(
        tokensFor('```ts title="example"\nconst x = 1;\n```'),
      );
      expect(slide.content).toHaveLength(1);
      expect(slide.content[0]).toEqual({
        type: "code-block",
        language: "ts",
        code: "const x = 1;",
      });
    });

    it("should extract indented code block", () => {
      const slide = convertTokensToSlide(tokensFor("    indented code"));
      expect(slide.content).toHaveLength(1);
      expect(slide.content[0]).toEqual({
        type: "code-block",
        code: "indented code",
      });
    });
  });

  describe("directives", () => {
    it("should extract local directive from HTML comment", () => {
      const slide = convertTokensToSlide(
        tokensFor("<!-- layout: Title Slide -->"),
      );
      expect(slide.directives).toHaveLength(1);
      expect(slide.directives[0]).toEqual({
        key: "layout",
        value: "Title Slide",
        scope: "local",
      });
    });

    it("should extract spot directive", () => {
      const slide = convertTokensToSlide(
        tokensFor("<!-- _layout: Section -->"),
      );
      expect(slide.directives).toHaveLength(1);
      expect(slide.directives[0]).toEqual({
        key: "layout",
        value: "Section",
        scope: "spot",
      });
    });
  });

  describe("presenter notes", () => {
    it("should extract non-directive comment as presenter note", () => {
      const slide = convertTokensToSlide(
        tokensFor("<!-- Remember to explain this -->"),
      );
      expect(slide.notes).toHaveLength(1);
      expect(slide.notes[0]).toBe("Remember to explain this");
    });

    it("should separate directives and notes", () => {
      const input =
        "<!-- layout: Title -->\n\n# Title\n\n<!-- This is a note -->";
      const slide = convertTokensToSlide(tokensFor(input));
      expect(slide.directives).toHaveLength(1);
      expect(slide.notes).toHaveLength(1);
      expect(slide.notes[0]).toBe("This is a note");
    });
  });

  describe("tables", () => {
    it("should extract a simple table", () => {
      const input = "| A | B |\n|---|---|\n| 1 | 2 |";
      const slide = convertTokensToSlide(tokensFor(input));
      expect(slide.content).toHaveLength(1);
      expect(slide.content[0]).toEqual({
        type: "table",
        rows: [
          {
            cells: [
              { runs: [{ text: "A" }], isHeader: true },
              { runs: [{ text: "B" }], isHeader: true },
            ],
          },
          {
            cells: [
              { runs: [{ text: "1" }], isHeader: false },
              { runs: [{ text: "2" }], isHeader: false },
            ],
          },
        ],
      });
    });

    it("should handle table with multiple body rows", () => {
      const input =
        "| 項目 | 値 |\n|------|-----|\n| A | 100 |\n| B | 200 |\n| C | 300 |";
      const slide = convertTokensToSlide(tokensFor(input));
      expect(slide.content).toHaveLength(1);
      if (slide.content[0].type === "table") {
        expect(slide.content[0].rows).toHaveLength(4); // 1 header + 3 body
        expect(slide.content[0].rows[0].cells[0].isHeader).toBe(true);
        expect(slide.content[0].rows[1].cells[0].isHeader).toBe(false);
      }
    });

    it("should handle table with inline formatting in cells", () => {
      const input = "| Header |\n|--------|\n| **bold** text |";
      const slide = convertTokensToSlide(tokensFor(input));
      if (slide.content[0].type === "table") {
        const bodyCell = slide.content[0].rows[1].cells[0];
        expect(bodyCell.runs).toEqual([
          { text: "bold", bold: true },
          { text: " text" },
        ]);
      }
    });

    it("should handle table with other content", () => {
      const input = "## Title\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nSome text";
      const slide = convertTokensToSlide(tokensFor(input));
      expect(slide.content).toHaveLength(3);
      expect(slide.content[0].type).toBe("heading");
      expect(slide.content[1].type).toBe("table");
      expect(slide.content[2].type).toBe("paragraph");
    });
  });

  describe("mixed content", () => {
    it("should handle heading + paragraph + list", () => {
      const input = "## Title\n\nSome text\n\n- Item 1\n- Item 2";
      const slide = convertTokensToSlide(tokensFor(input));

      expect(slide.content).toHaveLength(3);
      expect(slide.content[0].type).toBe("heading");
      expect(slide.content[1].type).toBe("paragraph");
      expect(slide.content[2].type).toBe("list");
    });
  });
});
