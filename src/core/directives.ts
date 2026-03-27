import type { Directive } from "./types.js";

export const DIRECTIVE_KEYS = [
  "layout",
  "paginate",
  "header",
  "footer",
] as const;

export type DirectiveKey = (typeof DIRECTIVE_KEYS)[number];

const DIRECTIVE_RE = new RegExp(
  `^\\s*(_?)(${DIRECTIVE_KEYS.join("|")})\\s*:\\s*(.+?)\\s*$`,
);

export function parseDirective(comment: string): Directive | null {
  const match = DIRECTIVE_RE.exec(comment);
  if (!match) return null;

  return {
    key: match[2],
    value: match[3],
    scope: match[1] === "_" ? "spot" : "local",
  };
}

const COMMENT_RE = /^<!--\s*([\s\S]*?)\s*-->$/;

export function extractCommentContent(html: string): string | null {
  const match = COMMENT_RE.exec(html.trim());
  return match ? match[1] : null;
}
