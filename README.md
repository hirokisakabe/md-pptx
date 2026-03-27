# md-pptx

Markdown とテンプレート PPTX から編集可能な PowerPoint ファイルを生成するツールです。

テンプレートのレイアウトやプレースホルダを活かした PPTX を出力します。

## 特徴

- **シンプルな Markdown 記法** — `---` スライド区切り、HTML コメントディレクティブ、画像サイズ指定などをサポート
- **テンプレート PPTX 対応** — 企業テンプレートのレイアウト・デザインをそのまま活用
- **自動プレースホルダマッピング** — 見出し → title、本文 → body、画像 → picture に自動配置
- **VS Code 拡張** — エディタ上でリアルタイムプレビューとビルドが可能

## インストール

```bash
npm install md-pptx
```

## クイックスタート

### 1. Markdown を書く

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

---

## 主要施策

1. 新製品のローンチ
   - 発売3ヶ月で目標の **120%** 達成
2. 海外展開の加速
3. DX推進
```

### 2. PPTX を生成する

```bash
npx md-pptx build slides.md
```

`slides.pptx` が生成されます。

## CLI

### `md-pptx build <markdown>`

Markdown ファイルから PPTX を生成します。

```bash
md-pptx build slides.md
md-pptx build slides.md -t template.pptx
md-pptx build slides.md -o output.pptx
```

| オプション              | 説明                                                   |
| ----------------------- | ------------------------------------------------------ |
| `-t, --template <path>` | テンプレート PPTX のパス（フロントマターでも指定可）   |
| `-o, --output <path>`   | 出力先パス（デフォルト: 入力ファイルと同名の `.pptx`） |

### `md-pptx inspect <template>`

テンプレート PPTX のレイアウトとプレースホルダ情報を表示します。テンプレートにどのようなレイアウトが含まれているか確認する際に便利です。

```bash
md-pptx inspect template.pptx
```

出力例:

```
テンプレート: /path/to/template.pptx
レイアウト数: 5

  [Title Slide]
    - idx: 0, type: title, name: Title 1
    - idx: 1, type: subtitle, name: Subtitle 2

  [Title and Content]
    - idx: 0, type: title, name: Title 1
    - idx: 1, type: body, name: Content Placeholder 2
```

## Markdown 記法

### フロントマター

ファイル先頭に YAML 形式で記述します。

```yaml
---
template: ./templates/company.pptx
layout: Title and Content
headingDivider: 2
title: プレゼンテーションタイトル
author: 作成者名
---
```

| キー             | 型                 | 説明                                     |
| ---------------- | ------------------ | ---------------------------------------- |
| `template`       | string             | テンプレート PPTX のパス                 |
| `layout`         | string             | デフォルトのスライドレイアウト名         |
| `headingDivider` | number \| number[] | 指定レベル以下の見出しで自動スライド分割 |
| `title`          | string             | プレゼンテーションタイトル（メタデータ） |
| `author`         | string             | 作成者（メタデータ）                     |

### スライド区切り

`---`（水平罫線）でスライドを分割します。

```markdown
# スライド1

本文

---

# スライド2

本文
```

`headingDivider` を指定すると、指定レベル以下の見出しで自動的にスライドが分割されます（例: `2` なら `h1` と `h2` で分割）。配列で指定すると特定のレベルのみで分割します（例: `[2, 3]`）。

```markdown
---
headingDivider: 2
---

# セクション1

## スライドA

本文A

## スライドB

本文B
```

### ディレクティブ

HTML コメント形式で記述します。

```markdown
<!-- layout: Title and Content -->    ← このスライド以降に適用
<!-- _layout: Title Slide -->         ← このスライドのみに適用（スポット）
```

| ディレクティブ | 説明                 |
| -------------- | -------------------- |
| `layout`       | スライドレイアウト名 |

`_` プレフィックスを付けるとスポットディレクティブとなり、そのスライドのみに適用されます。

### テキスト書式

| Markdown         | PPTX での表現         |
| ---------------- | --------------------- |
| `**太字**`       | 太字                  |
| `*斜体*`         | 斜体                  |
| `` `コード` ``   | 等幅フォント          |
| `~~取り消し線~~` | 取り消し線（※未対応） |
| `[リンク](url)`  | ハイパーリンク        |

### リスト

箇条書き・番号付きリストに対応しています。ネストは PPTX のインデントレベルにマッピングされます（最大 9 レベル）。

```markdown
- 項目1
- 項目2
  - ネスト項目
    - さらにネスト

1. 番号付き項目1
2. 番号付き項目2
```

### 画像

```markdown
![代替テキスト](./images/photo.png)
```

サイズ指定構文をサポートしています（解析のみ。出力サイズへの反映は未実装）。

```markdown
![w:400](./images/photo.png)
![h:300](./images/photo.png)
![w:400 h:300](./images/photo.png)
```

picture プレースホルダがあるレイアウトでは、そのプレースホルダ内に配置されます。

### プレゼンターノート

ディレクティブとして解釈されない HTML コメントは、プレゼンターノートになります。

```markdown
# スライドタイトル

本文

<!-- ここに話すポイントを書く -->
```

## プレースホルダマッピング

Markdown の構造が PPTX のプレースホルダに自動マッピングされます。

| Markdown 要素          | PPTX プレースホルダ      |
| ---------------------- | ------------------------ |
| `#` / `##` 見出し      | title                    |
| 本文（段落、リスト等） | body                     |
| 画像                   | picture（なければ body） |

すべてのコンテンツがプレースホルダに割り当てられなかった場合は Blank レイアウトにフォールバックします。

## VS Code 拡張

[md-pptx VS Code 拡張](./vscode-extension)を使うと、エディタ上で以下の機能が利用できます。

- **md-pptx: Preview** — Markdown のリアルタイムプレビュー（テンプレートの背景画像も表示）
- **md-pptx: Build PPTX** — エディタから直接 PPTX を生成

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
