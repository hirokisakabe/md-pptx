import { describe, it, expect } from "vitest";
import { parseMarkdown } from "./index.js";

describe("md-pptx", () => {
  it("should export parseMarkdown", () => {
    expect(parseMarkdown).toBeDefined();
    expect(typeof parseMarkdown).toBe("function");
  });

  it("should parse markdown and return result", () => {
    const result = parseMarkdown("# Hello");
    expect(result.frontMatter).toBeDefined();
    expect(result.slides).toBeDefined();
    expect(result.slides).toHaveLength(1);
  });
});
