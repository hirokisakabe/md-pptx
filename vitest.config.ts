import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    exclude: ["e2e/**", "node_modules/**", "src/extension/e2e/**", "dist/**"],
    server: {
      deps: {
        inline: ["python-pptx-wasm"],
      },
    },
  },
});
