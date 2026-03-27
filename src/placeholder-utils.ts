import type { PlaceholderType, LayoutInfo, TemplateInfo } from "./types.js";

/**
 * python-pptx の PP_PLACEHOLDER_TYPE 数値を PlaceholderType 文字列に変換する。
 *
 * 参照: https://python-pptx.readthedocs.io/en/latest/api/enum/PpPlaceholderType.html
 *   1 = CENTER_TITLE, 15 = TITLE → "title"
 *   2 = BODY → "body"
 *   3 = SUBTITLE → "subtitle"
 *   18 = PICTURE → "picture"
 */
export function toPlaceholderType(rawType: number): PlaceholderType {
  switch (rawType) {
    case 1: // CENTER_TITLE
    case 15: // TITLE
      return "title";
    case 2: // BODY
      return "body";
    case 3: // SUBTITLE
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
