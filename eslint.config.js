import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintConfigPrettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // tsconfig.json に含まれない設定ファイル・テストは型チェック対象外
    files: [
      "eslint.config.js",
      "tsup.config.ts",
      "vitest.config.ts",
      "vitest.config.*.ts",
      "e2e/**/*.ts",
      "vrt/**/*.ts",
      "src/extension/e2e/**/*.ts",
      ".vscode-test.mjs",
      "docs/.vitepress/config.ts",
    ],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // python-pptx-wasm は型定義を提供しないため unsafe ルールを緩和
    files: ["src/core/pptx-generator.ts", "src/core/pptx-generator.test.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
    },
  },
  {
    ignores: [
      "dist/",
      "node_modules/",
      "esbuild.mjs",
      ".vscode-test/",
      "src/extension/e2e/esbuild.mjs",
      "docs/.vitepress/dist/",
      "docs/.vitepress/cache/",
    ],
  },
);
