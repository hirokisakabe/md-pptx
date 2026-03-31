# md-pptx AI Agent Guide

## プロジェクト概要

md-pptx は Markdown とテンプレート PPTX から編集可能な PowerPoint ファイルを生成するツール。コアライブラリ・VS Code 拡張を単一プロジェクト（`src/`）で構成。

## コマンド

```bash
npm run build              # tsup でビルド（dist/ に出力）
npm run build:extension    # esbuild で VS Code 拡張をビルド（dist/extension.js）
npm run dev                # ウォッチモード
npm run watch:extension    # VS Code 拡張ウォッチモード
npm test                   # ユニットテスト（Vitest）
npm run test:e2e           # E2E テスト（フィクスチャダウンロード + Vitest）
npm run test:watch         # テストウォッチモード
npm run vrt:generate-fixtures  # VRT 用 PPTX フィクスチャ生成
npm run vrt:libreoffice    # LibreOffice VRT 実行（actual/ と snapshots/ の比較）
npm run typecheck          # tsc --noEmit
npm run lint               # ESLint
npm run lint:fix           # ESLint 自動修正
npm run format             # Prettier フォーマット
npm run format:check       # Prettier チェック
npm run knip               # 未使用エクスポート検出
```

単一テストファイルの実行:

```bash
npx vitest run src/core/parser.test.ts
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

tsup でコアライブラリをビルド（ESM のみ）:

- `src/index.ts` → ライブラリ（外部パッケージから利用）

esbuild で VS Code 拡張をビルド:

- `src/extension/extension.ts` → `dist/extension.js`（vscode・pyodide は external）

### 主要な依存関係

- **python-pptx-wasm** + **pyodide**: PPTX 操作の中核。Python の python-pptx を WASM 化したもの
- **markdown-it**: Markdown パーサー
- **jszip**: PPTX（ZIP 形式）の読み書き、スライドマスター背景画像の抽出
- **pptx-glimpse**: PPTX → SVG 変換（VS Code 拡張のプレビュー表示用）

### プレースホルダーマッピングロジック

テンプレートのレイアウトが持つプレースホルダー（title, body, picture, subtitle）に Markdown コンテンツを自動マッピングする。マッピング不可能な場合は Blank レイアウトにフォールバック。

### ディレクティブ

HTML コメント形式（`<!-- layout: name -->`）でディレクティブをサポート。`layout` はローカルディレクティブ（以降のスライドに影響）、`_layout` はスポットディレクティブ（そのスライドのみ）。

### VS Code 拡張

`src/extension/` 配下に構成。esbuild でバンドル。

- `extension.ts` — アクティベーション・デアクティベーション
- `pyodide-loader.ts` — Pyodide 初期化とレシピダウンロード（`globalStorageUri/recipes/` にキャッシュ）
- `commands/build.ts` — PPTX ビルドコマンド
- `commands/preview.ts` — プレビューコマンド
- `webview/preview-panel.ts` — Webview パネル管理（PPTX 生成 → pptx-glimpse で SVG 変換 → 表示）
- `webview/slide-renderer.ts` — HTML/SVG レンダリング（ズームコントロール付き）

## VRT（ビジュアルリグレッションテスト）

LibreOffice で PPTX を PNG に変換し、ベースラインスナップショットとのピクセル比較で見た目の回帰を検知する。

### ディレクトリ構成

- `docker/libreoffice-vrt/` — Docker イメージ（Ubuntu 24.04 + LibreOffice + 日本語フォント + poppler-utils）
- `vrt/fixtures/` — VRT 用 Markdown フィクスチャ（e2e/fixtures/ とは独立）
- `vrt/libreoffice/generate_fixtures.ts` — VRT フィクスチャ Markdown → PPTX 生成
- `vrt/libreoffice/convert_to_png.sh` — PPTX → PDF → PNG 変換（CI 用、`actual/` に出力）
- `vrt/libreoffice/update_snapshots.sh` — ベースラインスナップショット更新（`snapshots/` に出力）
- `vrt/libreoffice/regression.test.ts` — pixelmatch による `actual/` vs `snapshots/` 比較
- `vrt/libreoffice/snapshots/` — ベースライン PNG（git 管理）
- `vrt/libreoffice/fixtures/` — 生成 PPTX（gitignore）
- `vrt/libreoffice/actual/` — 実行時 PNG（gitignore）
- `vrt/libreoffice/diffs/` — 差分画像（gitignore）

### 変換フロー

```
PPTX → PDF (LibreOffice headless) → PNG per page (pdftoppm) → リサイズ 960px (Pillow LANCZOS)
```

### ベースライン更新手順

```bash
npm run test:e2e:setup                     # レシピダウンロード
npm run vrt:generate-fixtures              # PPTX 生成
docker run --rm -v "$(pwd):/workspace" md-pptx-vrt bash vrt/libreoffice/update_snapshots.sh
git add vrt/libreoffice/snapshots/         # ベースラインをコミット
```

## CI

GitHub Actions（`.github/workflows/ci.yml`）で typecheck → lint → format:check → knip → test → test:e2e → build → build:extension を実行。`libreoffice-vrt` ジョブでは Docker コンテナ内で PPTX → PNG 変換を行い、ベースラインスナップショットと比較する。Node.js バージョンは `.node-version`（v22）から読み取り。

## リリースフロー

changesets によるバージョン管理と vsce publish による VS Code Marketplace 公開を行う。

### changeset の作成

リリース対象の変更（機能追加・バグ修正など）を含む PR では、コミット前に `npx changeset` で change file を作成する。

- patch: バグ修正、軽微な変更
- minor: 新機能、機能改善
- major: 破壊的変更

ドキュメントのみの変更や CI 設定変更など、リリースに含めない変更では不要。

### フロー

```
npx changeset で change file を作成
  → PR に change file を含めてマージ
  → changesets/action が Version PR を自動作成（バージョンバンプ + CHANGELOG 更新）
  → Version PR をマージ
  → タグ自動作成 → vsce publish
```

- `.github/workflows/release.yml`: Version PR 自動作成 + タグ作成
- `.github/workflows/publish.yml`: タグトリガーで CI + vsce publish
