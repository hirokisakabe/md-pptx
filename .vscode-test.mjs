import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  files: "dist/extension/e2e/**/*.test.cjs",
  launchArgs: ["--disable-extensions"],
  mocha: {
    timeout: 60_000,
  },
});
