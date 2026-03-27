import type { PlaceholderType, LayoutInfo, TemplateInfo } from "./types.js";

/**
 * python-pptx の PP_PLACEHOLDER_TYPE 数値を PlaceholderType 文字列に変換する。
 *
 * python-pptx-wasm (pyodide) が返す実際の enum 値:
 *   1 = TITLE, 3 = CENTER_TITLE → "title"
 *   2 = BODY → "body"
 *   4 = SUBTITLE → "subtitle"
 *   18 = PICTURE → "picture"
 */
export function toPlaceholderType(rawType: number): PlaceholderType {
  switch (rawType) {
    case 1: // TITLE
    case 3: // CENTER_TITLE
      return "title";
    case 2: // BODY
    case 7: // OBJECT (Content Placeholder)
      return "body";
    case 4: // SUBTITLE
      return "subtitle";
    case 18: // PICTURE
      return "picture";
    default:
      return "other";
  }
}

export function findLayout(
  templateInfo: TemplateInfo,
  name: string,
): LayoutInfo | undefined {
  return templateInfo.layouts.find((l) => l.name === name);
}
