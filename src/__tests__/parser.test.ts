import { describe, it, expect } from "vitest";
import { parseMarkdown } from "../parser.js";

describe("parseMarkdown", () => {
  it("should parse a minimal document", () => {
    const result = parseMarkdown("# Hello");

    expect(result.frontMatter).toEqual({});
    expect(result.slides).toHaveLength(1);
    expect(result.slides[0].content[0]).toEqual({
      type: "heading",
      level: 1,
      runs: [{ text: "Hello" }],
    });
  });

  it("should parse front matter", () => {
    const input = `---
template: ./template.pptx
title: My Deck
author: Author
---

# Title`;

    const result = parseMarkdown(input);

    expect(result.frontMatter.template).toBe("./template.pptx");
    expect(result.frontMatter.title).toBe("My Deck");
    expect(result.frontMatter.author).toBe("Author");
  });

  it("should split slides on ---", () => {
    const input = `# Slide 1

Body 1

---

# Slide 2

Body 2`;

    const result = parseMarkdown(input);

    expect(result.slides).toHaveLength(2);
    expect(result.slides[0].content[0]).toEqual({
      type: "heading",
      level: 1,
      runs: [{ text: "Slide 1" }],
    });
    expect(result.slides[1].content[0]).toEqual({
      type: "heading",
      level: 1,
      runs: [{ text: "Slide 2" }],
    });
  });

  it("should apply headingDivider", () => {
    const input = `---
headingDivider: 2
---

## Slide 1

Body 1

## Slide 2

Body 2`;

    const result = parseMarkdown(input);

    expect(result.slides).toHaveLength(2);
  });

  it("should resolve layout from front matter as default", () => {
    const input = `---
layout: Title and Content
---

# Slide 1

---

# Slide 2`;

    const result = parseMarkdown(input);

    expect(result.slides[0].layout).toBe("Title and Content");
    expect(result.slides[1].layout).toBe("Title and Content");
  });

  it("should resolve local directive and inherit to following slides", () => {
    const input = `<!-- layout: Two Content -->

# Slide 1

---

# Slide 2

---

# Slide 3`;

    const result = parseMarkdown(input);

    expect(result.slides[0].layout).toBe("Two Content");
    expect(result.slides[1].layout).toBe("Two Content");
    expect(result.slides[2].layout).toBe("Two Content");
  });

  it("should resolve spot directive only for current slide", () => {
    const input = `<!-- layout: Two Content -->

# Slide 1

---

<!-- _layout: Title Slide -->

# Slide 2

---

# Slide 3`;

    const result = parseMarkdown(input);

    expect(result.slides[0].layout).toBe("Two Content");
    expect(result.slides[1].layout).toBe("Title Slide");
    expect(result.slides[2].layout).toBe("Two Content");
  });

  it("should extract presenter notes", () => {
    const input = `# Title

<!-- Remember to explain this -->

Body text`;

    const result = parseMarkdown(input);

    expect(result.slides[0].notes).toHaveLength(1);
    expect(result.slides[0].notes[0]).toBe("Remember to explain this");
  });

  it("should parse the full example from markdown-syntax.md", () => {
    const input = `---
template: ./templates/company.pptx
title: 2024年度 事業報告
author: 山田太郎
---

<!-- _layout: Title Slide -->

# 2024年度 事業報告

株式会社サンプル

<!-- 挨拶から始める。時間は30分。 -->

---

<!-- layout: Title and Content -->

## 売上サマリー

- 売上高: **120億円**（前年比 +15%）
- 営業利益: **18億円**（前年比 +22%）
- 新規顧客数: *350社*

<!-- 売上高の内訳を聞かれたらP5を参照 -->

---

## 主要施策の成果

1. 新製品Aのローンチ
   - 発売3ヶ月で目標の120%達成
2. 海外展開の加速
   - アジア3カ国に新規進出
3. DX推進
   - 社内業務の~~手作業~~自動化率 80%達成

---

<!-- _layout: Two Content -->

## 今後の展望

- 2025年度 売上目標: **150億円**
- 重点投資領域:
  - AI活用
  - サステナビリティ

![w:400](./images/roadmap.png)

---

<!-- _layout: Title Slide -->

# ご清聴ありがとうございました

お問い合わせ: [info@example.com](mailto:info@example.com)`;

    const result = parseMarkdown(input);

    // Front matter
    expect(result.frontMatter.template).toBe("./templates/company.pptx");
    expect(result.frontMatter.title).toBe("2024年度 事業報告");
    expect(result.frontMatter.author).toBe("山田太郎");

    // 5 slides
    expect(result.slides).toHaveLength(5);

    // Slide 1: Title Slide (spot)
    expect(result.slides[0].layout).toBe("Title Slide");
    expect(result.slides[0].content[0]).toEqual({
      type: "heading",
      level: 1,
      runs: [{ text: "2024年度 事業報告" }],
    });
    expect(result.slides[0].notes).toContain("挨拶から始める。時間は30分。");

    // Slide 2: Title and Content (local)
    expect(result.slides[1].layout).toBe("Title and Content");
    expect(result.slides[1].content[0]).toEqual({
      type: "heading",
      level: 2,
      runs: [{ text: "売上サマリー" }],
    });
    expect(result.slides[1].content[1].type).toBe("list");

    // Slide 3: Title and Content (inherited)
    expect(result.slides[2].layout).toBe("Title and Content");

    // Slide 4: Two Content (spot)
    expect(result.slides[3].layout).toBe("Two Content");
    // Has an image
    const imgElement = result.slides[3].content.find((e) => e.type === "image");
    expect(imgElement).toBeDefined();
    if (imgElement?.type === "image") {
      expect(imgElement.image.src).toBe("./images/roadmap.png");
      expect(imgElement.image.width).toBe(400);
    }

    // Slide 5: Title Slide (spot), layout reverts to Title and Content
    expect(result.slides[4].layout).toBe("Title Slide");

    // Slide 5 has a hyperlink
    const lastParagraph = result.slides[4].content.find(
      (e) => e.type === "paragraph",
    );
    expect(lastParagraph).toBeDefined();
    if (lastParagraph?.type === "paragraph") {
      const linkRun = lastParagraph.runs.find((r) => r.link);
      expect(linkRun).toBeDefined();
      expect(linkRun?.link).toBe("mailto:info@example.com");
    }
  });

  it("should handle empty input", () => {
    const result = parseMarkdown("");

    expect(result.frontMatter).toEqual({});
    expect(result.slides).toHaveLength(1);
    expect(result.slides[0].content).toHaveLength(0);
  });

  it("should handle front matter only", () => {
    const input = `---
template: ./t.pptx
---`;

    const result = parseMarkdown(input);

    expect(result.frontMatter.template).toBe("./t.pptx");
    expect(result.slides).toHaveLength(1);
  });
});
