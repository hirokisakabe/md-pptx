import type Token from "markdown-it/lib/token.mjs";
import type {
  SlideData,
  ContentElement,
  TextRun,
  ListItem,
  ImageData,
} from "./types.js";
import { parseDirective, extractCommentContent } from "./directives.js";

// === Image alt text size parsing ===

const SIZE_W_RE = /(?:^|\s)(?:w(?:idth)?):(\d+)(?:px)?/;
const SIZE_H_RE = /(?:^|\s)(?:h(?:eight)?):(\d+)(?:px)?/;

function parseImageAlt(alt: string): {
  alt?: string;
  width?: number;
  height?: number;
} {
  const widthMatch = SIZE_W_RE.exec(alt);
  const heightMatch = SIZE_H_RE.exec(alt);

  const cleanAlt = alt
    .replace(/(?:^|\s)(?:w(?:idth)?):(\d+)(?:px)?/g, "")
    .replace(/(?:^|\s)(?:h(?:eight)?):(\d+)(?:px)?/g, "")
    .trim();

  return {
    alt: cleanAlt || undefined,
    width: widthMatch ? Number(widthMatch[1]) : undefined,
    height: heightMatch ? Number(heightMatch[1]) : undefined,
  };
}

// === Inline token → TextRun[] conversion ===

interface FormatState {
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  link?: string;
}

function convertInlineTokens(tokens: Token[]): TextRun[] {
  const runs: TextRun[] = [];
  const state: FormatState = {
    bold: false,
    italic: false,
    strikethrough: false,
  };

  for (const token of tokens) {
    switch (token.type) {
      case "strong_open":
        state.bold = true;
        break;
      case "strong_close":
        state.bold = false;
        break;
      case "em_open":
        state.italic = true;
        break;
      case "em_close":
        state.italic = false;
        break;
      case "s_open":
        state.strikethrough = true;
        break;
      case "s_close":
        state.strikethrough = false;
        break;
      case "link_open": {
        const href = token.attrGet("href");
        if (href) state.link = href;
        break;
      }
      case "link_close":
        state.link = undefined;
        break;
      case "code_inline":
        runs.push({ text: token.content, code: true });
        break;
      case "text":
        if (token.content !== "") {
          runs.push(buildRun(token.content, state));
        }
        break;
      case "softbreak":
      case "hardbreak":
        runs.push(buildRun("\n", state));
        break;
    }
  }

  return runs;
}

function buildRun(text: string, state: FormatState): TextRun {
  const run: TextRun = { text };
  if (state.bold) run.bold = true;
  if (state.italic) run.italic = true;
  if (state.strikethrough) run.strikethrough = true;
  if (state.link) run.link = state.link;
  return run;
}

// === Image extraction from inline tokens ===

function extractImage(tokens: Token[]): ImageData | null {
  const imgToken = tokens.find((t) => t.type === "image");
  if (!imgToken) return null;

  const src = imgToken.attrGet("src");
  if (!src) return null;

  const rawAlt = imgToken.children
    ? imgToken.children
        .filter((c) => c.type === "text")
        .map((c) => c.content)
        .join("")
    : "";

  const { alt, width, height } = parseImageAlt(rawAlt);

  return { src, alt, width, height };
}

function isImageOnlyParagraph(inlineToken: Token): boolean {
  if (!inlineToken.children) return false;
  const nonEmpty = inlineToken.children.filter(
    (t) => !(t.type === "text" && t.content.trim() === ""),
  );
  return nonEmpty.length === 1 && nonEmpty[0].type === "image";
}

// === Main converter ===

export function convertTokensToSlide(tokens: Token[]): SlideData {
  const content: ContentElement[] = [];
  const notes: string[] = [];
  const directives: SlideData["directives"] = [];

  let i = 0;
  let listItems: ListItem[] = [];
  const listTypeStack: boolean[] = []; // stack of ordered flags

  while (i < tokens.length) {
    const token = tokens[i];

    // HTML comments (directives or presenter notes)
    if (token.type === "html_block") {
      const commentContent = extractCommentContent(token.content);
      if (commentContent !== null) {
        const directive = parseDirective(commentContent);
        if (directive) {
          directives.push(directive);
        } else {
          notes.push(commentContent);
        }
      }
      i++;
      continue;
    }

    // Headings
    if (token.type === "heading_open") {
      const levelMatch = /^h(\d)$/.exec(token.tag);
      const level = levelMatch ? Number(levelMatch[1]) : 1;
      const inlineToken = tokens[i + 1];
      const runs = inlineToken?.children
        ? convertInlineTokens(inlineToken.children)
        : [];

      content.push({
        type: "heading",
        level: level as 1 | 2 | 3 | 4 | 5 | 6,
        runs,
      });

      i += 3; // heading_open, inline, heading_close
      continue;
    }

    // Lists - open
    if (
      token.type === "bullet_list_open" ||
      token.type === "ordered_list_open"
    ) {
      listTypeStack.push(token.type === "ordered_list_open");
      i++;
      continue;
    }

    // Lists - close
    if (
      token.type === "bullet_list_close" ||
      token.type === "ordered_list_close"
    ) {
      listTypeStack.pop();
      if (listTypeStack.length === 0 && listItems.length > 0) {
        content.push({ type: "list", items: [...listItems] });
        listItems = [];
      }
      i++;
      continue;
    }

    // List item - skip open/close markers
    if (token.type === "list_item_open" || token.type === "list_item_close") {
      i++;
      continue;
    }

    // Fenced code blocks
    if (token.type === "fence" || token.type === "code_block") {
      const info = token.type === "fence" ? token.info.trim() : "";
      const language = info ? info.split(/\s+/, 1)[0] : undefined;
      // Remove trailing newline from code content
      const code = token.content.replace(/\n$/, "");
      content.push({ type: "code-block", language, code });
      i++;
      continue;
    }

    // Paragraphs (also handles paragraphs inside list items)
    if (token.type === "paragraph_open") {
      const inlineToken = tokens[i + 1];

      if (listTypeStack.length > 0) {
        // Inside a list - add as list item
        if (inlineToken?.children) {
          const runs = convertInlineTokens(inlineToken.children);
          if (runs.length > 0) {
            listItems.push({
              runs,
              level: listTypeStack.length - 1,
              ordered: listTypeStack[listTypeStack.length - 1],
            });
          }
        }
      } else if (inlineToken && isImageOnlyParagraph(inlineToken)) {
        const image = extractImage(inlineToken.children!);
        if (image) {
          content.push({ type: "image", image });
        }
      } else if (inlineToken?.children) {
        const runs = convertInlineTokens(inlineToken.children);
        if (runs.length > 0) {
          content.push({ type: "paragraph", runs });
        }
      }

      i += 3; // paragraph_open, inline, paragraph_close
      continue;
    }

    i++;
  }

  return { content, notes, directives };
}
