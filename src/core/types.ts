// === Front Matter ===

export interface FrontMatter {
  template?: string;
  layout?: string;
  headingDivider?: number | number[];
  author?: string;
  title?: string;
}

// === Directives ===

export type DirectiveScope = "local" | "spot";

export interface Directive {
  key: string;
  value: string;
  scope: DirectiveScope;
}

// === Text Formatting ===

export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strikethrough?: boolean;
  link?: string;
}

// === Image ===

export interface ImageData {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
}

// === Content Elements ===

export interface HeadingElement {
  type: "heading";
  level: 1 | 2 | 3 | 4 | 5 | 6;
  runs: TextRun[];
}

export interface ParagraphElement {
  type: "paragraph";
  runs: TextRun[];
}

export interface ListItem {
  runs: TextRun[];
  level: number;
  ordered: boolean;
}

export interface ListElement {
  type: "list";
  items: ListItem[];
}

export interface ImageElement {
  type: "image";
  image: ImageData;
}

export type ContentElement =
  | HeadingElement
  | ParagraphElement
  | ListElement
  | ImageElement;

// === Slide ===

export interface SlideData {
  layout?: string;
  content: ContentElement[];
  notes: string[];
  directives: Directive[];
}

// === Parse Result ===

export interface ParseResult {
  frontMatter: FrontMatter;
  slides: SlideData[];
}

// === Template / Placeholder ===

export type PlaceholderType =
  | "title"
  | "body"
  | "picture"
  | "subtitle"
  | "other";

export interface PlaceholderInfo {
  idx: number;
  type: PlaceholderType;
  name: string;
}

export interface LayoutInfo {
  name: string;
  placeholders: PlaceholderInfo[];
}

export interface TemplateInfo {
  layouts: LayoutInfo[];
}

// === Slide Master Background ===

export interface SlideMasterBackground {
  /** スライドマスター名 */
  masterName: string;
  /** 背景画像のMIMEタイプ (e.g. "image/png", "image/jpeg") */
  contentType: string;
  /** 背景画像のバイナリデータ */
  data: Uint8Array;
  /** Data URL (Webview表示用) */
  dataUrl: string;
}

export interface SlideLayoutBackground {
  /** スライドレイアウト名 */
  layoutName: string;
  /** 背景画像のMIMEタイプ */
  contentType: string;
  /** 背景画像のバイナリデータ */
  data: Uint8Array;
  /** Data URL (Webview表示用) */
  dataUrl: string;
}

export interface BackgroundExtractionResult {
  /** スライドマスターの背景画像一覧 */
  masters: SlideMasterBackground[];
  /** スライドレイアウトの背景画像一覧（レイアウト固有の背景を持つもののみ） */
  layouts: SlideLayoutBackground[];
}

// === Placeholder Mapping ===

export interface PlaceholderAssignment {
  placeholderIdx: number;
  placeholderType: PlaceholderType;
  content: ContentElement[];
}

export interface SlideMappingResult {
  layoutName: string;
  assignments: PlaceholderAssignment[];
  fallbackToBlank: boolean;
  unmappedContent: ContentElement[];
}
