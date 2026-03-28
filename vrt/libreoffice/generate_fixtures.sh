#!/bin/bash
set -euo pipefail

# E2E フィクスチャから VRT 用 PPTX を生成するラッパースクリプト。
# E2E レシピがダウンロード済みであることを前提とする。
#
# Usage:
#   bash vrt/libreoffice/generate_fixtures.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/../.."

cd "$PROJECT_ROOT"

echo "Generating VRT fixtures..."
npx tsx vrt/libreoffice/generate_fixtures.ts
