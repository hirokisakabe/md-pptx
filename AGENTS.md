# md-pptx AI Agent Guide

## プロジェクト概要

md-pptx は Markdown とテンプレート PPTX から編集可能な PowerPoint ファイルを生成するツール。コアライブラリ（`src/`）と VS Code 拡張（`vscode-extension/`）の 2 プロジェクト構成。

## コマンド

### コアライブラリ

```bash
npm run build              # tsup でビルド（dist/ に出力）
npm run dev                # ウォッチモード
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
```

単一テストファイルの実行:

```bash
npx vitest run src/parser.test.ts
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

HTML コメント形式（`<!-- layout: name -->`）でディレクティブをサポート。`layout` はローカルディレクティブ（以降のスライドに影響）、`_layout` はスポットディレクティブ（そのスライドのみ）。

### VS Code 拡張

コアライブラリを `file:..` 参照で依存。esbuild でバンドル。スライドマスター背景画像の抽出（`slide-master-extractor.ts`）は JSZip で PPTX を展開し Data URL に変換してプレビュー表示。

## VRT（ビジュアルリグレッションテスト）

LibreOffice で PPTX を PNG に変換し、ベースラインスナップショットとのピクセル比較で見た目の回帰を検知する。

### ディレクトリ構成

- `docker/libreoffice-vrt/` — Docker イメージ（Ubuntu 24.04 + LibreOffice + 日本語フォント + poppler-utils）
- `vrt/libreoffice/generate_fixtures.ts` — E2E フィクスチャ Markdown → PPTX 生成
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

GitHub Actions（`.github/workflows/ci.yml`）でコアライブラリと VS Code 拡張の両方に対して typecheck → lint → format:check → test → build を実行。`libreoffice-vrt` ジョブでは Docker コンテナ内で PPTX → PNG 変換を行い、ベースラインスナップショットと比較する。Node.js バージョンは `.node-version`（v22）から読み取り。

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
