import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import * as https from "node:https";
import * as zlib from "node:zlib";

const RELEASE_URL =
  "https://github.com/yikenman/python-pptx-recipe/releases/download/0.29-20260116";

let initPromise: Promise<void> | undefined;

export function ensureInitialized(globalStorageUri: vscode.Uri): Promise<void> {
  if (!initPromise) {
    initPromise = initialize(globalStorageUri).catch((err) => {
      initPromise = undefined;
      throw err;
    });
  }
  return initPromise;
}

async function initialize(globalStorageUri: vscode.Uri): Promise<void> {
  const recipesDir = path.join(globalStorageUri.fsPath, "recipes");
  await downloadRecipesIfNeeded(recipesDir);

  const lockFileURL = path.join(recipesDir, "pyodide-lock.json");
  const { loadPyodide } = await import("pyodide");
  const { init } = await import("python-pptx-wasm");
  const pyodide = await loadPyodide({ lockFileURL });
  await init(pyodide);
}

async function downloadRecipesIfNeeded(recipesDir: string): Promise<void> {
  const lockFilePath = path.join(recipesDir, "pyodide-lock.json");
  if (fs.existsSync(lockFilePath)) {
    return;
  }

  fs.mkdirSync(recipesDir, { recursive: true });

  const tarBuffer = await downloadToBuffer(`${RELEASE_URL}/packages.tar.gz`);
  await extractTarGz(tarBuffer, recipesDir);

  // lock ファイルを最後にダウンロードすることで、展開途中失敗時の不整合を防ぐ
  await downloadFile(`${RELEASE_URL}/pyodide-lock.json`, lockFilePath);
}

function downloadToBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const request = (currentUrl: string, redirectCount: number) => {
      if (redirectCount > 5) {
        reject(new Error("Too many redirects"));
        return;
      }
      https
        .get(currentUrl, (response) => {
          if (
            response.statusCode &&
            response.statusCode >= 300 &&
            response.statusCode < 400 &&
            response.headers.location
          ) {
            request(response.headers.location, redirectCount + 1);
            return;
          }
          if (response.statusCode !== 200) {
            reject(
              new Error(
                `Download failed: ${response.statusCode} ${currentUrl}`,
              ),
            );
            return;
          }
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("end", () => resolve(Buffer.concat(chunks)));
          response.on("error", reject);
        })
        .on("error", reject);
    };
    request(url, 0);
  });
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = (currentUrl: string, redirectCount: number) => {
      if (redirectCount > 5) {
        reject(new Error("Too many redirects"));
        return;
      }
      https
        .get(currentUrl, (response) => {
          if (
            response.statusCode &&
            response.statusCode >= 300 &&
            response.statusCode < 400 &&
            response.headers.location
          ) {
            request(response.headers.location, redirectCount + 1);
            return;
          }
          if (response.statusCode !== 200) {
            reject(
              new Error(
                `Download failed: ${response.statusCode} ${currentUrl}`,
              ),
            );
            return;
          }
          const file = fs.createWriteStream(dest);
          response.pipe(file);
          file.on("finish", () => {
            file.close();
            resolve();
          });
          file.on("error", (err) => {
            fs.unlinkSync(dest);
            reject(err);
          });
        })
        .on("error", reject);
    };
    request(url, 0);
  });
}

function extractTarGz(buffer: Buffer, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    zlib.gunzip(buffer, (err, tarData) => {
      if (err) {
        reject(new Error(`Failed to decompress: ${err.message}`));
        return;
      }
      try {
        extractTar(tarData, destDir);
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });
}

function extractTar(tarData: Buffer, destDir: string): void {
  const BLOCK_SIZE = 512;
  let offset = 0;

  while (offset + BLOCK_SIZE <= tarData.length) {
    const header = tarData.subarray(offset, offset + BLOCK_SIZE);

    // 空ブロックが2つ続いたらアーカイブ終端
    if (header.every((b) => b === 0)) {
      break;
    }

    const name = header.subarray(0, 100).toString("utf-8").replace(/\0.*/, "");
    const sizeOctal = header
      .subarray(124, 136)
      .toString("utf-8")
      .replace(/\0.*/, "")
      .trim();
    const size = parseInt(sizeOctal, 8) || 0;
    const typeFlag = header[156];

    offset += BLOCK_SIZE;

    // ディレクトリ (typeFlag '5' = 53)
    if (typeFlag === 53 || name.endsWith("/")) {
      fs.mkdirSync(path.join(destDir, name), { recursive: true });
    }
    // 通常ファイル (typeFlag '0' = 48 or '\0' = 0)
    else if (typeFlag === 48 || typeFlag === 0) {
      const filePath = path.join(destDir, name);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const fileData = tarData.subarray(offset, offset + size);
      fs.writeFileSync(filePath, fileData);
    }

    // データブロックをスキップ（512バイト境界に切り上げ）
    offset += Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE;
  }
}
