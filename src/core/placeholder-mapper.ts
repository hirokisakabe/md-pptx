import type {
  ContentElement,
  LayoutInfo,
  ParseResult,
  PlaceholderAssignment,
  PlaceholderInfo,
  PlaceholderType,
  SlideMappingResult,
  SlideData,
  TemplateInfo,
} from "./types.js";
import { findLayout } from "./placeholder-utils.js";

const BLANK_LAYOUT: LayoutInfo = { name: "Blank", placeholders: [] };

function findPlaceholder(
  layout: LayoutInfo,
  type: PlaceholderType,
): PlaceholderInfo | undefined {
  return layout.placeholders.find((p) => p.type === type);
}

export function mapSlideToPlaceholders(
  slide: SlideData,
  layout: LayoutInfo,
): SlideMappingResult {
  const titlePh = findPlaceholder(layout, "title");
  const subtitlePh = findPlaceholder(layout, "subtitle");
  const bodyPh = findPlaceholder(layout, "body");
  const picturePh = findPlaceholder(layout, "picture");

  const titleContent: ContentElement[] = [];
  const subtitleContent: ContentElement[] = [];
  const bodyContent: ContentElement[] = [];
  const pictureContent: ContentElement[] = [];
  const unmappedContent: ContentElement[] = [];

  let titleAssigned = false;

  for (const element of slide.content) {
    if (
      !titleAssigned &&
      element.type === "heading" &&
      (element.level === 1 || element.level === 2)
    ) {
      titleAssigned = true;
      const targetPh = titlePh ?? subtitlePh;
      if (targetPh) {
        if (targetPh === subtitlePh) {
          subtitleContent.push(element);
        } else {
          titleContent.push(element);
        }
      } else {
        unmappedContent.push(element);
      }
    } else if (element.type === "image") {
      if (picturePh) {
        pictureContent.push(element);
      } else if (bodyPh) {
        bodyContent.push(element);
      } else {
        unmappedContent.push(element);
      }
    } else {
      if (bodyPh) {
        bodyContent.push(element);
      } else {
        unmappedContent.push(element);
      }
    }
  }

  const assignments: PlaceholderAssignment[] = [];

  if (titlePh && titleContent.length > 0) {
    assignments.push({
      placeholderIdx: titlePh.idx,
      placeholderType: titlePh.type,
      content: titleContent,
    });
  }

  if (subtitlePh && subtitleContent.length > 0) {
    assignments.push({
      placeholderIdx: subtitlePh.idx,
      placeholderType: subtitlePh.type,
      content: subtitleContent,
    });
  }

  if (bodyPh && bodyContent.length > 0) {
    assignments.push({
      placeholderIdx: bodyPh.idx,
      placeholderType: bodyPh.type,
      content: bodyContent,
    });
  }

  if (picturePh && pictureContent.length > 0) {
    assignments.push({
      placeholderIdx: picturePh.idx,
      placeholderType: picturePh.type,
      content: pictureContent,
    });
  }

  const fallbackToBlank =
    unmappedContent.length > 0 && assignments.length === 0;

  return {
    layoutName: fallbackToBlank ? "Blank" : layout.name,
    assignments,
    fallbackToBlank,
    unmappedContent,
  };
}

export function mapPresentation(
  parseResult: ParseResult,
  templateInfo: TemplateInfo,
): SlideMappingResult[] {
  return parseResult.slides.map((slide: SlideData) => {
    const layoutName = slide.layout;
    const layout = layoutName
      ? findLayout(templateInfo, layoutName)
      : undefined;

    if (!layout) {
      const blankLayout = findLayout(templateInfo, "Blank") ?? BLANK_LAYOUT;
      return mapSlideToPlaceholders(slide, blankLayout);
    }

    return mapSlideToPlaceholders(slide, layout);
  });
}
