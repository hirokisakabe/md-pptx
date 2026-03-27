import MarkdownIt from "markdown-it";
import type { ParseResult, SlideData, FrontMatter } from "./types.js";
import { extractFrontMatter } from "./front-matter.js";
import { splitTokensIntoSlides } from "./slide-splitter.js";
import { convertTokensToSlide } from "./token-converter.js";

const md = new MarkdownIt({ html: true });
md.enable("strikethrough");

function resolveDirectives(
  slides: SlideData[],
  frontMatter: FrontMatter,
): void {
  let currentLayout = frontMatter.layout;

  for (const slide of slides) {
    let spotLayout: string | undefined;

    for (const directive of slide.directives) {
      if (directive.key === "layout") {
        if (directive.scope === "local") {
          currentLayout = directive.value;
        } else {
          spotLayout = directive.value;
        }
      }
    }

    slide.layout = spotLayout ?? currentLayout;
  }
}

export function parseMarkdown(input: string): ParseResult {
  const { frontMatter, body } = extractFrontMatter(input);
  const tokens = md.parse(body, {});
  const slideTokenGroups = splitTokensIntoSlides(
    tokens,
    frontMatter.headingDivider,
  );
  const slides = slideTokenGroups.map(convertTokensToSlide);

  resolveDirectives(slides, frontMatter);

  return { frontMatter, slides };
}
