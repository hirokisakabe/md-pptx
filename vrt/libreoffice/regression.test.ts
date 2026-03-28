import {
  existsSync,
  readFileSync,
  readdirSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_DIR = join(__dirname, "snapshots");
const ACTUAL_DIR = join(__dirname, "actual");
const DIFF_DIR = join(__dirname, "diffs");

// フォントレンダリングやアンチエイリアスの差異を許容するための閾値
const PIXEL_THRESHOLD = 0.3;
const MISMATCH_TOLERANCE = 0.05;

// テストケース定義
const VRT_CASES = [
  { name: "basic" },
  { name: "multi-slide" },
  { name: "with-image" },
  { name: "with-formatting" },
  { name: "heading-divider" },
  { name: "sample" },
] as const;

/** actual/ ディレクトリから指定名のスライド PNG を収集する */
function collectActualSlides(name: string): string[] {
  if (!existsSync(ACTUAL_DIR)) return [];
  return readdirSync(ACTUAL_DIR)
    .filter((f) => f.startsWith(`${name}-slide`) && f.endsWith(".png"))
    .sort()
    .map((f) => join(ACTUAL_DIR, f));
}

const hasActual =
  existsSync(ACTUAL_DIR) &&
  VRT_CASES.some((c) => collectActualSlides(c.name).length > 0);
const hasSnapshots =
  existsSync(SNAPSHOT_DIR) &&
  VRT_CASES.some((c) => existsSync(join(SNAPSHOT_DIR, `${c.name}-slide1.png`)));

const describeOrSkip = hasActual && hasSnapshots ? describe : describe.skip;

describeOrSkip(
  "LibreOffice Visual Regression Tests",
  { timeout: 120_000 },
  () => {
    for (const testCase of VRT_CASES) {
      const { name } = testCase;
      const actualSlides = collectActualSlides(name);
      const snapshotSlide1 = join(SNAPSHOT_DIR, `${name}-slide1.png`);
      const itOrSkip =
        actualSlides.length > 0 && existsSync(snapshotSlide1) ? it : it.skip;

      describe(name, () => {
        itOrSkip("should match LibreOffice reference", () => {
          mkdirSync(DIFF_DIR, { recursive: true });

          expect(actualSlides.length).toBeGreaterThan(0);

          for (let i = 0; i < actualSlides.length; i++) {
            const slideNum = i + 1;
            const refPath = join(SNAPSHOT_DIR, `${name}-slide${slideNum}.png`);

            // スナップショットが欠落している場合はテスト失敗
            expect(
              existsSync(refPath),
              `Missing snapshot: ${name}-slide${slideNum}.png`,
            ).toBe(true);

            const actual = PNG.sync.read(readFileSync(actualSlides[i]));
            const ref = PNG.sync.read(readFileSync(refPath));

            // サイズを合わせる（高さが異なる場合、小さい方に合わせる）
            const height = Math.min(actual.height, ref.height);
            const width = Math.min(actual.width, ref.width);

            const diff = new PNG({ width, height });
            const mismatchedPixels = pixelmatch(
              actual.data as unknown as Buffer,
              ref.data as unknown as Buffer,
              diff.data as unknown as Buffer,
              width,
              height,
              { threshold: PIXEL_THRESHOLD },
            );

            const totalPixels = width * height;
            const mismatchPercentage = mismatchedPixels / totalPixels;

            // 差分画像を保存
            const diffPath = join(
              DIFF_DIR,
              `${name}-slide${slideNum}-diff.png`,
            );
            writeFileSync(diffPath, PNG.sync.write(diff));

            expect(
              mismatchPercentage,
              `${name} slide ${slideNum}: ` +
                `${(mismatchPercentage * 100).toFixed(2)}% pixels differ ` +
                `(${mismatchedPixels}/${totalPixels}). ` +
                `Tolerance: ${MISMATCH_TOLERANCE * 100}%`,
            ).toBeLessThanOrEqual(MISMATCH_TOLERANCE);
          }
        });
      });
    }
  },
);
