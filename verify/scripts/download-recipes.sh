#!/bin/bash
set -euo pipefail

RECIPE_DIR="assets/recipes"
RELEASE_URL="https://github.com/yikenman/python-pptx-recipe/releases/download/0.29-20260116"

echo "Downloading python-pptx-recipe..."

mkdir -p "$RECIPE_DIR"

curl -L -o "$RECIPE_DIR/pyodide-lock.json" "$RELEASE_URL/pyodide-lock.json"
echo "Downloaded pyodide-lock.json"

curl -L -o "/tmp/packages.tar.gz" "$RELEASE_URL/packages.tar.gz"
tar -xzf "/tmp/packages.tar.gz" -C "$RECIPE_DIR"
rm /tmp/packages.tar.gz
echo "Extracted packages to $RECIPE_DIR"

echo "Recipe setup complete!"
