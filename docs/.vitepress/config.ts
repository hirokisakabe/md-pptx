import { defineConfig } from "vitepress";

export default defineConfig({
  title: "md-pptx",
  description:
    "Markdown から編集可能な PowerPoint ファイルを生成する VS Code 拡張",
  lang: "ja-JP",

  themeConfig: {
    nav: [
      { text: "ガイド", link: "/guide/syntax" },
      { text: "変更履歴", link: "/changelog" },
    ],

    sidebar: [
      {
        text: "ガイド",
        items: [
          { text: "Markdown 記法仕様", link: "/guide/syntax" },
          { text: "テンプレート準備ガイド", link: "/guide/template" },
          { text: "マッピング仕様", link: "/guide/mapping" },
        ],
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/hirokisakabe/md-pptx" },
    ],
  },
});
