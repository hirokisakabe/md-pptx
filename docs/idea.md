# プロジェクト構想: Marp風Markdown → テンプレートPPTX出力ツール

## 概要

Marp風のMarkdown記法で、自社テンプレートPPTXのスライドマスターを活かした**編集可能なPPTX**を出力するツール。

非エンジニアでも使える体験を目指す。AI (Claude Code) との連携でレイアウト調整も可能にする。

## 処理パイプライン

```
[入力]
  Marp風 Markdown + テンプレート PPTX

[プレビュー (VS Code Webview) - リアルタイム]
  Markdown → AST → 独自の軽量レンダラ → SVG/HTML → Webview
  + テンプレートの背景画像を合成
  ※ PPTX 生成は行わない（速度優先）

[PPTX 出力 (明示的なコマンド実行時)]
  Markdown → markdown-it でパース → トークン列 / AST
  → python-pptx-wasm でテンプレート PPTX を開いてコンテンツ注入
  → 編集可能な PPTX 出力
```

### PPTX出力の詳細フロー

1. markdown-it で Markdown → トークン列 (JS/TS)
2. python-pptx-wasm で:
   - テンプレート PPTX を Uint8Array として読み込み
   - スライドレイアウトを選択
   - プレースホルダにテキスト/画像を注入
   - PPTX を Uint8Array で返却
3. ファイル保存

### プレースホルダのマッピング

Markdown の構造を PPTX プレースホルダの type/idx で機械的にマッピングする:

| Markdown | プレースホルダ |
|---|---|
| `# 見出し` | type=title (idx=0) |
| 本文テキスト | type=body or obj (idx=1) |
| `![](img)` | type=pic があれば使用、なければ obj 内に配置 |

- プレースホルダが足りない・存在しない場合は Blank レイアウトに自前で配置にフォールバック
- 標準の11レイアウトの type/idx を前提とすれば、多くのテンプレートでそのまま動く

## 依存ライブラリ

| ライブラリ | 用途 |
|---|---|
| **markdown-it** | Markdown パース |
| **[python-pptx-wasm](https://github.com/yikenman/python-pptx-wasm)** | python-pptx の WASM ラッパー。テンプレート PPTX の読み書き・コンテンツ注入 |
| **pyodide** | Python WASM ランタイム（python-pptx-wasm が内部で使用） |
| **JSZip** | スライドマスター背景画像の抽出（プレビュー用） |

### python-pptx-wasm について

- Pyodide 上で python-pptx を動かし、TypeScript の API で呼び出せるようにラップしたライブラリ
- JS/TS だけで完結し、Python コードを自前で書く必要がない
- Uint8Array でファイルをやり取り（Node.js / ブラウザ両対応）
- v0.0.1 で若いため、テンプレート読み込み + プレースホルダアクセスが動作するか早期に検証が必要

## 設計判断

### レイアウトの2層構造

- **PPTX テンプレート**: ベースレイアウト（背景、ロゴ、フォント、基本配置）
- **CSS (Phase 2)**: コンテンツのレイアウト調整（カラム、配置、間隔等）。AI が動的に変更可能

CSS を書かなければテンプレートのレイアウトがそのまま使われる。AI に頼めば CSS で調整してくれる。

### python-pptx-wasm の採用

- python-pptx の WASM ラッパーにより、JS/TS プロジェクトとして統一できる
- JS ↔ Python のデータ受け渡し設計が不要（ライブラリが吸収）
- テンプレート PPTX の読み込み・スライドマスター活用は python-pptx の得意領域
- pptxgenjs は既存 PPTX のテンプレート読み込みが未サポート
- OOXML を自前で扱う必要がなくなり、実装リスクが大幅に下がる

### プレビューにスライドマスター背景画像を合成

- テンプレート PPTX からスライドマスターの背景画像を抽出し、Webview の背景に敷く
- テンプレートのプレースホルダ位置を初回に読み取り、その座標に合わせて描画
- 完全一致はしないが、実用上十分な体験を提供

### Marp との差別化

```
[Marp]      Markdown + CSS → HTML/PDF (PPTXはおまけ、画像貼り付け or LibreOffice変換)
[md-pptx]   Markdown + PPTXテンプレート → 編集可能PPTX (python-pptx-wasmで直接生成)
```

Marp が「wontfix」にしたネイティブ PowerPoint 出力を、python-pptx-wasm で実現する。

## フェーズ分割

### Phase 1: テンプレート + プレースホルダ流し込み

- python-pptx-wasm でテンプレート PPTX のプレースホルダにコンテンツを注入
- 軽量プレビュー（テンプレート背景 + コンテンツ描画）
- CLI + VS Code 拡張
- `md-pptx inspect template.pptx` でテンプレートのレイアウト・プレースホルダを確認するコマンド

### Phase 2: CSS によるレイアウト上書き

- CSS でスライドごとのレイアウトを調整可能に
- AI (Claude Code) が CSS を編集してレイアウト変更
- ブラウザ (Puppeteer / Webview) で CSS レイアウト結果の座標を取得 → python-pptx-wasm で配置

## 課題

### 高リスク

- **python-pptx-wasm の機能カバレッジ**: v0.0.1 で "part components are not implemented" と明記。テンプレート読み込み・プレースホルダアクセスが動作するか早期検証が必要。不足があれば PR で貢献 or フォークで対応
- **Pyodide の初回ロード時間**: ランタイム ~10MB + python-pptx 関連。VS Code 拡張で初回起動に数秒〜十数秒かかる。プログレス表示やキャッシュで緩和

### 中リスク

- **Markdown 記法設計**: Marp 互換にするか独自にするか。スライド区切り、ディレクティブ、画像配置等
- **スライドマスター背景の抽出**: 単純な画像背景は JSZip で抽出可能。図形・グラデーション構成の場合はラスタライズが必要

### 低リスク

- **python-pptx-wasm のメンテナンス継続性**: star 1 の若いプロジェクト。必要に応じてフォークや貢献で対応

## 構成

単一の VS Code 拡張パッケージとして開発する。コアロジックの分離は必要に応じて後から行う。

- **コアライブラリ**: Markdown + テンプレート → PPTX 変換ロジック
- **VS Code 拡張**: コアライブラリ + プレビュー UI

1. **コアライブラリ** (npm パッケージ)
2. **CLI**
3. **VS Code 拡張** (ライブプレビュー)
4. **Web アプリ** (将来的に)
