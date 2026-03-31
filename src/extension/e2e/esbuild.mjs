import * as esbuild from "esbuild";
import { readdirSync } from "node:fs";
import { join } from "node:path";

function findTestFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTestFiles(fullPath));
    } else if (entry.name.endsWith(".test.ts")) {
      results.push(fullPath);
    }
  }
  return results;
}

const testFiles = findTestFiles("src/extension/e2e");

await esbuild.build({
  entryPoints: testFiles,
  bundle: true,
  outdir: "dist/extension/e2e",
  external: ["vscode", "mocha"],
  format: "cjs",
  platform: "node",
  target: "node22",
  sourcemap: true,
  outExtension: { ".js": ".cjs" },
});

console.log("VS Code e2e test build complete.");
