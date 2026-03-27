#!/bin/bash
set -euo pipefail

RECIPE_DIR="assets/recipes"
RELEASE_URL="https://github.com/yikenman/python-pptx-recipe/releases/download/0.29-20260116"

tmp_tar="$(mktemp)"
trap 'rm -f "$tmp_tar"' EXIT

echo "Downloading python-pptx-recipe..."

mkdir -p "$RECIPE_DIR"

curl -fSL --retry 3 --retry-delay 1 -o "$RECIPE_DIR/pyodide-lock.json" "$RELEASE_URL/pyodide-lock.json"
echo "Downloaded pyodide-lock.json"

curl -fSL --retry 3 --retry-delay 1 -o "$tmp_tar" "$RELEASE_URL/packages.tar.gz"
tar -xzf "$tmp_tar" -C "$RECIPE_DIR"
echo "Extracted packages to $RECIPE_DIR"

echo "Recipe setup complete!"
