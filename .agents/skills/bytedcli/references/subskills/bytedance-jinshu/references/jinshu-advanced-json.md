# Jinshu 高级 JSON 片段

本文件只在用户明确要求分栏、表格、图表等高级卡片结构时读取。普通消息优先使用 `jinshu-format.md` 中的静态锦书体写法。

## 基本规则

JSON 片段用 `--json--` 和 `--json-end--` 包起来。中间必须是合法 JSON，不要写注释或尾随逗号。片段可以是一个 card element 对象，也可以是 card elements 数组。

```jinshu
--json--
{
  "tag": "markdown",
  "content": "高级 JSON 片段"
}
--json-end--
```

## 图片分栏

图片分栏使用 `img_combination`。`combination_mode` 常用取值：

- `double`: 双图混排。
- `triple`: 三图混排。
- `bisect`: 等分双列。
- `trisect`: 等分三列。

双图混排：

```jinshu
--json--
{
  "tag": "img_combination",
  "combination_mode": "double",
  "img_list": [
    { "img_key": "IMG_KEY_1" },
    { "img_key": "IMG_KEY_2" }
  ]
}
--json-end--
```

三图混排：

```jinshu
--json--
{
  "tag": "img_combination",
  "combination_mode": "triple",
  "img_list": [
    { "img_key": "IMG_KEY_1" },
    { "img_key": "IMG_KEY_2" },
    { "img_key": "IMG_KEY_3" }
  ]
}
--json-end--
```

等分双列：

```jinshu
--json--
{
  "tag": "img_combination",
  "combination_mode": "bisect",
  "img_list": [
    { "img_key": "IMG_KEY_1" },
    { "img_key": "IMG_KEY_2" },
    { "img_key": "IMG_KEY_3" },
    { "img_key": "IMG_KEY_4" }
  ]
}
--json-end--
```

等分三列：

```jinshu
--json--
{
  "tag": "img_combination",
  "combination_mode": "trisect",
  "img_list": [
    { "img_key": "IMG_KEY_1" },
    { "img_key": "IMG_KEY_2" },
    { "img_key": "IMG_KEY_3" }
  ]
}
--json-end--
```

## 图文分栏

图文并列或更复杂的多栏布局使用 `column_set`。下面示例是左右等分：左侧图片，右侧文字。

```jinshu
--json--
[
  {
    "tag": "column_set",
    "flex_mode": "bisect",
    "horizontal_spacing": "default",
    "columns": [
      {
        "tag": "column",
        "width": "weighted",
        "weight": 1,
        "vertical_align": "center",
        "elements": [
          {
            "tag": "img",
            "img_key": "IMG_KEY_1",
            "mode": "fit_horizontal",
            "alt": {
              "tag": "plain_text",
              "content": "示例图片"
            }
          }
        ]
      },
      {
        "tag": "column",
        "width": "weighted",
        "weight": 1,
        "vertical_align": "center",
        "elements": [
          {
            "tag": "markdown",
            "content": "**右侧标题**\n右侧说明文本\n<font color='green'>支持卡片 markdown</font>"
          }
        ]
      }
    ]
  }
]
--json-end--
```

## 表格

表格使用 `table`。适合结构化对比；字段名用英文稳定标识，展示名用面向用户的文案。

```jinshu
--json--
{
  "tag": "table",
  "page_size": 5,
  "row_height": "middle",
  "header_style": {
    "bold": true,
    "background_style": "grey",
    "lines": 1,
    "text_size": "heading",
    "text_align": "center"
  },
  "columns": [
    {
      "name": "item",
      "display_name": "事项",
      "data_type": "text"
    },
    {
      "name": "status",
      "display_name": "状态",
      "data_type": "options",
      "width": "100px"
    },
    {
      "name": "score",
      "display_name": "分数",
      "data_type": "number",
      "format": {
        "precision": 1
      },
      "width": "90px"
    }
  ],
  "rows": [
    {
      "item": "sample-a",
      "status": [{ "text": "完成", "color": "green" }],
      "score": 98.5
    },
    {
      "item": "sample-b",
      "status": [{ "text": "待确认", "color": "orange" }],
      "score": 76.0
    }
  ]
}
--json-end--
```

## 图表

图表使用 `chart`，`chart_spec` 按消息卡片图表规范传入。下面是最小折线图示例。

```jinshu
--json--
{
  "tag": "chart",
  "chart_spec": {
    "type": "line",
    "title": {
      "text": "趋势示例"
    },
    "data": {
      "values": [
        { "time": "10:00", "value": 8 },
        { "time": "11:00", "value": 13 },
        { "time": "12:00", "value": 11 }
      ]
    },
    "xField": "time",
    "yField": "value"
  }
}
--json-end--
```
