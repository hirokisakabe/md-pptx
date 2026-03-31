# md-pptx

[![Version](https://vsmarketplacebadges.dev/version/hirokisakabe.md-pptx.png)](https://marketplace.visualstudio.com/items?itemName=hirokisakabe.md-pptx)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.png)](https://opensource.org/licenses/MIT)

Markdown から編集可能な PowerPoint ファイルを生成する VS Code 拡張です。

## 特徴

- **Markdown → PPTX 変換** : Markdown でスライドを記述し、編集可能な PowerPoint ファイルとして出力
- **リアルタイムプレビュー** : VS Code エディタ上でスライドの見た目を即座に確認
- **テンプレート対応** : 既存の PowerPoint テンプレートを指定して、デザインやレイアウトを活用
- **レイアウト制御** : ディレクティブでスライドごとにレイアウトを柔軟に指定

## インストール

[Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=hirokisakabe.md-pptx) からインストールできます。

## クイックスタート

### 1. Markdown を書く

```markdown
---
title: サンプルプレゼンテーション
author: 山田太郎
---

# サンプルプレゼンテーション

株式会社サンプル

---

## アジェンダ

- 背景と目的
- 主要施策
- 今後の展望
```

### 2. プレビュー / ビルド

- **md-pptx: Preview** — コマンドパレットから実行すると、エディタ上でリアルタイムプレビューが表示されます
- **md-pptx: Build PPTX** — コマンドパレットから実行すると、PPTX ファイルが生成されます

### 3. テンプレートを使ってカスタマイズする（オプション）

既存の PowerPoint テンプレートを指定すると、そのデザインやレイアウトを活用できます。

```markdown
---
template: ./template.pptx
title: サンプルプレゼンテーション
---

<!-- _layout: Title Slide -->

# サンプルプレゼンテーション
```

テンプレートはフロントマターの `template` フィールドで指定します。省略時は空のプレゼンテーションが生成されます。

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

詳細は [Markdown 記法仕様](docs/guide/syntax.md) を参照してください。

## ライセンス

MIT
