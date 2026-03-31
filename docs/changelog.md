# md-pptx

## 0.6.2

### Patch Changes

- 46cc421: loadPyodide に stdout/stderr コールバックを設定し、バイナリデータが VS Code の JSON-RPC ストリームに漏出するのを防止

## 0.6.1

### Patch Changes

- f17d862: - fix: 画像（`![alt](path)`）をテキストではなく画像シェイプとしてレンダリング
  - fix: 取り消し線（~~text~~）をPPTX出力で正しくレンダリング
  - fix: テキストと特殊要素が混在するスライドの配置ギャップを修正
  - fix: テキスト高さ推定値を調整してコードブロックの重なりを解消

## 0.6.0

### Minor Changes

- cf3f45b: Markdown テーブル記法を PPTX テーブルに変換する機能を追加

### Patch Changes

- 9ff67e9: 本文のみ（見出しなし）のスライドで body プレースホルダを持つレイアウトを優先選択するよう修正
- 62f16ab: fix: 番号付きリスト（ordered list）が箇条書きではなく番号付きでレンダリングされるように修正
- 953e0d7: プレースホルダー idx が連番でないテンプレートで KeyError が発生する問題を修正
- b1f7aaa: テンプレートPPTXに既存スライドが2枚以上あるとIndexErrorが発生する問題を修正
- f79d9f6: テンプレートPPTXの既存スライドが出力に残る問題を修正
- bdf5491: pptx-glimpse 0.7.1 で Carlito CJK 問題が解決されたため、フォントバンドルとフォントマッピングのワークアラウンドを削除

## 0.5.2

### Patch Changes

- b481f55: pptx-glimpse を esbuild の external から外してバンドルに含める

## 0.5.1

### Patch Changes

- 5555182: fix: .vscodeignore に fast-xml-builder と path-expression-matcher を追加

## 0.5.0

### Minor Changes

- f67a2c0: Markdown のコードブロック（fenced code block）を PPTX 上で等幅フォント表示する機能を追加
- e451a2b: プレビューを pptx-glimpse ベースの SVG レンダリングに変更

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
