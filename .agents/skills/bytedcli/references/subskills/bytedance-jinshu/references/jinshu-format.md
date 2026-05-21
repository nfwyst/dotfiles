# Jinshu DSL 写作速查

本文件用于 agent 生成 `bytedcli jinshu message preview/send` 的正文。锦书体使用接近 Markdown 的标记，但命令输入就是 Jinshu DSL，不需要再声明输入格式。

## 目录

- [写作流程](#写作流程)
- [推荐骨架](#推荐骨架)
- [标题](#标题)
- [二级标题](#二级标题)
- [文本](#文本)
- [链接](#链接)
- [标签](#标签)
- [按钮](#按钮)
- [图片](#图片)
- [高级 JSON 片段](#高级-json-片段)
- [分隔符](#分隔符)
- [Mention](#mention)
- [右侧附加元素](#右侧附加元素)
- [备注](#备注)
- [多语言](#多语言)
- [示例](#示例)
- [生成检查](#生成检查)

## 写作流程

1. 先生成简洁、静态的锦书体正文。
2. 多行内容写入本地文件，例如 `message.jinshu`。
3. 先执行预览：

```bash
bytedcli jinshu message preview --content-file ./message.jinshu
```

4. 用户确认后再发送：

```bash
bytedcli jinshu message send --content-file ./message.jinshu --yes
```

缺少图片、用户、跳转链接等真实业务值时，用占位符或向用户确认；不要编造 image key、用户 open ID 或内部 URL。

## 推荐骨架

```jinshu
#blue 卡片标题
> 副标题可选

## 小节标题
这里写正文，突出重点即可。

---

!b:p[查看详情](https://example.com)
```

## 标题

标题支持颜色、可选副标题、可选图标。推荐使用 `#color`，也支持 `$color`、`￥color`、`=color` 前缀；这些前缀和颜色没有绑定关系，可按视觉需要选择。`￥` 必须是全角人民币符号，半角 `¥` 不会被识别为标题前缀。

以下标题示例应作为卡片首行单独使用：

```jinshu
#blue 标题
> 副标题
```

```jinshu
$orange 另一种标题前缀
> 副标题
```

```jinshu
￥red 中文符号标题前缀
> 副标题
```

```jinshu
=green 等号标题前缀
> 副标题
```

```jinshu
#orange@<image_key> 带图标标题
> 副标题
```

可用颜色：

| 颜色值 | 中文/传统色别名 |
| --- | --- |
| `red` | 红、赩炽 |
| `blue` | 蓝、青冥 |
| `carmine` | 胭脂红、红踯躅 |
| `violet` | 紫罗兰、紫蒲 |
| `purple` | 紫、延维 |
| `indigo` | 靛、群青 |
| `wathet` | 吐绶蓝 |
| `turquoise` | 绿松石、铜青 |
| `yellow` | 黄、老茯神 |
| `orange` | 橙、郁金裙 |
| `grey` | 灰、青鸾 |
| `green` | 绿、翠虬 |
| `white` | 白、东方既白 |
| `none` / `empty` | 无标题底色 |

Agent 默认优先使用英文颜色值；只有用户要求传统色或中文风格时再使用别名。

标题内可加彩色标签：

```jinshu
#blue 发布提醒<orange:灰度><green:已验证>
```

## 二级标题

只用 `##` 表示二级标题，适合拆分段落。

```jinshu
## 变更内容
正文

## 影响范围
正文
```

## 文本

```jinshu
普通文本
**加粗文本**
*斜体文本*
~斜体文本~
~~删除线文本~~
<font color='green'>绿色文本</font>
<font color='red'>红色文本</font>
<font color='grey'>灰色文本</font>
```

居中文本：

```jinshu
--center--
居中展示的内容
--center-end--
```

需要原样展示 `*`、`~`、`>`、`<` 等特殊字符时，使用 HTML 转义，避免被当作格式符。

## 链接

```jinshu
[查看文档](https://example.com)
[侧边栏打开](https://example.com sidebar)
[新窗口打开](https://example.com window)
[工作台 Tab 打开](https://example.com tab)
[拨打电话](tel://12345678900)
```

多端链接只在用户明确要求时使用：

```jinshu
[打开页面](default: https://example.com pc: https://example.com/pc android: https://example.com/android ios: https://example.com/ios)
```

## 标签

正文标签可用长写法或短写法。短标签通常更适合 agent 生成。

```jinshu
!tag:red[高优先级]()
!t:orange[待确认]()
<green:已完成>
```

## 按钮

按钮里的中括号和小括号必须是英文半角。短写法是 `!b`，完整写法是：

```jinshu
!button:类型,尺寸,宽度[图标#颜色,标题](链接地址)
```

类型可留空，也可使用下列值：

| 类型 | 含义 |
| --- | --- |
| 留空 | 普通按钮 |
| `p` | 主按钮 |
| `d` | 警示按钮 |
| `text` | 文本按钮 |
| `pt` | 主文本按钮 |
| `dt` | 警示文本按钮 |
| `laser` | 镭射按钮 |
| `pf` | 主填充按钮 |
| `df` | 警示填充按钮 |

```jinshu
!b[普通按钮](https://example.com)
!b:p[主按钮](https://example.com)
!b:d[警示按钮](https://example.com)
!b:text[文本按钮](https://example.com)
!b:pt[主文本按钮](https://example.com)
!b:dt[警示文本按钮](https://example.com)
!b:laser[镭射按钮](https://example.com)
!b:pf[主填充按钮](https://example.com)
!b:df[警示填充按钮](https://example.com)
```

尺寸可用 `tiny`、`small`、`medium`、`large`。宽度可用 `default`、`fill` 或 `100px` 这类固定宽度。为空时使用默认值。

```jinshu
!b:p,small[小按钮](https://example.com)
!b:p,large[大按钮](https://example.com)
!b:p,medium,fill[整行主按钮](https://example.com)
!b:p,medium,200px[固定宽度按钮](https://example.com)
!b:,,fill[普通按钮，中尺寸，全宽](https://example.com)
```

按钮图标写在按钮标题前，用英文逗号分隔。`ICON_NAME` 必须替换为有效图标名；不确定图标枚举时不要生成图标按钮。

```jinshu
!b:p,medium,fill[ICON_NAME#red,带图标按钮](https://example.com)
```

## 图片

图片可以使用 HTTPS 图片地址或 Jinshu 返回的 image key。不要自行构造 image key。

```jinshu
![图片描述](https://example.com/image.png)
![图片描述](<image_key>)
![图片描述](<image_key>@360)
```

单图常用展示模式：

```jinshu
![](<image_key> size:stretch_without_padding)
![](<image_key> scale_type:fit_horizontal)
```

## 高级 JSON 片段

分栏、表格、图表等高级卡片结构使用 JSON 片段。只有用户明确要求这些能力时才生成，并且必须先 preview。

详细写法见 `jinshu-advanced-json.md`。JSON 片段用 `--json--` 和 `--json-end--` 包起来，命令输入仍然是 Jinshu DSL，不是独立 JSON 格式。

## 分隔符

分隔符必须单独占一行。

```jinshu
---
```

## Mention

用户 mention 需要真实 open ID。没有 open ID 时先向用户确认。

```jinshu
@<user_open_id> 正文内容
@all
```

实际写 `@all` 时后面保留一个普通空格。卡片转发后 mention 效果可能丢失，发送到目标会话前要先预览确认。

人员列表适合展示负责人、值班人等：

```jinshu
![](<user_open_id>,<another_user_open_id>@medium,show_name,show_avatar)
```

## 右侧附加元素

右侧小图标或按钮会挂到前面最近的 `##` 小节上。

```jinshu
## 任务状态
已完成 3/5 项
!extra:img[状态图标](<image_key>)

## 操作入口
点击查看详情
!extra:b:p[查看](https://example.com)
```

## 备注

```jinshu
--note--
备注内容，适合放补充说明、风险提示或语言切换说明。
--note-end--
```

## 多语言

只有用户明确要求多语言时使用。保持各语言块结构一致。

```jinshu
zh_cn #blue 发布提醒
中文内容

en_us #blue Release Notice
English content

ja_jp #blue リリース通知
日本語の内容
```

## 示例

发布提醒：

```jinshu
#orange 发布提醒<green:已验证>
> demo-service 今日发布窗口

## 变更内容
- 更新配置
- 验证回归

## 操作
!b:p[查看详情](https://example.com/release)
```

值班通知：

```jinshu
#blue 值班安排
> 本周排班

## 今日值班
@<user_open_id> 负责告警响应

## 说明
如需换班，请在群内确认后更新排班表。

---
!b[查看排班](https://example.com/oncall)
```

故障同步：

```jinshu
#red 故障同步<orange:处理中>
> sample-system 可用性异常

## 当前状态
<font color='red'>影响仍在持续</font>，排查集中在上游依赖。

## 下一步
1. 确认依赖恢复时间
2. 每 15 分钟同步一次进展

--note--
发送前确认影响范围和负责人信息。
--note-end--
```

## 生成检查

- 正文有明确标题和小节。
- 所有链接、图片 key、用户 ID 都来自用户或真实查询结果。
- 多行内容使用 `--content-file` 预览。
- 生成后先 preview，确认效果再 send。
