#!/bin/bash
set -euo pipefail

# VRT フィクスチャ PPTX を LibreOffice で PNG に変換する。
# 出力先は actual/ ディレクトリ（テスト時に snapshots/ と比較される）。
# Docker コンテナ内で実行されることを想定。
#
# Usage:
#   bash vrt/libreoffice/convert_to_png.sh

FIXTURE_DIR="/workspace/vrt/libreoffice/fixtures"
OUTPUT_DIR="/workspace/vrt/libreoffice/actual"
TEMP_DIR="/tmp/libreoffice-render"
TARGET_WIDTH=960

mkdir -p "$OUTPUT_DIR" "$TEMP_DIR"

found=0

for pptx_file in "$FIXTURE_DIR"/*.pptx; do
    [ -f "$pptx_file" ] || continue
    found=1

    name=$(basename "$pptx_file" .pptx)

    echo "Rendering: $pptx_file"

    libreoffice --headless --convert-to png \
        --outdir "$TEMP_DIR" "$pptx_file" 2>/dev/null

    slide_num=1
    for png_file in "$TEMP_DIR/${name}"*.png; do
        [ -f "$png_file" ] || continue

        python3 -c "
from PIL import Image

img = Image.open('$png_file')
ratio = $TARGET_WIDTH / img.width
new_height = int(img.height * ratio)
img = img.resize(($TARGET_WIDTH, new_height), Image.LANCZOS)
output_path = '$OUTPUT_DIR/${name}-slide${slide_num}.png'
img.save(output_path)
print(f'  Saved: {output_path} ({$TARGET_WIDTH}x{new_height})')
"
        slide_num=$((slide_num + 1))
    done

    rm -f "$TEMP_DIR/${name}"*.png
done

if [ "$found" -eq 0 ]; then
    echo "ERROR: No fixtures found in $FIXTURE_DIR"
    echo "Run fixture generation first."
    exit 1
fi

rm -rf "$TEMP_DIR"
echo "Done!"
