export { parseMarkdown } from "./parser.js";
export { readTemplate } from "./template-reader.js";
export { findLayout, toPlaceholderType } from "./placeholder-utils.js";
export {
  mapSlideToPlaceholders,
  mapPresentation,
} from "./placeholder-mapper.js";
export { generatePptx } from "./pptx-generator.js";
export type { GenerateOptions } from "./pptx-generator.js";
export { extractBackgrounds } from "./slide-master-extractor.js";
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
} from "./types.js";
