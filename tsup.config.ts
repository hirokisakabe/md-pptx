import { defineConfig } from "tsup";

const shared = {
  format: ["esm"] as const,
  dts: true,
  sourcemap: true,
};

export default defineConfig({
  entry: ["src/index.ts"],
  clean: true,
  ...shared,
});
