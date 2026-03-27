import { describe, it, expect } from "vitest";
import MarkdownIt from "markdown-it";
import { splitTokensIntoSlides } from "./slide-splitter.js";

const md = new MarkdownIt({ html: true });

describe("splitTokensIntoSlides", () => {
  it("should split on --- (hr tokens)", () => {
    const tokens = md.parse(
      "# Slide 1\n\nBody 1\n\n---\n\n# Slide 2\n\nBody 2",
      {},
    );
    const slides = splitTokensIntoSlides(tokens);

    expect(slides).toHaveLength(2);
    expect(slides[0].some((t) => t.type === "heading_open")).toBe(true);
    expect(slides[1].some((t) => t.type === "heading_open")).toBe(true);
  });

  it("should produce single slide when no delimiter exists", () => {
    const tokens = md.parse("# Title\n\nBody", {});
    const slides = splitTokensIntoSlides(tokens);

    expect(slides).toHaveLength(1);
  });

  it("should handle multiple --- delimiters", () => {
    const tokens = md.parse("Slide 1\n\n---\n\nSlide 2\n\n---\n\nSlide 3", {});
    const slides = splitTokensIntoSlides(tokens);

    expect(slides).toHaveLength(3);
  });

  it("should handle empty slides between delimiters", () => {
    const tokens = md.parse("---\n\n---", {});
    const slides = splitTokensIntoSlides(tokens);

    expect(slides).toHaveLength(3);
  });

  it("should apply headingDivider with single number", () => {
    const tokens = md.parse("## Slide 1\n\nBody 1\n\n## Slide 2\n\nBody 2", {});
    const slides = splitTokensIntoSlides(tokens, 2);

    expect(slides).toHaveLength(2);
  });

  it("should split on heading levels <= headingDivider", () => {
    const tokens = md.parse(
      "# Section\n\n## Slide 1\n\nBody\n\n## Slide 2\n\nBody",
      {},
    );
    const slides = splitTokensIntoSlides(tokens, 2);

    expect(slides).toHaveLength(3);
  });

  it("should not split on heading levels > headingDivider", () => {
    const tokens = md.parse("### Sub 1\n\nBody\n\n### Sub 2\n\nBody", {});
    const slides = splitTokensIntoSlides(tokens, 2);

    expect(slides).toHaveLength(1);
  });

  it("should apply headingDivider as array", () => {
    const tokens = md.parse("# Section\n\nBody\n\n### Sub\n\nBody", {});
    const slides = splitTokensIntoSlides(tokens, [1, 3]);

    expect(slides).toHaveLength(2);
  });

  it("should combine --- split and headingDivider", () => {
    const tokens = md.parse(
      "## Slide 1\n\nBody\n\n---\n\n## Slide 2\n\nBody\n\n## Slide 3\n\nBody",
      {},
    );
    const slides = splitTokensIntoSlides(tokens, 2);

    expect(slides).toHaveLength(3);
  });
});
