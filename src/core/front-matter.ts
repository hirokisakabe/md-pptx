import type { FrontMatter } from "./types.js";

export interface ExtractFrontMatterResult {
  frontMatter: FrontMatter;
  body: string;
}

const FRONT_MATTER_RE =
  /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)|^---\r?\n---(?:\r?\n|$)/;

function parseValue(raw: string): string | number | number[] {
  const trimmed = raw.trim();

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1);
    const nums = inner
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map(Number)
      .filter(
        (n) => Number.isFinite(n) && Number.isInteger(n) && n >= 1 && n <= 6,
      );
    return nums.length > 0 ? nums : trimmed;
  }

  const num = Number(trimmed);
  if (Number.isFinite(num) && Number.isInteger(num) && num >= 1 && num <= 6) {
    return num;
  }

  return trimmed;
}

export function extractFrontMatter(input: string): ExtractFrontMatterResult {
  const match = FRONT_MATTER_RE.exec(input);

  if (!match) {
    return { frontMatter: {}, body: input };
  }

  const yamlBlock = match[1] ?? "";
  const body = input.slice(match[0].length);
  const frontMatter: FrontMatter = {};

  for (const line of yamlBlock.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    const value = trimmed.slice(colonIndex + 1).trim();

    switch (key) {
      case "template":
        frontMatter.template = String(value);
        break;
      case "layout":
        frontMatter.layout = String(value);
        break;
      case "headingDivider": {
        const parsed = parseValue(value);
        if (typeof parsed === "number" || Array.isArray(parsed)) {
          frontMatter.headingDivider = parsed;
        }
        break;
      }
      case "author":
        frontMatter.author = String(value);
        break;
      case "title":
        frontMatter.title = String(value);
        break;
    }
  }

  return { frontMatter, body };
}
