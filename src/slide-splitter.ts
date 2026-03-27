import type Token from "markdown-it/lib/token.mjs";

function getHeadingLevel(token: Token): number | null {
  if (token.type !== "heading_open") return null;
  const match = /^h(\d)$/.exec(token.tag);
  return match ? Number(match[1]) : null;
}

function shouldSplitOnHeading(
  level: number,
  headingDivider: number | number[],
): boolean {
  if (Array.isArray(headingDivider)) {
    return headingDivider.includes(level);
  }
  return level <= headingDivider;
}

export function splitTokensIntoSlides(
  tokens: Token[],
  headingDivider?: number | number[],
): Token[][] {
  // Phase 1: Split on hr tokens (---)
  const groups: Token[][] = [[]];

  for (const token of tokens) {
    if (token.type === "hr") {
      groups.push([]);
    } else {
      groups[groups.length - 1].push(token);
    }
  }

  // Phase 2: Apply headingDivider if specified
  if (headingDivider === undefined) {
    return groups;
  }

  const result: Token[][] = [];

  for (const group of groups) {
    let current: Token[] = [];

    for (const token of group) {
      const level = getHeadingLevel(token);
      if (level !== null && shouldSplitOnHeading(level, headingDivider)) {
        if (current.length > 0) {
          result.push(current);
        }
        current = [token];
      } else {
        current.push(token);
      }
    }

    result.push(current);
  }

  return result;
}
