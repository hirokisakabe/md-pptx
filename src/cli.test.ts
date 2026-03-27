import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  writeFileSync,
  readFileSync,
  mkdtempSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("./core/parser.js", () => ({
  parseMarkdown: vi.fn(() => ({
    frontMatter: {},
    slides: [{ layout: undefined, content: [], notes: [], directives: [] }],
  })),
}));

vi.mock("./core/template-reader.js", () => ({
  readTemplate: vi.fn(() => ({
    layouts: [
      {
        name: "Title Slide",
        placeholders: [
          { idx: 0, type: "title", name: "Title 1" },
          { idx: 1, type: "subtitle", name: "Subtitle 2" },
        ],
      },
      { name: "Blank", placeholders: [] },
    ],
  })),
}));

vi.mock("./core/placeholder-mapper.js", () => ({
  mapPresentation: vi.fn(() => [
    {
      layoutName: "Blank",
      assignments: [],
      fallbackToBlank: true,
      unmappedContent: [],
    },
  ]),
}));

vi.mock("./core/pptx-generator.js", () => ({
  generatePptx: vi.fn(() => new Uint8Array([0x50, 0x4b, 0x03, 0x04])),
}));

import { parseMarkdown } from "./core/parser.js";
import { readTemplate } from "./core/template-reader.js";
import { mapPresentation } from "./core/placeholder-mapper.js";
import { generatePptx } from "./core/pptx-generator.js";
import { buildAction, inspectAction, createProgram } from "./cli.js";

describe("CLI", () => {
  describe("createProgram", () => {
    it("プログラム名とバージョンが設定されている", () => {
      const program = createProgram();
      expect(program.name()).toBe("md-pptx");
      expect(program.version()).toBe("0.0.0");
    });

    it("build と inspect サブコマンドが登録されている", () => {
      const program = createProgram();
      const commandNames = program.commands.map((c) => c.name());
      expect(commandNames).toContain("build");
      expect(commandNames).toContain("inspect");
    });

    it("build サブコマンドが引数経由で実行される", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "md-pptx-test-"));
      const mdPath = join(tmpDir, "test.md");
      writeFileSync(mdPath, "# Hello");

      vi.clearAllMocks();
      const program = createProgram();
      program.parse(["node", "md-pptx", "build", mdPath]);

      expect(parseMarkdown).toHaveBeenCalled();
      expect(existsSync(join(tmpDir, "test.pptx"))).toBe(true);

      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("inspect サブコマンドが引数経由で実行される", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "md-pptx-test-"));
      const templatePath = join(tmpDir, "template.pptx");
      writeFileSync(templatePath, "fake-pptx-data");

      vi.clearAllMocks();
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const program = createProgram();
      program.parse(["node", "md-pptx", "inspect", templatePath]);

      expect(readTemplate).toHaveBeenCalledWith(expect.any(Uint8Array));
      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("レイアウト数: 2");

      consoleSpy.mockRestore();
      rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe("buildAction", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), "md-pptx-test-"));
      vi.clearAllMocks();
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("Markdown をパースして PPTX を出力する", () => {
      const mdPath = join(tmpDir, "test.md");
      writeFileSync(mdPath, "# Hello\n\nWorld");

      buildAction(mdPath, {});

      expect(parseMarkdown).toHaveBeenCalledWith("# Hello\n\nWorld");
      expect(readTemplate).toHaveBeenCalledWith(undefined);
      expect(mapPresentation).toHaveBeenCalled();
      expect(generatePptx).toHaveBeenCalled();

      const outputPath = join(tmpDir, "test.pptx");
      expect(existsSync(outputPath)).toBe(true);
      const outputData = readFileSync(outputPath);
      expect(outputData[0]).toBe(0x50);
      expect(outputData[1]).toBe(0x4b);
    });

    it("--output オプションで出力先を指定できる", () => {
      const mdPath = join(tmpDir, "test.md");
      const outputPath = join(tmpDir, "custom-output.pptx");
      writeFileSync(mdPath, "# Test");

      buildAction(mdPath, { output: outputPath });

      expect(existsSync(outputPath)).toBe(true);
    });

    it("--template オプションでテンプレートを指定できる", () => {
      const mdPath = join(tmpDir, "test.md");
      const templatePath = join(tmpDir, "template.pptx");
      writeFileSync(mdPath, "# Test");
      writeFileSync(templatePath, "fake-pptx-data");

      buildAction(mdPath, { template: templatePath });

      expect(readTemplate).toHaveBeenCalledWith(expect.any(Uint8Array));
    });

    it("frontmatter の template パスを使用する", () => {
      const mdPath = join(tmpDir, "test.md");
      const templatePath = join(tmpDir, "tmpl.pptx");
      writeFileSync(mdPath, "---\ntemplate: tmpl.pptx\n---\n# Test");
      writeFileSync(templatePath, "fake-pptx-data");

      vi.mocked(parseMarkdown).mockReturnValueOnce({
        frontMatter: { template: "tmpl.pptx" },
        slides: [{ layout: undefined, content: [], notes: [], directives: [] }],
      });

      buildAction(mdPath, {});

      expect(readTemplate).toHaveBeenCalledWith(expect.any(Uint8Array));
    });

    it("存在しない Markdown ファイルでエラーを投げる", () => {
      expect(() => {
        buildAction(join(tmpDir, "nonexistent.md"), {});
      }).toThrow();
    });
  });

  describe("inspectAction", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), "md-pptx-test-"));
      vi.clearAllMocks();
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("テンプレートのレイアウト情報を表示する", () => {
      const templatePath = join(tmpDir, "template.pptx");
      writeFileSync(templatePath, "fake-pptx-data");

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      inspectAction(templatePath);

      expect(readTemplate).toHaveBeenCalledWith(expect.any(Uint8Array));

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("レイアウト数: 2");
      expect(output).toContain("[Title Slide]");
      expect(output).toContain("idx: 0, type: title, name: Title 1");
      expect(output).toContain("[Blank]");
      expect(output).toContain("(プレースホルダなし)");

      consoleSpy.mockRestore();
    });

    it("存在しないテンプレートファイルでエラーを投げる", () => {
      expect(() => {
        inspectAction(join(tmpDir, "nonexistent.pptx"));
      }).toThrow();
    });
  });
});
