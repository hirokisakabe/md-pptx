export { parseMarkdown } from "./core/parser.js";
export { readTemplate } from "./core/template-reader.js";
export { findLayout, toPlaceholderType } from "./core/placeholder-utils.js";
export {
  mapSlideToPlaceholders,
  mapPresentation,
} from "./core/placeholder-mapper.js";
export { generatePptx } from "./core/pptx-generator.js";
export type { GenerateOptions } from "./core/pptx-generator.js";
export { createOrderedListHelper } from "./core/ordered-list-xml.js";
export { extractBackgrounds } from "./core/slide-master-extractor.js";
export type {
  ParseResult,
  FrontMatter,
  SlideData,
  ContentElement,
  HeadingElement,
  ParagraphElement,
  ListElement,
  ImageElement,
  ListItem,
  TextRun,
  ImageData,
  Directive,
  DirectiveScope,
  PlaceholderType,
  PlaceholderInfo,
  LayoutInfo,
  TemplateInfo,
  PlaceholderAssignment,
  SlideMappingResult,
  SlideMasterBackground,
  SlideLayoutBackground,
  BackgroundExtractionResult,
} from "./core/types.js";
