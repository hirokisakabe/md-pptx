# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

md-pptx は Marp 互換の Markdown と PPTX テンプレートから編集可能な PowerPoint ファイルを生成するツール。コアライブラリ（`src/`）と VS Code 拡張（`vscode-extension/`）の 2 プロジェクト構成。

## コマンド

### コアライブラリ

```bash
npm run build          # tsup でビルド（dist/ に出力）
npm run dev            # ウォッチモード
npm test               # ユニットテスト（Vitest）
npm run test:e2e       # E2E テスト（フィクスチャダウンロード + Vitest）
npm run test:watch     # テストウォッチモード
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint
npm run lint:fix       # ESLint 自動修正
npm run format         # Prettier フォーマット
npm run format:check   # Prettier チェック
```

単一テストファイルの実行:

```bash
npx vitest run src/__tests__/parser.test.ts
```

### VS Code 拡張

```bash
cd vscode-extension
npm test
npm run typecheck
npm run lint
npm run format:check
```

## アーキテクチャ

### 処理パイプライン

```
Markdown + Template PPTX
  → Front Matter 抽出 (front-matter.ts)
  → markdown-it でトークン化 (parser.ts)
  → スライド分割 (slide-splitter.ts: --- 区切り or headingDivider)
  → トークン→ContentElement 変換 (token-converter.ts)
  → テンプレート読み込み (template-reader.ts: python-pptx-wasm)
  → プレースホルダーマッピング (placeholder-mapper.ts)
  → PPTX 生成 (pptx-generator.ts: python-pptx-wasm → Uint8Array)
```

### ビルド構成

tsup で 2 つのエントリポイントをビルド（ESM のみ）:

- `src/index.ts` → ライブラリ（外部パッケージから利用）
- `src/cli.ts` → CLI コマンド `md-pptx build` / `md-pptx inspect`

### 主要な依存関係

- **python-pptx-wasm** + **pyodide**: PPTX 操作の中核。Python の python-pptx を WASM 化したもの
- **markdown-it**: Markdown パーサー
- **jszip**: PPTX（ZIP 形式）の読み書き、スライドマスター背景画像の抽出

### プレースホルダーマッピングロジック

テンプレートのレイアウトが持つプレースホルダー（title, body, picture, subtitle）に Markdown コンテンツを自動マッピングする。マッピング不可能な場合は Blank レイアウトにフォールバック。

### ディレクティブ

HTML コメント形式（`<!-- layout: name -->`）で Marp 互換のディレクティブをサポート。`layout` はローカルディレクティブ（以降のスライドに影響）、`_layout` はスポットディレクティブ（そのスライドのみ）。

### VS Code 拡張

コアライブラリを `file:..` 参照で依存。esbuild でバンドル。スライドマスター背景画像の抽出（`slide-master-extractor.ts`）は JSZip で PPTX を展開し Data URL に変換してプレビュー表示。

## CI

GitHub Actions（`.github/workflows/ci.yml`）でコアライブラリと VS Code 拡張の両方に対して typecheck → lint → format:check → test → build を実行。Node.js バージョンは `.node-version`（v22）から読み取り。
