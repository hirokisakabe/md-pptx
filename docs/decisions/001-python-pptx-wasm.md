# python-pptx-wasm の採用

## ステータス

採用済み

## コンテキスト

Markdown とテンプレート PPTX から編集可能な PowerPoint ファイルを生成するにあたり、PPTX の読み書きを行うライブラリの選定が必要だった。候補として以下を検討した：

- **pptxgenjs**: JavaScript ネイティブの PPTX 生成ライブラリ
- **OOXML 自前実装**: Office Open XML を直接操作
- **python-pptx-wasm**: python-pptx の WASM ラッパー（Pyodide 上で動作）

## 決定

python-pptx-wasm を採用した。

## 理由

- **テンプレート読み込みのサポート**: pptxgenjs は既存 PPTX のテンプレート読み込みが未サポートであり、本プロジェクトの中核要件を満たせない
- **JS/TS プロジェクトとしての統一**: python-pptx の WASM ラッパーにより、JS/TS プロジェクトとして統一できる。JS ↔ Python のデータ受け渡し設計が不要（ライブラリが吸収）
- **実装リスクの低減**: OOXML を自前で扱う必要がなくなり、実装リスクが大幅に下がる。テンプレート PPTX の読み込み・スライドマスター活用は python-pptx の得意領域
- **Uint8Array ベースのインターフェース**: Node.js / ブラウザ両対応が容易

## リスク

- python-pptx-wasm は v0.0.1 で若いプロジェクトであり、機能カバレッジに制限がある（"part components are not implemented" と明記）。不足があれば PR で貢献またはフォークで対応する方針
- Pyodide の初回ロード時間（ランタイム ~10MB + python-pptx 関連）により、VS Code 拡張の初回起動に数秒〜十数秒かかる
- メンテナンス継続性が不透明。必要に応じてフォークや貢献で対応する
