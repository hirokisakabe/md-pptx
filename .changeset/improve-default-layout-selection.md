---
"md-pptx": minor
---

レイアウト未指定スライドのデフォルトレイアウト選択を改善

- スライドのコンテンツ構成（見出し・本文・画像）に応じて適切なレイアウトを自動選択するようにした
- `toPlaceholderType` で rawType=7 (OBJECT/Content Placeholder) を "body" としてマッピングするようにした
- Title Slide レイアウトで body がない場合、本文テキストを subtitle プレースホルダーに割り当てるようにした
