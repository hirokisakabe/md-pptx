import { describe, it, expect } from "vitest";
import { buildShellHtml } from "./slide-renderer";

describe("buildShellHtml", () => {
  it("有効な HTML を返す", () => {
    const html = buildShellHtml();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('<html lang="ja">');
    expect(html).toContain("</html>");
  });

  it("ナビゲーション要素を含まない", () => {
    const html = buildShellHtml();
    expect(html).not.toContain('id="btn-prev"');
    expect(html).not.toContain('id="btn-next"');
    expect(html).not.toContain('id="indicator"');
    expect(html).not.toContain("nav-bar");
  });

  it("スライド表示領域を含む", () => {
    const html = buildShellHtml();
    expect(html).toContain('id="viewport"');
    expect(html).toContain("slide-viewport");
  });

  it("縦スクロール用のスタイルを含む", () => {
    const html = buildShellHtml();
    expect(html).toContain("overflow-y: auto");
    expect(html).toContain("flex-direction: column");
  });

  it("スクリプトを含む", () => {
    const html = buildShellHtml();
    expect(html).toContain("<script>");
    expect(html).toContain("acquireVsCodeApi");
    expect(html).toContain("postMessage");
  });

  it("全スライドを一括レンダリングする", () => {
    const html = buildShellHtml();
    expect(html).toContain("slides.map");
    expect(html).not.toContain("currentIndex");
    expect(html).not.toContain("navigate");
  });

  it("メッセージハンドラが update メッセージを処理する", () => {
    const html = buildShellHtml();
    expect(html).toContain('msg.type === "update"');
    expect(html).toContain("msg.slides");
  });
});
