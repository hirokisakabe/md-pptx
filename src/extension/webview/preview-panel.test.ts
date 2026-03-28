import { describe, it, expect } from "vitest";
import { buildHtml, buildLoadingHtml } from "./slide-renderer";

describe("PreviewPanel の HTML", () => {
  it("有効な HTML を返す", () => {
    const html = buildHtml([]);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('<html lang="ja">');
    expect(html).toContain("</html>");
  });

  it("ナビゲーション要素を含まない", () => {
    const html = buildHtml([]);
    expect(html).not.toContain('id="btn-prev"');
    expect(html).not.toContain('id="btn-next"');
    expect(html).not.toContain('id="indicator"');
    expect(html).not.toContain("nav-bar");
  });

  it("スライド表示領域を含む", () => {
    const html = buildHtml([]);
    expect(html).toContain('id="container"');
    expect(html).toContain("slides-container");
  });

  it("縦スクロール用のスタイルを含む", () => {
    const html = buildHtml([]);
    expect(html).toContain("overflow-y: auto");
    expect(html).toContain("flex-direction: column");
  });

  it("スクリプトを含む", () => {
    const html = buildHtml([]);
    expect(html).toContain("<script>");
    expect(html).toContain("acquireVsCodeApi");
  });

  it("SVG スライドを直接埋め込む", () => {
    const svgs = ["<svg>test</svg>"];
    const html = buildHtml(svgs);
    expect(html).toContain("<svg>test</svg>");
    expect(html).toContain("Slide 1");
  });

  it("読み込み中 HTML を表示できる", () => {
    const html = buildLoadingHtml();
    expect(html).toContain("スライドを読み込み中...");
  });
});
