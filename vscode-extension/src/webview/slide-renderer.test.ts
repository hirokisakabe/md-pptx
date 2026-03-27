import { describe, it, expect } from "vitest";
import {
  buildSlideRenderData,
  resolveBackground,
  resolveContentImages,
} from "./slide-renderer";
import type { SlideData, BackgroundExtractionResult } from "md-pptx";

describe("buildSlideRenderData", () => {
  it("背景・画像変換なしでスライドデータを変換する", () => {
    const slides: SlideData[] = [
      {
        layout: "Title Slide",
        content: [
          { type: "heading", level: 1, runs: [{ text: "Hello" }] },
          { type: "paragraph", runs: [{ text: "World" }] },
        ],
        notes: ["note1"],
        directives: [],
      },
    ];

    const result = buildSlideRenderData(slides);

    expect(result).toHaveLength(1);
    expect(result[0].layout).toBe("Title Slide");
    expect(result[0].backgroundDataUrl).toBeUndefined();
    expect(result[0].content).toHaveLength(2);
    expect(result[0].notes).toEqual(["note1"]);
  });

  it("背景画像を含むスライドデータを変換する", () => {
    const slides: SlideData[] = [
      {
        layout: "MyLayout",
        content: [],
        notes: [],
        directives: [],
      },
    ];

    const backgrounds: BackgroundExtractionResult = {
      masters: [
        {
          masterName: "Master",
          contentType: "image/png",
          data: new Uint8Array(),
          dataUrl: "data:image/png;base64,master",
        },
      ],
      layouts: [
        {
          layoutName: "MyLayout",
          contentType: "image/png",
          data: new Uint8Array(),
          dataUrl: "data:image/png;base64,layout",
        },
      ],
    };

    const result = buildSlideRenderData(slides, backgrounds);

    expect(result[0].backgroundDataUrl).toBe("data:image/png;base64,layout");
  });

  it("resolveImageSrc で画像パスを変換する", () => {
    const slides: SlideData[] = [
      {
        content: [
          { type: "image", image: { src: "img/photo.png", alt: "photo" } },
          { type: "paragraph", runs: [{ text: "text" }] },
        ],
        notes: [],
        directives: [],
      },
    ];

    const resolveImageSrc = (src: string) => `https://webview/${src}`;
    const result = buildSlideRenderData(slides, undefined, resolveImageSrc);

    expect(result[0].content[0]).toEqual({
      type: "image",
      image: { src: "https://webview/img/photo.png", alt: "photo" },
    });
    // 非画像要素はそのまま
    expect(result[0].content[1]).toEqual({
      type: "paragraph",
      runs: [{ text: "text" }],
    });
  });

  it("data URL の画像は変換しない", () => {
    const slides: SlideData[] = [
      {
        content: [
          {
            type: "image",
            image: { src: "data:image/png;base64,abc", alt: "inline" },
          },
        ],
        notes: [],
        directives: [],
      },
    ];

    const resolveImageSrc = (src: string) => `resolved:${src}`;
    const result = buildSlideRenderData(slides, undefined, resolveImageSrc);

    expect(result[0].content[0]).toEqual({
      type: "image",
      image: { src: "data:image/png;base64,abc", alt: "inline" },
    });
  });

  it("http URL の画像は変換しない", () => {
    const slides: SlideData[] = [
      {
        content: [
          {
            type: "image",
            image: { src: "https://example.com/img.png" },
          },
        ],
        notes: [],
        directives: [],
      },
    ];

    const resolveImageSrc = (src: string) => `resolved:${src}`;
    const result = buildSlideRenderData(slides, undefined, resolveImageSrc);

    expect(result[0].content[0]).toEqual({
      type: "image",
      image: { src: "https://example.com/img.png" },
    });
  });
});

describe("resolveBackground", () => {
  const backgrounds: BackgroundExtractionResult = {
    masters: [
      {
        masterName: "Master1",
        contentType: "image/png",
        data: new Uint8Array(),
        dataUrl: "data:image/png;base64,master1",
      },
    ],
    layouts: [
      {
        layoutName: "Title Slide",
        contentType: "image/jpeg",
        data: new Uint8Array(),
        dataUrl: "data:image/jpeg;base64,titleslide",
      },
    ],
  };

  it("レイアウト固有の背景を優先する", () => {
    const slide: SlideData = {
      layout: "Title Slide",
      content: [],
      notes: [],
      directives: [],
    };
    expect(resolveBackground(slide, backgrounds)).toBe(
      "data:image/jpeg;base64,titleslide",
    );
  });

  it("レイアウト固有の背景がなければマスターにフォールバック", () => {
    const slide: SlideData = {
      layout: "Other Layout",
      content: [],
      notes: [],
      directives: [],
    };
    expect(resolveBackground(slide, backgrounds)).toBe(
      "data:image/png;base64,master1",
    );
  });

  it("レイアウト未指定でもマスターにフォールバック", () => {
    const slide: SlideData = {
      content: [],
      notes: [],
      directives: [],
    };
    expect(resolveBackground(slide, backgrounds)).toBe(
      "data:image/png;base64,master1",
    );
  });

  it("backgrounds が undefined なら undefined を返す", () => {
    const slide: SlideData = {
      layout: "Title Slide",
      content: [],
      notes: [],
      directives: [],
    };
    expect(resolveBackground(slide, undefined)).toBeUndefined();
  });

  it("masters も layouts も空なら undefined を返す", () => {
    const slide: SlideData = {
      content: [],
      notes: [],
      directives: [],
    };
    expect(
      resolveBackground(slide, { masters: [], layouts: [] }),
    ).toBeUndefined();
  });
});

describe("resolveContentImages", () => {
  const resolver = (src: string) => `/resolved/${src}`;

  it("画像要素のパスを変換する", () => {
    const result = resolveContentImages(
      { type: "image", image: { src: "photo.png", alt: "test", width: 100 } },
      resolver,
    );
    expect(result).toEqual({
      type: "image",
      image: { src: "/resolved/photo.png", alt: "test", width: 100 },
    });
  });

  it("非画像要素はそのまま返す", () => {
    const element = {
      type: "paragraph" as const,
      runs: [{ text: "hello" }],
    };
    expect(resolveContentImages(element, resolver)).toBe(element);
  });

  it("data: URL はそのまま返す", () => {
    const element = {
      type: "image" as const,
      image: { src: "data:image/png;base64,abc" },
    };
    expect(resolveContentImages(element, resolver)).toBe(element);
  });

  it("http URL はそのまま返す", () => {
    const element = {
      type: "image" as const,
      image: { src: "http://example.com/img.png" },
    };
    expect(resolveContentImages(element, resolver)).toBe(element);
  });
});
