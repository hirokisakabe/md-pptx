# md-pptx

Markdown とテンプレート PPTX から編集可能な PowerPoint ファイルを生成する VS Code 拡張です。

## インストール

VS Code のマーケットプレイスから `md-pptx` を検索してインストールしてください。

## クイックスタート

### 1. テンプレート PPTX を用意する

既存の PowerPoint テンプレートを用意します。テンプレートにどのようなレイアウトが含まれているかは `md-pptx inspect` コマンドで確認できます。

### 2. Markdown を書く

```markdown
---
template: ./template.pptx
title: サンプルプレゼンテーション
author: 山田太郎
---

<!-- _layout: Title Slide -->

# サンプルプレゼンテーション

株式会社サンプル

---

## アジェンダ

- 背景と目的
- 主要施策
- 今後の展望
```

### 3. プレビュー / ビルド

- **md-pptx: Preview** — コマンドパレットから実行すると、エディタ上でリアルタイムプレビューが表示されます（テンプレートの背景画像も表示）
- **md-pptx: Build PPTX** — コマンドパレットから実行すると、PPTX ファイルが生成されます

## Markdown 記法

| 記法                     | 説明                                             |
| ------------------------ | ------------------------------------------------ |
| `---`                    | スライド区切り                                   |
| `headingDivider`         | 見出しレベルで自動スライド分割（フロントマター） |
| `<!-- layout: Name -->`  | レイアウト指定（以降のスライドに適用）           |
| `<!-- _layout: Name -->` | レイアウト指定（そのスライドのみ）               |
| `# 見出し`               | title プレースホルダにマッピング                 |
| 本文テキスト             | body プレースホルダにマッピング                  |
| `![](image.png)`         | picture プレースホルダにマッピング               |
| `<!-- コメント -->`      | プレゼンターノート（ディレクティブ以外）         |

詳細は [Markdown 記法仕様](docs/markdown-syntax.md) を参照してください。

## CLI

補助的に CLI も利用できます。

### `md-pptx build <markdown>`

Markdown ファイルから PPTX を生成します。

```bash
npx md-pptx build slides.md
npx md-pptx build slides.md -t template.pptx
npx md-pptx build slides.md -o output.pptx
```

| オプション              | 説明                                                   |
| ----------------------- | ------------------------------------------------------ |
| `-t, --template <path>` | テンプレート PPTX のパス（フロントマターでも指定可）   |
| `-o, --output <path>`   | 出力先パス（デフォルト: 入力ファイルと同名の `.pptx`） |

### `md-pptx inspect <template>`

テンプレート PPTX のレイアウトとプレースホルダ情報を表示します。

```bash
npx md-pptx inspect template.pptx
```

## 開発

```bash
npm install
npm run build
npm test
npm run typecheck
npm run lint
npm run format:check
```

## ライセンス

MIT
