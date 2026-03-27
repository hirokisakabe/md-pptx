import { describe, it, expect } from "vitest";
import { extractFrontMatter } from "../front-matter.js";

describe("extractFrontMatter", () => {
  it("should parse front matter with all keys", () => {
    const input = `---
template: ./templates/company.pptx
layout: Title Slide
headingDivider: 2
author: Taro
title: My Presentation
---

# Hello`;

    const { frontMatter, body } = extractFrontMatter(input);

    expect(frontMatter.template).toBe("./templates/company.pptx");
    expect(frontMatter.layout).toBe("Title Slide");
    expect(frontMatter.headingDivider).toBe(2);
    expect(frontMatter.author).toBe("Taro");
    expect(frontMatter.title).toBe("My Presentation");
    expect(body).toBe("\n# Hello");
  });

  it("should parse headingDivider as array", () => {
    const input = `---
headingDivider: [1, 2, 3]
---

Content`;

    const { frontMatter } = extractFrontMatter(input);
    expect(frontMatter.headingDivider).toEqual([1, 2, 3]);
  });

  it("should parse headingDivider as single number", () => {
    const input = `---
headingDivider: 3
---

Content`;

    const { frontMatter } = extractFrontMatter(input);
    expect(frontMatter.headingDivider).toBe(3);
  });

  it("should return empty front matter when none exists", () => {
    const input = "# Hello\n\nWorld";
    const { frontMatter, body } = extractFrontMatter(input);

    expect(frontMatter).toEqual({});
    expect(body).toBe(input);
  });

  it("should parse front matter with only template", () => {
    const input = `---
template: ./template.pptx
---

# Slide`;

    const { frontMatter } = extractFrontMatter(input);
    expect(frontMatter.template).toBe("./template.pptx");
    expect(frontMatter.layout).toBeUndefined();
    expect(frontMatter.headingDivider).toBeUndefined();
  });

  it("should ignore unknown keys", () => {
    const input = `---
template: ./t.pptx
unknown: value
---

Body`;

    const { frontMatter } = extractFrontMatter(input);
    expect(frontMatter.template).toBe("./t.pptx");
    expect(frontMatter).not.toHaveProperty("unknown");
  });

  it("should handle empty front matter block", () => {
    const input = `---
---

Body`;

    const { frontMatter, body } = extractFrontMatter(input);
    expect(frontMatter).toEqual({});
    expect(body).toBe("\nBody");
  });

  it("should skip comment lines in YAML", () => {
    const input = `---
# This is a comment
template: ./t.pptx
---

Body`;

    const { frontMatter } = extractFrontMatter(input);
    expect(frontMatter.template).toBe("./t.pptx");
  });

  it("should ignore invalid headingDivider values", () => {
    const input = `---
headingDivider: abc
---

Body`;

    const { frontMatter } = extractFrontMatter(input);
    expect(frontMatter.headingDivider).toBeUndefined();
  });

  it("should filter invalid values in headingDivider array", () => {
    const input = `---
headingDivider: [1, x, 3]
---

Body`;

    const { frontMatter } = extractFrontMatter(input);
    expect(frontMatter.headingDivider).toEqual([1, 3]);
  });

  it("should reject headingDivider outside 1-6 range", () => {
    const input = `---
headingDivider: 0
---

Body`;

    const { frontMatter } = extractFrontMatter(input);
    expect(frontMatter.headingDivider).toBeUndefined();
  });

  it("should reject headingDivider value 7", () => {
    const input = `---
headingDivider: 7
---

Body`;

    const { frontMatter } = extractFrontMatter(input);
    expect(frontMatter.headingDivider).toBeUndefined();
  });
});
