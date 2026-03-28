import { describe, it, expect } from "vitest";
import { buildHtml, buildLoadingHtml, buildErrorHtml } from "./slide-renderer";

describe("buildHtml", () => {
  it("有効な HTML を返す", () => {
    const html = buildHtml([]);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('<html lang="ja">');
    expect(html).toContain("</html>");
  });

  it("ズームツールバーを含む", () => {
    const html = buildHtml([]);
    expect(html).toContain("toolbar");
    expect(html).toContain('data-zoom="fit"');
    expect(html).toContain('data-zoom="50"');
    expect(html).toContain('data-zoom="75"');
    expect(html).toContain('data-zoom="100"');
    expect(html).toContain('data-zoom="150"');
  });

  it("スライド表示領域を含む", () => {
    const html = buildHtml([]);
    expect(html).toContain('id="container"');
    expect(html).toContain("slides-container");
  });

  it("SVG をスライドフレーム内に埋め込む", () => {
    const svgs = ['<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'];
    const html = buildHtml(svgs);
    expect(html).toContain("slide-frame");
    expect(html).toContain("slide-wrapper");
    expect(html).toContain("Slide 1");
    expect(html).toContain("<rect/>");
  });

  it("複数の SVG スライドを埋め込む", () => {
    const svgs = ["<svg>1</svg>", "<svg>2</svg>", "<svg>3</svg>"];
    const html = buildHtml(svgs);
    expect(html).toContain("Slide 1");
    expect(html).toContain("Slide 2");
    expect(html).toContain("Slide 3");
  });

  it("空の SVG 配列の場合に空状態メッセージを表示する", () => {
    const html = buildHtml([]);
    expect(html).toContain("スライドが見つかりません");
  });

  it("ズーム状態の保存・復元機能を含む", () => {
    const html = buildHtml([]);
    expect(html).toContain("getState");
    expect(html).toContain("setState");
  });

  it("デフォルトズームを指定できる", () => {
    const html = buildHtml([], "100");
    expect(html).toContain('data-zoom="100"');
  });
});

describe("buildLoadingHtml", () => {
  it("読み込み中メッセージを含む", () => {
    const html = buildLoadingHtml();
    expect(html).toContain("スライドを読み込み中...");
  });
});

describe("buildErrorHtml", () => {
  it("エラーメッセージを含む", () => {
    const html = buildErrorHtml("テストエラー");
    expect(html).toContain("テストエラー");
    expect(html).toContain("error-state");
  });

  it("HTML をエスケープする", () => {
    const html = buildErrorHtml('<script>alert("xss")</script>');
    expect(html).toContain(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
    );
  });
});
