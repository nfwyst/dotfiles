# Safe Sample 新手指南

这份文档面向第一次接触 `bytedcli safe sample query_samples` 的同学，目标是帮你在最短路径内完成一次可复现的样本查询，并理解后续如何把自然语言需求翻译成可执行命令。

## 1. 这条命令是做什么的

`safe sample query_samples` 用来查询 Safe 样本库里的样本数据。

命令入口：

```bash
bytedcli safe sample query_samples (--condition-json <json> | --condition-file <path>) [options]
```

最常见的用途：

- 查某个业务租户下的样本
- 查某个 category 的样本
- 查某个 risk label 的样本
- 查最近 N 天的样本
- 拉出额外 feature 字段供后续分析

## 2. 先准备什么

第一次使用前，至少要准备下面几项：

1. 准备 SSO browser session 并登录 Safe
2. 确认 tenant
3. 确认 business-id / business-key
4. 确认查询条件 JSON

### 2.1 登录

Safe sample 查询最终使用 `bytedcli safe login` 保存的 Safe cookie。第一次使用时，先准备 SSO browser session，再换取 Safe cookie：

```bash
bytedcli auth login --session
bytedcli safe login
```

Agent 或 JSON 编排场景可以用非阻塞 SSO 流程启动 browser session：

```bash
bytedcli --json auth login --begin --session
bytedcli --json auth login --complete <token>
bytedcli safe login
```

如果已经有 Safe cookie，也可以直接注入：

```bash
bytedcli safe login --cookie "session=xxx"
```

如果没登录，常见报错通常是 `SAFE_AUTH_REQUIRED` 或 `401 No login`。遇到 `BDSSO cookie not found` 时，先补 `bytedcli auth login --session`，再执行 `bytedcli safe login`。

### 2.2 配默认值

如果你经常查同一个业务，建议先把默认值写到本地配置：

```bash
bytedcli safe config set --key tenant --value webcast
bytedcli safe config set --key business_id --value <business-id>
bytedcli safe config set --key business_key --value <business-key>
```

这样后面执行命令时可以少写很多参数。

## 3. 最小可用命令

先从最小可用版本开始：只查一个 category。

### 3.1 直接内联 JSON

```bash
bytedcli --json safe sample query_samples \
  --condition-json '{"category_id":"46180000002"}' \
  --tenant webcast \
  --business-id <business-id> \
  --business-key <business-key>
```

### 3.2 用 condition 文件

更推荐把条件放文件里。

`sample-condition.json`:

```json
{
  "category_id": "46180000002"
}
```

执行：

```bash
bytedcli --json safe sample query_samples \
  --condition-file ./sample-condition.json \
  --tenant webcast \
  --business-id <business-id> \
  --business-key <business-key>
```

为什么更推荐 `--condition-file`：

- JSON 更长时不容易写错引号
- 方便保存和复用
- 更适合复杂筛选条件

## 4. 最常见的 condition 长什么样

### 4.1 只按 category 查

```json
{
  "category_id": "46180000002"
}
```

### 4.2 按 category + risk label 查

```json
{
  "category_id": "46180000002",
  "risk_label_ids": {
    "<biz-scene-id>": ["<label-id>"]
  }
}
```

这里要注意：

- `risk_label_ids` 不是单个字符串
- 它是一个对象，key 是 `biz-scene-id`
- value 是 label id 数组

### 4.3 按近 7 天查

```json
{
  "category_id": "46180000002",
  "biz_time_range": {
    "from_time": 1700000000,
    "to_time": 1700604800
  }
}
```

### 4.4 按 category + label + 最近时间窗口查

```json
{
  "category_id": "46180000002",
  "risk_label_ids": {
    "<biz-scene-id>": ["<label-id>"]
  },
  "biz_time_range": {
    "from_time": 1700000000,
    "to_time": 1700604800
  }
}
```

这就是最接近真实业务查询的组合写法。

## 5. 怎么把自然语言翻成命令

这是大家最容易卡住的地方。

推荐把一句自然语言拆成 4 个槽位：

1. `tenant`
2. `category_id`
3. `risk_label_ids`
4. `biz_time_range`

### 5.1 一个完整例子

用户原话：

> 查询智能标注近7天的直播的图音综合流的封建迷信的数据

建议拆法：

- “直播” -> `tenant=webcast`
- “智能标注” -> source 倾向 `智能标注`
- “图音综合流” -> category 候选，当前文档按 webcast 智能标注综合流候选处理
- “封建迷信” -> 风险标签意图，最好落到明确的 `label id`
- “近7天” -> `biz_time_range`

然后组装成：

```json
{
  "category_id": "46180000002",
  "risk_label_ids": {
    "<biz-scene-id>": ["<label-id>"]
  },
  "biz_time_range": {
    "from_time": 1700000000,
    "to_time": 1700604800
  }
}
```

对应命令：

```bash
bytedcli --json safe sample query_samples \
  --condition-file ./sample-condition.json \
  --tenant webcast \
  --business-id <business-id> \
  --business-key <business-key>
```

### 5.2 什么时候可以直接查，什么时候要先停一下

可以直接查：

- tenant 已知
- category 已唯一确定
- label id 已知
- 时间范围已知
- business-id / business-key 已知

应该先停一下补信息：

- 只说“封建迷信”，但没给 `label id`
- 只说“直播智能标注样本”，但 category 还不唯一
- 没有 `business-id / business-key`

## 6. tenant 和 category 怎么找

### 6.1 tenant 常见映射

- 直播 -> `webcast`
- 视频 -> `community`
- 短剧 -> `playlet`

### 6.2 webcast 智能标注下常见 category 候选

当前参考文档中能看到这些候选：

- `322352800002` -> 图片流 / 智能标注
- `225892000002` -> 直播_通用 / 智能标注
- `46180000002` -> 综合事件流 / 智能标注
- `386096800002` -> 音频流 / 智能标注

注意：

- 不要只靠 tenant 猜 category
- 如果一个自然语言意图能匹配多个 category，优先列候选，不要静默乱选

## 7. 怎么拿到更多字段

很多时候你不只想看样本主字段，还想看样本的扩展特征。可以加 `--need-feature`。

例如：

```bash
bytedcli --json safe sample query_samples \
  --condition-file ./sample-condition.json \
  --need-feature dataset_id \
  --need-feature annotation_task_id \
  --need-feature room.room_id \
  --tenant webcast \
  --business-id <business-id> \
  --business-key <business-key>
```

这些字段会出现在结果里的 `samples[*].features` 中。

## 8. 新手最容易踩的坑

### 8.1 忘了登录

现象：401、未登录、`SAFE_AUTH_REQUIRED`

处理：

```bash
bytedcli auth login --session
bytedcli safe login
```

如果报错明确写着 `BDSSO cookie not found`，说明缺的是 SSO browser session，不是 sample 查询条件；先完成 `auth login --session`。

### 8.2 `condition-json` 写错

现象：JSON 解析报错。

处理：

- 优先改成 `--condition-file`
- 不要在 shell 里硬写太长 JSON

### 8.3 把 label 名当 label id 用

现象：查不到或返回不符合预期。

处理：

- `risk_label_ids` 里应该尽量放明确的 `label id`
- 如果只有中文标签名，先确认它对应哪个 id

### 8.4 business headers 漏了

现象：命令能跑，但接口侧报业务参数问题。

处理：

- 补 `--business-id`
- 补 `--business-key`

### 8.5 category 不唯一时直接拍脑袋选一个

这会导致“命令能跑，但结果不是你想要的”。

更稳妥的做法：

- 先缩小 material type
- 再缩小 source
- 如果还是多个候选，就先确认 category id

## 9. 推荐给新同学的工作流

### 第一步：先跑最小查询

先验证登录、tenant、business-id、business-key 都没问题。

### 第二步：再加 category

确认 category 后先做一次只按 category 的查询。

### 第三步：再加时间范围

比如加最近 3 天或最近 7 天。

### 第四步：最后再加 risk label

因为 label 往往最容易填错，最后加更容易定位问题。

## 10. 推荐的调试顺序

如果一条复杂命令查不出来，按这个顺序排查：

1. 能否只按 category 查出数据
2. 加上时间范围后还有没有数据
3. 加上 risk label 后还有没有数据
4. `--need-feature` 的字段名是否拼对了

## 11. 给 Agent / Skill 开发同学的建议

如果你要把自然语言自动翻译成 sample 查询，建议遵守这几个原则：

- 优先产出可执行命令，不要只给概念解释
- tenant/category/label/time-range 四个槽位要显式落盘
- 缺最关键参数时只追问最少的信息
- `business-id / business-key / biz-scene-id` 是高频缺失项
- category 不唯一时，返回候选，不要静默猜一个

## 12. 一条可直接复制的模板

`sample-condition.json`:

```json
{
  "category_id": "46180000002",
  "risk_label_ids": {
    "<biz-scene-id>": ["<label-id>"]
  },
  "biz_time_range": {
    "from_time": 1700000000,
    "to_time": 1700604800
  }
}
```

执行命令：

```bash
bytedcli --json safe sample query_samples \
  --condition-file ./sample-condition.json \
  --need-feature dataset_id \
  --need-feature annotation_task_id \
  --need-feature room.room_id \
  --tenant webcast \
  --business-id <business-id> \
  --business-key <business-key>
```

## 13. 继续看哪里

- `references/sample-api.md`：看 API 字段与返回结构
- `references/sample-guide.md`：看 tenant/category 映射和自然语言组装规则
- `SKILL.md`：看 skill 应该如何把自然语言请求转成命令
