# md-pptx

## 0.4.0

### Minor Changes

- 43460f9: テンプレートなし時のデフォルトスライドサイズを 16:9 に変更
- 7b3f67e: VS Code 拡張: Build PPTX コマンドで出力先ディレクトリを選択可能にした

## 0.3.0

### Minor Changes

- 63d6f94: レイアウト未指定スライドのデフォルトレイアウト選択を改善
  - スライドのコンテンツ構成（見出し・本文・画像）に応じて適切なレイアウトを自動選択するようにした
  - `toPlaceholderType` で rawType=7 (OBJECT/Content Placeholder) を "body" としてマッピングするようにした
  - Title Slide レイアウトで body がない場合、本文テキストを subtitle プレースホルダーに割り当てるようにした

## 0.2.0

### Minor Changes

- 19813ff: Initial release of md-pptx: Markdown から編集可能な PowerPoint ファイルを生成するツール
