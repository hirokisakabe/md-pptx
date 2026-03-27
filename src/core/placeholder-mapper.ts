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

interface ContentProfile {
  hasHeading: boolean;
  hasBody: boolean;
  hasImage: boolean;
}

function analyzeContent(content: ContentElement[]): ContentProfile {
  let hasHeading = false;
  let hasBody = false;
  let hasImage = false;

  for (const element of content) {
    if (
      element.type === "heading" &&
      (element.level === 1 || element.level === 2)
    ) {
      hasHeading = true;
    } else if (element.type === "image") {
      hasImage = true;
    } else {
      hasBody = true;
    }
  }

  return { hasHeading, hasBody, hasImage };
}

function layoutHasPlaceholder(
  layout: LayoutInfo,
  type: PlaceholderType,
): boolean {
  return layout.placeholders.some((p) => p.type === type);
}

export function selectDefaultLayout(
  slide: SlideData,
  templateInfo: TemplateInfo,
): LayoutInfo {
  const profile = analyzeContent(slide.content);
  const blankLayout =
    findLayout(templateInfo, "Blank") ??
    ({ name: "Blank", placeholders: [] } as LayoutInfo);

  if (!profile.hasHeading && !profile.hasImage) {
    return blankLayout;
  }

  if (profile.hasHeading && (profile.hasBody || profile.hasImage)) {
    // 見出し + 本文/画像: "Title and Content" を優先
    const byName = findLayout(templateInfo, "Title and Content");
    if (byName) return byName;

    // 名前で見つからない場合、title + body を持つレイアウトを探す
    const byPlaceholder = templateInfo.layouts.find(
      (l) =>
        layoutHasPlaceholder(l, "title") && layoutHasPlaceholder(l, "body"),
    );
    if (byPlaceholder) return byPlaceholder;
  }

  if (profile.hasHeading && !profile.hasBody && !profile.hasImage) {
    // 見出しのみ: "Section Header" → "Title Slide" の順
    const sectionHeader = findLayout(templateInfo, "Section Header");
    if (sectionHeader) return sectionHeader;

    const titleSlide = findLayout(templateInfo, "Title Slide");
    if (titleSlide) return titleSlide;

    // 名前で見つからない場合、title を持つレイアウトを探す
    const byPlaceholder = templateInfo.layouts.find((l) =>
      layoutHasPlaceholder(l, "title"),
    );
    if (byPlaceholder) return byPlaceholder;
  }

  return blankLayout;
}

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
      } else if (subtitlePh && titlePh && titleAssigned) {
        subtitleContent.push(element);
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

    if (!layoutName) {
      const defaultLayout = selectDefaultLayout(slide, templateInfo);
      return mapSlideToPlaceholders(slide, defaultLayout);
    }

    const layout = findLayout(templateInfo, layoutName);
    if (!layout) {
      const blankLayout = findLayout(templateInfo, "Blank") ?? BLANK_LAYOUT;
      return mapSlideToPlaceholders(slide, blankLayout);
    }

    return mapSlideToPlaceholders(slide, layout);
  });
}
