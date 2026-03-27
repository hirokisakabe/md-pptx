import { defineConfig } from "tsup";

const shared = {
  format: ["esm"] as const,
  dts: true,
  sourcemap: true,
};

export default defineConfig([
  {
    entry: ["src/index.ts"],
    clean: true,
    ...shared,
  },
  {
    entry: ["src/cli.ts"],
    banner: { js: "#!/usr/bin/env node" },
    ...shared,
  },
]);
