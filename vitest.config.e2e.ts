import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["e2e/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    server: {
      deps: {
        inline: ["python-pptx-wasm"],
      },
    },
  },
});
