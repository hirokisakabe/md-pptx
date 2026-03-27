import { init, Presentation } from "python-pptx-wasm";
import { loadPyodide } from "pyodide";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

interface MemorySnapshot {
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
}

interface BenchmarkResult {
  loadPyodideMs: number;
  initPythonPptxMs: number;
  totalInitMs: number;
  firstPresentationMs: number;
  memoryBefore: MemorySnapshot;
  memoryAfterPyodide: MemorySnapshot;
  memoryAfterInit: MemorySnapshot;
}

function getMemory(): MemorySnapshot {
  const mem = process.memoryUsage();
  return {
    rss: mem.rss,
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    external: mem.external,
    arrayBuffers: mem.arrayBuffers,
  };
}

function formatBytes(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(2)} MB`;
}

function formatMs(ms: number): string {
  return `${ms.toFixed(0)} ms`;
}

function readPackageVersions(): { pyodide: string; pythonPptxWasm: string } {
  const pkgPath = path.join(PROJECT_ROOT, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  return {
    pyodide: pkg.dependencies?.pyodide ?? "unknown",
    pythonPptxWasm: pkg.dependencies?.["python-pptx-wasm"] ?? "unknown",
  };
}

async function runBenchmark(label: string): Promise<BenchmarkResult> {
  console.log(`\n--- ${label} ---`);

  if (!global.gc) {
    console.warn(
      "  警告: --expose-gc が有効でないため GC を強制実行できません。メモリ計測の精度が低下します。"
    );
  }
  global.gc?.();
  const memBefore = getMemory();

  // 1. loadPyodide
  const lockFileURL = path.join(
    PROJECT_ROOT,
    "assets/recipes/pyodide-lock.json"
  );
  const t0 = performance.now();
  const pyodide = await loadPyodide({ lockFileURL });
  const t1 = performance.now();
  const memAfterPyodide = getMemory();

  // 2. init (python-pptx パッケージのロード)
  await init(pyodide);
  const t2 = performance.now();
  const memAfterInit = getMemory();

  // 3. 最初の Presentation 生成
  const t3 = performance.now();
  const prs = Presentation();
  const t4 = performance.now();
  prs.end();

  const result: BenchmarkResult = {
    loadPyodideMs: t1 - t0,
    initPythonPptxMs: t2 - t1,
    totalInitMs: t2 - t0,
    firstPresentationMs: t4 - t3,
    memoryBefore: memBefore,
    memoryAfterPyodide: memAfterPyodide,
    memoryAfterInit: memAfterInit,
  };

  console.log(`  loadPyodide:       ${formatMs(result.loadPyodideMs)}`);
  console.log(`  init(python-pptx): ${formatMs(result.initPythonPptxMs)}`);
  console.log(`  合計初期化:        ${formatMs(result.totalInitMs)}`);
  console.log(`  初回 Presentation: ${formatMs(result.firstPresentationMs)}`);
  console.log(
    `  メモリ (RSS):      ${formatBytes(memBefore.rss)} → ${formatBytes(memAfterInit.rss)} (+ ${formatBytes(memAfterInit.rss - memBefore.rss)})`
  );
  console.log(
    `  メモリ (Heap):     ${formatBytes(memBefore.heapUsed)} → ${formatBytes(memAfterInit.heapUsed)} (+ ${formatBytes(memAfterInit.heapUsed - memBefore.heapUsed)})`
  );
  console.log(
    `  メモリ (External): ${formatBytes(memBefore.external)} → ${formatBytes(memAfterInit.external)} (+ ${formatBytes(memAfterInit.external - memBefore.external)})`
  );

  return result;
}

function runBenchmarkInSubprocess(): BenchmarkResult {
  const scriptPath = fileURLToPath(import.meta.url);
  const output = execFileSync(
    process.execPath,
    ["--expose-gc", "--import", "tsx", scriptPath, "--single-run"],
    {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      env: { ...process.env, NODE_OPTIONS: "" },
      timeout: 120_000,
    }
  );
  const jsonLine = output
    .split("\n")
    .find((line) => line.startsWith("__RESULT_JSON__:"));
  if (!jsonLine) {
    throw new Error("子プロセスから計測結果を取得できませんでした");
  }
  return JSON.parse(jsonLine.replace("__RESULT_JSON__:", ""));
}

function generateReport(results: BenchmarkResult[]): string {
  const versions = readPackageVersions();
  const lines: string[] = [];
  lines.push("# Pyodide 初回ロード パフォーマンス計測結果");
  lines.push("");
  lines.push(`計測日時: ${new Date().toISOString()}`);
  lines.push(`Node.js: ${process.version}`);
  lines.push(`Platform: ${process.platform} ${process.arch}`);
  lines.push(`pyodide: ${versions.pyodide}`);
  lines.push(`python-pptx-wasm: ${versions.pythonPptxWasm}`);
  lines.push("");

  // 各回の結果
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const label =
      i === 0
        ? "初回ロード (コールドスタート)"
        : `${i + 1}回目ロード (別プロセス)`;
    lines.push(`## ${label}`);
    lines.push("");
    lines.push("### 時間");
    lines.push("");
    lines.push("| 項目 | 時間 |");
    lines.push("|------|------|");
    lines.push(`| loadPyodide() | ${formatMs(r.loadPyodideMs)} |`);
    lines.push(
      `| init() (python-pptx ロード) | ${formatMs(r.initPythonPptxMs)} |`
    );
    lines.push(`| **合計初期化時間** | **${formatMs(r.totalInitMs)}** |`);
    lines.push(
      `| 初回 Presentation() 生成 | ${formatMs(r.firstPresentationMs)} |`
    );
    lines.push("");
    lines.push("### メモリ使用量");
    lines.push("");
    lines.push("| 項目 | 初期化前 | Pyodide ロード後 | init 完了後 | 増分 |");
    lines.push("|------|---------|-----------------|------------|------|");
    lines.push(
      `| RSS | ${formatBytes(r.memoryBefore.rss)} | ${formatBytes(r.memoryAfterPyodide.rss)} | ${formatBytes(r.memoryAfterInit.rss)} | +${formatBytes(r.memoryAfterInit.rss - r.memoryBefore.rss)} |`
    );
    lines.push(
      `| Heap Used | ${formatBytes(r.memoryBefore.heapUsed)} | ${formatBytes(r.memoryAfterPyodide.heapUsed)} | ${formatBytes(r.memoryAfterInit.heapUsed)} | +${formatBytes(r.memoryAfterInit.heapUsed - r.memoryBefore.heapUsed)} |`
    );
    lines.push(
      `| Heap Total | ${formatBytes(r.memoryBefore.heapTotal)} | ${formatBytes(r.memoryAfterPyodide.heapTotal)} | ${formatBytes(r.memoryAfterInit.heapTotal)} | +${formatBytes(r.memoryAfterInit.heapTotal - r.memoryBefore.heapTotal)} |`
    );
    lines.push(
      `| External | ${formatBytes(r.memoryBefore.external)} | ${formatBytes(r.memoryAfterPyodide.external)} | ${formatBytes(r.memoryAfterInit.external)} | +${formatBytes(r.memoryAfterInit.external - r.memoryBefore.external)} |`
    );
    lines.push(
      `| ArrayBuffers | ${formatBytes(r.memoryBefore.arrayBuffers)} | ${formatBytes(r.memoryAfterPyodide.arrayBuffers)} | ${formatBytes(r.memoryAfterInit.arrayBuffers)} | +${formatBytes(r.memoryAfterInit.arrayBuffers - r.memoryBefore.arrayBuffers)} |`
    );
    lines.push("");
  }

  // 比較サマリ
  if (results.length >= 2) {
    lines.push("## 初回 vs 2回目以降の比較 (各プロセス独立)");
    lines.push("");
    lines.push("| 項目 | 初回 | 2回目 | 差分 |");
    lines.push("|------|------|-------|------|");
    const first = results[0];
    const second = results[1];
    const diff = (
      ((first.totalInitMs - second.totalInitMs) / first.totalInitMs) *
      100
    ).toFixed(1);
    lines.push(
      `| 合計初期化時間 | ${formatMs(first.totalInitMs)} | ${formatMs(second.totalInitMs)} | ${diff}% |`
    );
    lines.push(
      `| loadPyodide() | ${formatMs(first.loadPyodideMs)} | ${formatMs(second.loadPyodideMs)} | - |`
    );
    lines.push(
      `| init() | ${formatMs(first.initPythonPptxMs)} | ${formatMs(second.initPythonPptxMs)} | - |`
    );
    lines.push("");
    lines.push(
      "> 各回は独立したプロセスで実行。ファイルシステムキャッシュの効果を計測しています。"
    );
    lines.push("");
  }

  // VS Code 拡張としての評価
  lines.push("## VS Code 拡張としての評価");
  lines.push("");
  const firstResult = results[0];
  const totalSec = firstResult.totalInitMs / 1000;
  const memMB =
    (firstResult.memoryAfterInit.rss - firstResult.memoryBefore.rss) /
    1024 /
    1024;

  lines.push("### 判定基準");
  lines.push("");
  lines.push("| 項目 | 許容範囲 | 計測値 | 判定 |");
  lines.push("|------|---------|--------|------|");

  const timeVerdict =
    totalSec <= 3 ? "OK" : totalSec <= 10 ? "要緩和策" : "NG";
  const timeIcon = totalSec <= 3 ? "✅" : totalSec <= 10 ? "⚠️" : "❌";
  lines.push(
    `| 初期化時間 | < 3秒: OK / 3-10秒: 要緩和策 / > 10秒: NG | ${totalSec.toFixed(1)}秒 | ${timeIcon} ${timeVerdict} |`
  );

  const memVerdict = memMB <= 100 ? "OK" : memMB <= 200 ? "要検討" : "NG";
  const memIcon = memMB <= 100 ? "✅" : memMB <= 200 ? "⚠️" : "❌";
  lines.push(
    `| メモリ増分 (RSS) | < 100MB: OK / 100-200MB: 要検討 / > 200MB: NG | ${memMB.toFixed(1)}MB | ${memIcon} ${memVerdict} |`
  );

  lines.push("");
  lines.push("### 緩和策の検討");
  lines.push("");
  if (totalSec > 3) {
    lines.push(
      "- **プログレス表示**: 初期化中にプログレスバーを表示して体感待ち時間を軽減"
    );
    lines.push(
      "- **遅延初期化**: 拡張のアクティベーション時ではなく、最初のコマンド実行時に初期化"
    );
    lines.push(
      "- **キャッシュ**: Pyodide パッケージをローカルにキャッシュして2回目以降を高速化"
    );
  }
  if (memMB > 100) {
    lines.push("- **メモリ管理**: 不要になったリソースの明示的な解放");
    lines.push(
      "- **分離プロセス**: Worker や子プロセスでの実行による本体への影響軽減"
    );
  }
  if (totalSec <= 3 && memMB <= 100) {
    lines.push("- 現時点では特別な緩和策は不要と判断");
  }
  lines.push("");

  return lines.join("\n");
}

async function main() {
  const isSingleRun = process.argv.includes("--single-run");

  if (isSingleRun) {
    // 子プロセスとして実行: 計測してJSON出力
    const result = await runBenchmark("子プロセス計測");
    console.log("__RESULT_JSON__:" + JSON.stringify(result));
    return;
  }

  console.log("=== Pyodide 初回ロード パフォーマンス計測 ===");
  console.log(`Node.js: ${process.version}`);
  console.log(`Platform: ${process.platform} ${process.arch}`);

  const RUNS = 3;
  const results: BenchmarkResult[] = [];

  // 1回目: このプロセスで直接実行
  const firstResult = await runBenchmark("初回ロード (コールドスタート)");
  results.push(firstResult);

  // 2回目以降: 独立した子プロセスで実行
  for (let i = 1; i < RUNS; i++) {
    console.log(`\n--- ${i + 1}回目ロード (別プロセス) ---`);
    const result = runBenchmarkInSubprocess();
    console.log(`  loadPyodide:       ${formatMs(result.loadPyodideMs)}`);
    console.log(`  init(python-pptx): ${formatMs(result.initPythonPptxMs)}`);
    console.log(`  合計初期化:        ${formatMs(result.totalInitMs)}`);
    console.log(`  初回 Presentation: ${formatMs(result.firstPresentationMs)}`);
    console.log(
      `  メモリ増分 (RSS):  +${formatBytes(result.memoryAfterInit.rss - result.memoryBefore.rss)}`
    );
    results.push(result);
  }

  // レポート生成
  const report = generateReport(results);
  const reportPath = path.join(PROJECT_ROOT, "RESULTS.md");
  fs.writeFileSync(reportPath, report);
  console.log(`\nレポートを ${reportPath} に保存しました。`);
}

main().catch((e) => {
  console.error("計測中にエラーが発生しました:", e);
  process.exit(1);
});
