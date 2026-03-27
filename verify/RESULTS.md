# python-pptx-wasm 動作検証結果

検証日時: 2026-03-27T11:01:46.633Z
python-pptx-wasm: v0.0.1

## サマリ

| 結果 | 件数 |
|------|------|
| OK | 7 |
| NG | 0 |
| 合計 | 7 |

## 詳細

### ✅ 1. テンプレート PPTX の読み込み

**結果**: OK

```
デフォルトテンプレートから Presentation を作成できた
```

### ✅ 2. スライドレイアウト一覧の取得

**結果**: OK

```
11 件のレイアウトを取得:
    [0] Title Slide
    [1] Title and Content
    [2] Section Header
    [3] Two Content
    [4] Comparison
    [5] Title Only
    [6] Blank
    [7] Content with Caption
    [8] Picture with Caption
    [9] Title and Vertical Text
    [10] Vertical Title and Text
```

### ✅ 3. プレースホルダ情報の取得

**結果**: OK

```
プレースホルダ情報を取得:
    Layout[0] "Title Slide" - idx=0, type=3, name="Title 1"
    Layout[0] "Title Slide" - idx=1, type=4, name="Subtitle 2"
    Layout[0] "Title Slide" - idx=10, type=16, name="Date Placeholder 3"
    Layout[0] "Title Slide" - idx=11, type=15, name="Footer Placeholder 4"
    Layout[0] "Title Slide" - idx=12, type=13, name="Slide Number Placeholder 5"
    Layout[1] "Title and Content" - idx=0, type=1, name="Title 1"
    Layout[1] "Title and Content" - idx=1, type=7, name="Content Placeholder 2"
    Layout[1] "Title and Content" - idx=10, type=16, name="Date Placeholder 3"
    Layout[1] "Title and Content" - idx=11, type=15, name="Footer Placeholder 4"
    Layout[1] "Title and Content" - idx=12, type=13, name="Slide Number Placeholder 5"
    Layout[2] "Section Header" - idx=0, type=1, name="Title 1"
    Layout[2] "Section Header" - idx=1, type=2, name="Text Placeholder 2"
    Layout[2] "Section Header" - idx=10, type=16, name="Date Placeholder 3"
    Layout[2] "Section Header" - idx=11, type=15, name="Footer Placeholder 4"
    Layout[2] "Section Header" - idx=12, type=13, name="Slide Number Placeholder 5"
    Layout[3] "Two Content" - idx=0, type=1, name="Title 1"
    Layout[3] "Two Content" - idx=1, type=7, name="Content Placeholder 2"
    Layout[3] "Two Content" - idx=2, type=7, name="Content Placeholder 3"
    Layout[3] "Two Content" - idx=10, type=16, name="Date Placeholder 4"
    Layout[3] "Two Content" - idx=11, type=15, name="Footer Placeholder 5"
    Layout[3] "Two Content" - idx=12, type=13, name="Slide Number Placeholder 6"
    Layout[4] "Comparison" - idx=0, type=1, name="Title 1"
    Layout[4] "Comparison" - idx=1, type=2, name="Text Placeholder 2"
    Layout[4] "Comparison" - idx=2, type=7, name="Content Placeholder 3"
    Layout[4] "Comparison" - idx=3, type=2, name="Text Placeholder 4"
    Layout[4] "Comparison" - idx=4, type=7, name="Content Placeholder 5"
    Layout[4] "Comparison" - idx=10, type=16, name="Date Placeholder 6"
    Layout[4] "Comparison" - idx=11, type=15, name="Footer Placeholder 7"
    Layout[4] "Comparison" - idx=12, type=13, name="Slide Number Placeholder 8"
    Layout[5] "Title Only" - idx=0, type=1, name="Title 1"
    Layout[5] "Title Only" - idx=10, type=16, name="Date Placeholder 2"
    Layout[5] "Title Only" - idx=11, type=15, name="Footer Placeholder 3"
    Layout[5] "Title Only" - idx=12, type=13, name="Slide Number Placeholder 4"
    Layout[6] "Blank" - idx=10, type=16, name="Date Placeholder 1"
    Layout[6] "Blank" - idx=11, type=15, name="Footer Placeholder 2"
    Layout[6] "Blank" - idx=12, type=13, name="Slide Number Placeholder 3"
    Layout[7] "Content with Caption" - idx=0, type=1, name="Title 1"
    Layout[7] "Content with Caption" - idx=1, type=7, name="Content Placeholder 2"
    Layout[7] "Content with Caption" - idx=2, type=2, name="Text Placeholder 3"
    Layout[7] "Content with Caption" - idx=10, type=16, name="Date Placeholder 4"
    Layout[7] "Content with Caption" - idx=11, type=15, name="Footer Placeholder 5"
    Layout[7] "Content with Caption" - idx=12, type=13, name="Slide Number Placeholder 6"
    Layout[8] "Picture with Caption" - idx=0, type=1, name="Title 1"
    Layout[8] "Picture with Caption" - idx=1, type=18, name="Picture Placeholder 2"
    Layout[8] "Picture with Caption" - idx=2, type=2, name="Text Placeholder 3"
    Layout[8] "Picture with Caption" - idx=10, type=16, name="Date Placeholder 4"
    Layout[8] "Picture with Caption" - idx=11, type=15, name="Footer Placeholder 5"
    Layout[8] "Picture with Caption" - idx=12, type=13, name="Slide Number Placeholder 6"
    Layout[9] "Title and Vertical Text" - idx=0, type=1, name="Title 1"
    Layout[9] "Title and Vertical Text" - idx=1, type=2, name="Vertical Text Placeholder 2"
    Layout[9] "Title and Vertical Text" - idx=10, type=16, name="Date Placeholder 3"
    Layout[9] "Title and Vertical Text" - idx=11, type=15, name="Footer Placeholder 4"
    Layout[9] "Title and Vertical Text" - idx=12, type=13, name="Slide Number Placeholder 5"
    Layout[10] "Vertical Title and Text" - idx=0, type=1, name="Vertical Title 1"
    Layout[10] "Vertical Title and Text" - idx=1, type=2, name="Vertical Text Placeholder 2"
    Layout[10] "Vertical Title and Text" - idx=10, type=16, name="Date Placeholder 3"
    Layout[10] "Vertical Title and Text" - idx=11, type=15, name="Footer Placeholder 4"
    Layout[10] "Vertical Title and Text" - idx=12, type=13, name="Slide Number Placeholder 5"
```

### ✅ 4. プレースホルダへのテキスト注入

**結果**: OK

```
テキスト注入に成功:
    idx=0: "テストテキスト (idx=0)"
    idx=1: "テストテキスト (idx=1)"
```

### ✅ 5. プレースホルダへの画像注入

**結果**: OK

```
PicturePlaceholder.insert_picture() で画像注入に成功 (Layout[8] "Picture with Caption")
```

### ✅ 6. 出力 PPTX の保存

**結果**: OK

```
ファイル保存に成功: /Users/hirokisakabe/work/md-pptx.feature-verify-python-pptx-wasm/verify/output/verify-output.pptx (30360 bytes)
    ※ PowerPoint で開いて正常に表示されるか手動で確認してください
```

### ✅ 追加: 外部 PPTX の Uint8Array 読み込み

**結果**: OK

```
保存した PPTX を再読み込み: スライド数=2, レイアウト数=11
```

## 備考

- v0.0.1 で "part components are not implemented" と明記されている
- 出力 PPTX の確認は手動で PowerPoint を使って行う必要がある
- プレースホルダの `idx` / `type` は `placeholder_format` プロパティ経由で取得する必要がある（deprecated な `BasePlaceholder.idx` / `ph_type` は使用不可）
- PP_PLACEHOLDER_TYPE の主要な値: TITLE=1, BODY=2, CENTER_TITLE=3, SUBTITLE=4, OBJECT=7, SLIDE_NUMBER=13, FOOTER=15, DATE=16, PICTURE=18
