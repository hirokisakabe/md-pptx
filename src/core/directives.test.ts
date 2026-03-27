import { describe, it, expect } from "vitest";
import { parseDirective, extractCommentContent } from "./directives.js";

describe("parseDirective", () => {
  it("should parse local directive", () => {
    const result = parseDirective("layout: Title Slide");
    expect(result).toEqual({
      key: "layout",
      value: "Title Slide",
      scope: "local",
    });
  });

  it("should parse spot directive with _ prefix", () => {
    const result = parseDirective("_layout: Section Header");
    expect(result).toEqual({
      key: "layout",
      value: "Section Header",
      scope: "spot",
    });
  });

  it("should parse paginate directive", () => {
    const result = parseDirective("paginate: true");
    expect(result).toEqual({
      key: "paginate",
      value: "true",
      scope: "local",
    });
  });

  it("should parse header directive", () => {
    const result = parseDirective("header: My Header");
    expect(result).toEqual({
      key: "header",
      value: "My Header",
      scope: "local",
    });
  });

  it("should parse footer directive", () => {
    const result = parseDirective("_footer: Page Footer");
    expect(result).toEqual({
      key: "footer",
      value: "Page Footer",
      scope: "spot",
    });
  });

  it("should return null for non-directive comment", () => {
    const result = parseDirective("This is a presenter note");
    expect(result).toBeNull();
  });

  it("should return null for unknown key", () => {
    const result = parseDirective("theme: dark");
    expect(result).toBeNull();
  });

  it("should handle whitespace variations", () => {
    const result = parseDirective("  layout:   Two Content  ");
    expect(result).toEqual({
      key: "layout",
      value: "Two Content",
      scope: "local",
    });
  });
});

describe("extractCommentContent", () => {
  it("should extract content from HTML comment", () => {
    expect(extractCommentContent("<!-- layout: Title Slide -->")).toBe(
      "layout: Title Slide",
    );
  });

  it("should handle extra whitespace", () => {
    expect(extractCommentContent("<!--   some note   -->")).toBe("some note");
  });

  it("should return null for non-comment", () => {
    expect(extractCommentContent("not a comment")).toBeNull();
  });

  it("should handle multiline comments", () => {
    expect(extractCommentContent("<!-- line1\nline2 -->")).toBe("line1\nline2");
  });
});
