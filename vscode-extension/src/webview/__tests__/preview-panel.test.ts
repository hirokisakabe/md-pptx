import { describe, it, expect } from "vitest";
import { buildShellHtml } from "../slide-renderer";

describe("buildShellHtml", () => {
  it("有効な HTML を返す", () => {
    const html = buildShellHtml();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('<html lang="ja">');
    expect(html).toContain("</html>");
  });

  it("ナビゲーションボタンを含む", () => {
    const html = buildShellHtml();
    expect(html).toContain('id="btn-prev"');
    expect(html).toContain('id="btn-next"');
    expect(html).toContain('id="indicator"');
  });

  it("スライド表示領域を含む", () => {
    const html = buildShellHtml();
    expect(html).toContain('id="viewport"');
    expect(html).toContain("slide-viewport");
  });

  it("スクリプトを含む", () => {
    const html = buildShellHtml();
    expect(html).toContain("<script>");
    expect(html).toContain("acquireVsCodeApi");
    expect(html).toContain("postMessage");
  });

  it("キーボードナビゲーションのイベントリスナーを含む", () => {
    const html = buildShellHtml();
    expect(html).toContain("ArrowLeft");
    expect(html).toContain("ArrowRight");
    expect(html).toContain("keydown");
  });

  it("メッセージハンドラが update メッセージを処理する", () => {
    const html = buildShellHtml();
    expect(html).toContain('msg.type === "update"');
    expect(html).toContain("msg.slides");
  });
});
