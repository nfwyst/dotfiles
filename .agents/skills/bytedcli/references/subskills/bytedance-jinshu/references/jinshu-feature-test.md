# Jinshu 功能测试文档

本文件用于逐项验证 `bytedcli jinshu message preview/send` 当前公开正文能力。默认先用 preview 验证，不要直接 live send。

## 测试入口

静态组合样例正文在 `references/jinshu-feature-test.jinshu`，不依赖图片 key 或用户 open ID。建议直接预览：

```bash
bytedcli jinshu message preview --content-file ./references/jinshu-feature-test.jinshu
```

图片、标题图标、mention、人员列表的专项样例在 `references/jinshu-feature-test-rich.jinshu`。替换变量后预览：

```bash
bytedcli jinshu message preview --content-file ./references/jinshu-feature-test-rich.jinshu
```

JSON 高级能力样例在 `references/jinshu-feature-test-json.jinshu`。替换图片变量后预览：

```bash
bytedcli jinshu message preview --content-file ./references/jinshu-feature-test-json.jinshu
```

确认预览效果后，可先 dry-run send：

```bash
bytedcli jinshu message send --content-file ./references/jinshu-feature-test.jinshu --dry-run
```

只有用户明确确认发送时才执行：

```bash
bytedcli jinshu message send --content-file ./references/jinshu-feature-test.jinshu --yes
```

## 变量

| 变量 | 用途 | 未提供时 |
| --- | --- | --- |
| `IMG_KEY_PLACEHOLDER` | 图片、标题图标、右侧图标 | 删除对应图片/图标用例 |
| `USER_OPEN_ID_PLACEHOLDER` | 用户 mention、人员列表 | 删除对应人员用例 |
| `ANOTHER_USER_OPEN_ID_PLACEHOLDER` | 人员列表第二人 | 删除人员列表用例 |
| `IMG_KEY_1` / `IMG_KEY_2` / `IMG_KEY_3` / `IMG_KEY_4` | JSON 图片分栏、图文分栏 | 替换为真实 image key |
| `https://example.com/...` | 链接和按钮跳转 | 可保留为占位链接 |

## 覆盖矩阵

| 功能 | 覆盖位置 | 预期结果 |
| --- | --- | --- |
| 一级标题颜色 | `.jinshu` 顶部标题 | 卡片标题显示蓝色主题 |
| 标题内彩色标签 | `.jinshu` 顶部标题 | 标题旁显示 Preview、DSL 标签 |
| 副标题 | `.jinshu` 顶部 `>` 行 | 副标题显示在标题下方 |
| 二级标题 | 各 `##` 小节 | 小节间距与层级清晰 |
| 加粗/斜体/删除线 | `1. 文本样式` | 文本样式按标记渲染 |
| 彩色文本 | `1. 文本样式` | green/red/grey 文本正常显示 |
| 特殊字符转义 | `1. 文本样式` | `*`、`~`、`>`、`<` 原样展示 |
| 居中文本 | `1. 文本样式` | center 区块居中 |
| 普通链接 | `2. 链接` | 链接可点击 |
| 链接打开方式 | `2. 链接` | sidebar/window/tab 写法不报错 |
| 多端链接 | `2. 链接` | default/pc/android/ios 写法不报错 |
| 彩色标签 | `3. 彩色标签` | 短写法、长写法都渲染为标签 |
| 按钮类型 | `4. 按钮` | 普通、主、警示、文本按钮样式不同 |
| 高级按钮类型 | `4. 按钮` | pt/dt/laser/pf/df 样式不报错 |
| 按钮尺寸/宽度 | `4. 按钮` | small、fill、固定宽度生效 |
| 分隔符 | `---` | 单独分隔线展示 |
| 图片 | `jinshu-feature-test-rich.jinshu` | 替换 image key 后图片显示 |
| 图片宽度 | `jinshu-feature-test-rich.jinshu` | `@360` 宽度生效 |
| 通栏单图 | `jinshu-feature-test-rich.jinshu` | `stretch_without_padding` 生效 |
| 完整单图 | `jinshu-feature-test-rich.jinshu` | `fit_horizontal` 生效 |
| 用户 mention | `jinshu-feature-test-rich.jinshu` | 替换 open ID 后可点击到用户 |
| 人员列表 | `jinshu-feature-test-rich.jinshu` | 头像和姓名按参数显示 |
| 右侧图标 | `jinshu-feature-test-rich.jinshu` | 图标挂到最近的二级标题右侧 |
| 右侧按钮 | `5. 右侧按钮` | 按钮挂到最近的二级标题右侧 |
| 备注 | `6. 备注` | note 区块独立展示 |
| JSON 片段 | `jinshu-feature-test-json.jinshu` | JSON card element 正常解析 |
| 图片分栏 | `jinshu-feature-test-json.jinshu` | double/trisect 图片组合正常展示 |
| 图文分栏 | `jinshu-feature-test-json.jinshu` | 图片和文本左右分栏展示 |
| 表格 | `jinshu-feature-test-json.jinshu` | 表头、选项、数字列正常展示 |
| 图表 | `jinshu-feature-test-json.jinshu` | 折线图正常展示 |

## 单独测试：标题图标

标题图标适合单独测，避免组合样例顶部标题强依赖 image key。

```jinshu
#orange@IMG_KEY_PLACEHOLDER 带图标标题<green:图标>
> 替换 image key 后预览

## 正文
确认标题左侧图标正常显示。
```

## 单独测试：标题前缀和传统色

以下片段需要分别作为卡片首行单独 preview；标题前缀放在正文段里会按普通文本显示。`￥` 必须是全角人民币符号，半角 `¥` 不生效。

```jinshu
$orange 美式前缀标题
> `$` 前缀测试
```

```jinshu
￥red 中文符号标题
> `￥` 前缀测试
```

```jinshu
=郁金裙 传统色标题
> 传统色别名测试
```

## 单独测试：按钮图标

`ICON_NAME` 必须替换为有效图标名；不确定图标枚举时不要生成图标按钮。

```jinshu
#blue 按钮图标测试
!b:p,medium,fill[ICON_NAME#red,带图标按钮](https://example.com/icon-button)
```

## 单独测试：@所有人

`@all` 可能影响目标会话，只在 preview 或明确的测试会话中验证。

```jinshu
#red @所有人测试<orange:谨慎>
> 只用于预览或测试群

## 内容
@all 这是一条 @所有人 测试消息。
```

## 单独测试：多语言

多语言建议单独成卡片测试，避免与普通组合样例互相干扰。

```jinshu
zh_cn #blue 发布提醒
中文内容

en_us #blue Release Notice
English content

ja_jp #blue リリース通知
日本語の内容
```

## 高级能力测试注意

- JSON/card 片段、表格、图表、复杂分栏属于高级能力；只在用户明确要求时生成。
- JSON 片段必须先 preview，确认没有被原样展示或解析失败后再 send。
- 非当前公开正文能力不写入测试流程。

## 通过标准

- preview 请求成功返回。
- 卡片主体不丢段、不把语法原样错误展示。
- 替换变量后，图片、mention、人员列表按预期渲染。
- send dry-run 输出的请求体语义与 preview 使用的正文一致。
