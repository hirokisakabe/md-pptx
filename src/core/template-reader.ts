import { Presentation } from "python-pptx-wasm";
import type { PlaceholderInfo, LayoutInfo, TemplateInfo } from "./types.js";
import { toPlaceholderType } from "./placeholder-utils.js";

export function readTemplate(data?: Uint8Array): TemplateInfo {
  const prs = data ? Presentation(data) : Presentation();

  try {
    const layouts: LayoutInfo[] = [];
    const slideLayouts = prs.slide_layouts;

    for (let i = 0; i < slideLayouts.length; i++) {
      const layout = slideLayouts.getItem(i);
      const placeholders: PlaceholderInfo[] = [];
      // layout.placeholders は LayoutPlaceholders であり、getItem() もイテレータも
      // 位置インデックスではなくプレースホルダー idx で検索するため、
      // 連番でない idx を持つテンプレートで KeyError になる。
      // layout.shapes は LayoutShapes であり、位置ベースの getItem() を持つため安全に走査できる。
      const shapes = layout.shapes;

      for (let j = 0; j < shapes.length; j++) {
        const ph = shapes.getItem(j) as Record<string, unknown>;
        const fmt = ph.placeholder_format as
          | { idx?: number; type?: number }
          | undefined;

        if (fmt && fmt.idx != null) {
          placeholders.push({
            idx: fmt.idx,
            type: toPlaceholderType(fmt.type ?? -1),
            name: typeof ph.name === "string" ? ph.name : "",
          });
        }
      }

      layouts.push({
        name: layout.name ?? "",
        placeholders,
      });
    }

    return { layouts };
  } finally {
    prs.end();
  }
}
