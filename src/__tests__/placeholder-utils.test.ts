import { describe, expect, it } from "vitest";
import { toPlaceholderType, findLayout } from "../placeholder-utils.js";
import type { TemplateInfo } from "../types.js";

describe("toPlaceholderType", () => {
  it("CENTER_TITLE (1) を title に変換する", () => {
    expect(toPlaceholderType(1)).toBe("title");
  });

  it("TITLE (15) を title に変換する", () => {
    expect(toPlaceholderType(15)).toBe("title");
  });

  it("BODY (2) を body に変換する", () => {
    expect(toPlaceholderType(2)).toBe("body");
  });

  it("SUBTITLE (3) を subtitle に変換する", () => {
    expect(toPlaceholderType(3)).toBe("subtitle");
  });

  it("PICTURE (18) を picture に変換する", () => {
    expect(toPlaceholderType(18)).toBe("picture");
  });

  it("未知の数値を other に変換する", () => {
    expect(toPlaceholderType(0)).toBe("other");
    expect(toPlaceholderType(99)).toBe("other");
    expect(toPlaceholderType(-1)).toBe("other");
  });
});

describe("findLayout", () => {
  const templateInfo: TemplateInfo = {
    layouts: [
      { name: "Title Slide", placeholders: [] },
      { name: "Title and Content", placeholders: [] },
      { name: "Blank", placeholders: [] },
    ],
  };

  it("名前でレイアウトを検索できる", () => {
    const result = findLayout(templateInfo, "Title Slide");
    expect(result).toBeDefined();
    expect(result!.name).toBe("Title Slide");
  });

  it("存在しないレイアウト名で undefined を返す", () => {
    const result = findLayout(templateInfo, "Non Existent");
    expect(result).toBeUndefined();
  });
});
