---
name: bytedance-safe-puzzle-feature-producer
description: 自动化生产 Puzzle 特征的端到端工作流。当用户请求"特征生产"、"生产一个特征"、"实现 XX 逻辑的特征"、"把 XX 做成 Puzzle 特征"、"Puzzle 脚本特征"、"Puzzle 数据源特征"时触发。覆盖:租户/实体-集合确认 → 相似特征复用检查 → 类型判定(脚本/数据源) → 脚本编写与编译 → 草稿创建 → 依赖解析与真实参数测算 → 修复循环 → 发布提单。不触发于:特征消费/打包/订阅/查值、策略/规则编排、非 Puzzle 平台(如其它特征工程平台)的特征管理。
version: 2.0.0
owner: safe-puzzle
updated_at: 2026-04-29
---

# Puzzle 特征生产自动化流程

Puzzle 是一个特征管理平台。**特征 = 某对象(实体/生产集合)的属性**,用于策略防控。本 Skill 只负责**脚本特征**与**数据源特征**的端到端生产,由 LLM 编写 1~2 段 Yaegi 脚本并跑通测算直至提单。

严格按本文件执行。遇到信息缺失必须向用户追问,**禁止编造**。所有 `bytedcli` 子命令签名见 [`references/commands.md`](references/commands.md),本主流程只写**动作名**不再重复命令原文。

---

## Scope(正反例)

| ✅ 触发                       | ❌ 不触发                       |
|----------------------------|-----------------------------|
| "帮我做一个 Puzzle 特征判断房间是否开播"  | "帮我看下特征 room_is_live 当前的值"  |
| "把这段逻辑做成一个 Puzzle 数据源特征"   | "查询下特征 room_asr_in_5m"的特征口径 |
| "生产一个集内特征,计算用户最近 7 天举报数"   | "创建一个特征打包"                  |
| "相似的 Puzzle 特征是否已经有,没有就新建" | "Hawkpro 里的策略规则怎么写"         |

---

## Flow at a Glance

```
[1] 基础信息确认   → tenant / scope / 语义&code&name
[2] 相似检索       → 命中且同 scope? → 直接复用,END
                   → 命中但跨 scope? → [3] 拷贝
                   → 无高分命中    → [4] 类型判定
[3] 特征拷贝(B)    → 子过程 S1 + S2,跳[7]
[4] 类型判定       → 脚本=[5] / 数据源=[6]
[5] 脚本特征新建   → S1 + S2 → [7]
[6] 数据源特征新建 → 数据源确认 + 2×S1 + S2 → [7]
[7] 测算&修复(阻塞)→ list-dependencies → 用户真实参数 → test
                   失败: 参数错→回[7]初 / 代码错→S3 / 权限→停
[8] 发布提单       → ticket create,返回 URL,END
```

> 完成前必须跑完 `## Completion Checklist`。

---

## 0. 全局规则

### 0.1 执行上下文(每个关键步骤结束后回显)

| 变量 | 来源 | 说明                                  |
|---|---|-------------------------------------|
| `feature` | 1 | 本次目标特征(可多条),含 code/name/value_type等 |
| `tenant` | 1 | 租户,所有命令统一 `--tenant <tenant>`       |
| `scope` | 1 | `entity`(1) 或 `collection`(2)       |
| `entity_id` / `collection_id` | 1 | 二选一                                 |
| `production_type` | 4 | `script` 或 `data_source`            |
| `src_feature_id` / `src_mm_feature_id` | 2(复用/拷贝) | 相似检索命中的源特征                          |
| `mm_feature_id` | 草稿创建后 | 后续测算/更新/提单均使用此 ID                   |
| `production_unit_code` | 草稿创建前 | `agent_` 前缀 + 随机后缀                  |
| `draft_created` | S2 完成后 | bool,**用于 S2 幂等自检**                 |

### 0.2 命令硬约束
- 所有命令必须带 `--tenant <tenant>`(仅 `feature similar-search` 要求全局搜索,不带)。
- 全局参数(`--site`/`--json`/`--http-debug`)与站点矩阵见 [`references/invocation.md`](references/invocation.md)。`--tenant` 不是全局参数,按各 `safe puzzle` 子命令要求显式传入。
- 脚本编译:`--content` **传文件路径**,不是脚本内容本身。
- 报错先查 [`references/troubleshooting.md`](references/troubleshooting.md)、[`references/troubleshooting-others.md`](references/troubleshooting-others.md), 再按 0.4 分桶修复。

### 0.3 命名规范
- `code`(特征 code / 生产单元 code):`^[a-z0-9_]+$`,不能以数字开头。
- `name`:`^[\u4e00-\u9fa5a-zA-Z0-9_\-\.\(\)]+$`。

### 0.4 重试分桶(替代旧的 10 次盲改)
脚本编译失败时分层修复:

| 次数 | 策略 |
|---|---|
| 1–3 次 | 按报错文本自动修复(拼写/缺包/类型断言) |
| 4–6 次 | **必须**回查 [`references/yaegi-syntax.md`](references/yaegi-syntax.md) 的对应章节(受限语法/可用库) |
| 7 次仍失败 | **立即停止**,向用户汇报报错栈 + 已尝试方案,等待裁决。严禁继续盲改。 |

### 0.5 草稿幂等(强约束)
- `feature create-draft` 在**一次生产流程**中只允许调用**一次**。
- S2 入口必须先读 `draft_created`:
  - 为 `true` → **强制走 S3**(`get-rule-conf --load-draft` + `update-rule-conf`)。
  - 为 `false` → 方可 `create-draft`,成功后立即置 `draft_created=true`。

### 0.6 脚本文件约定(沙盒)
所有脚本落盘到**当前工作目录下**,禁止使用 `/tmp`:
```
./scripts/<production_unit_code>_script.go    # 脚本特征
./scripts/<production_unit_code>_req.go       # 数据源请求脚本
./scripts/<production_unit_code>_resp.go      # 数据源结果脚本
```
S3 更新时必须复用同文件名,便于 diff。

### 0.7 用户交互阻塞点(必须先追问再继续)
1. 租户 / 实体或集合不明 
2. 特征生产语义/口径不明确
3. 相似检索命中 `score > 0.9` 时是否复用。
4. 无法判定 `production_type`。
5. 数据源 `psm/method` 无法自动确定。
6. 测算结果由用户判断是否符合预期。
7. 脚本编译按 0.4 抛出。

---

## 1. 确认基础信息

1. **租户**:问用户目标租户;不确定则列全表让用户选。
2. **scope**:问挂在实体还是生产集合下,记录对应 id+code。
3. **特征语义 / code / name / value_type**:总结特征生产语义,生成候选,如果不确定，让用户补充信息。最终**让用户确认后落入上下文表**。可一次生产多个。

完成后回显上下文表,进入步骤 2。

## 2. 相似特征复用检查

1. 从语义抽关键词 → 调用 `feature similar-search`(**全局**,不带 tenant)。
2. 决策矩阵:

| 情况 | 动作 |
|---|---|
| 无 `score > 0.9` | → 步骤 4 |
| 命中,用户放弃 | → 步骤 4 |
| 命中,同 tenant + 同 scope + 同实体/集合 | **分支 A**:直接复用,返回源特征 ID,流程结束 |
| 命中,跨 tenant 或跨 scope | **分支 B**:→ 步骤 3 |

命中后用 `feature get` 拿 `tenant/production_type/object/mm_feature_id`。

## 3. 特征拷贝(分支 B)

### 3.1 前置
`production_type ∈ {script, data_source}`,否则不支持 → 结束。

### 3.2 取源规则
`feature get-rule-conf --id <src_mm_feature_id>` → 返回结构参考 [`references/types.md`](references/types.md) 的 `GetScriptProdUnitData` / `GetDsFeatureData`。

### 3.3 按类型拷贝

**B-1 脚本特征**
1. 取 `script_editable_content` 落盘 → 子过程 S1。
2. S2 创建草稿(`CreateScriptProdUnitReq`),`output_features` 拷贝源,**去掉 id、`status=2`**。
3. → 步骤 7。

**B-2 数据源特征**
1. **数据源确认**:跨租户时从源 `ds.code` 解析 `psm/method`,`ds list --keyword <psm>` 找同 method;没有则 `ds create`。
2. 请求脚本、结果脚本各自落盘 → 2 次 S1。
3. S2 创建草稿(`CreateDsFeatureReq`)
4. → 步骤 7。

## 4. 判定特征类型

| 语义线索 | 判定 |
|---|---|
| 含 `psm` / `method` / RPC | 数据源 → 步骤 6 |
| 纯基于已有特征/参数计算 | 脚本 → 步骤 5 |
| 模棱两可 | 向用户确认 |

## 5. 脚本特征新建

1. `script generate-template --type common` 产出 Yaegi 模板。
2. 子过程 S1(脚本编写&编译)。
3. 子过程 S2(创建草稿,`CreateScriptProdUnitReq`)。
4. → 步骤 7。

## 6. 数据源特征新建

1. **确认/创建数据源**:按 `psm/method` 查 `ds list`;缺失则 `ds create`;语义无 psm 则 `ds similar-search` + `ds get-schema` 辅助;仍不定 → 问用户。
2. `ds get-schema` 拉 schema。
3. **请求脚本**:`script generate-template --type req --ds-type rpc` → S1。
4. **结果脚本**:`script generate-template --type resp --ds-type rpc` → S1。
5. S2(`CreateDsFeatureReq`),关键校验:
   - `ds.ds_type=2`(RPC)。
   - `ds_feature.feat_value_type=20`(map);但 `output_ds_features.*.feat_value_type` 需对齐实际特征类型。
   - ID 类字段用 **字符串**,避免 JSON number 精度丢失。
6. → 步骤 7。

## 7. 特征测算与修复(阻塞)

1. `feature list-dependencies --id <mm_feature_id>` 拿依赖参数。
2. **阻塞**:向用户展示依赖清单,索取真实值,回显"用户提供的真实参数表"后再执行。
3. 执行 `feature test`:
   - 实体:`--entity-params '{"live_id": {"type": 2, "val": "1"}, "room_id": {"type": 2, "val": "123"}}'`
   - 集内:`--pkg-params ...`
   - `type` 取值见 yaegi-syntax.md **值类型**小节。以上仅演示 JSON 结构,实际必须严格镜像 `list-dependencies` 输出,把所有必填参数一次性传全。
4. 展示完整输出(结果 + 报错)给用户,等待决策:
   - ✅ 通过 → 步骤 8;
   - 换参数再测 → 回 7.2;
   - 代码错 → **子过程 S3**,然后重测。
5. 失败分类:

| 报错类型 | 处理 |
|---|---|
| 权限不足 | 提示申请权限并暂停 |
| 参数错误 | 回 7.2 重新索取 |
| 代码错误 | S3 更新草稿 → 重测 |

## 8. 发布

测算无异常且用户确认逻辑正确 → `ticket create --id <mm_feature_id>` → 返回 Ticket URL/ID + 特征 code/name/value_type → 结束。

---

## 子过程

### S1:脚本编写
1. **模板**:所有脚本使用同一个 `package processor` 模板,见 [`references/yaegi-template.md`](references/yaegi-template.md)。**只允许修改 `/*----------start----------*/` 与 `/*----------end----------*/` 之间的片段。**
2. **返回值约定**:
   - 脚本特征 / 数据源结果脚本:`map[string]any` 的 key 必须是**特征 code**。
   - 数据源请求脚本:`map[string]any` 必须对齐数据源 schema(构造 RPC 请求体)。
3. **数据来源**(禁止依赖函数签名 `input`,RPC 结果脚本除外):
   - 实体参数:`entity.Param(ctx, ...)`,code 从 `entity get` 解析。
   - 集合参数:`pkg.Param(ctx, ...)`,code 从 `collection get` 解析。
   - 已有特征:`feature.Value(ctx, ...)`,code 从 `feature list` 或 `collection list-features` 解析。
4. **常见编码约束**:
   - 字符串输出特征 `default_value=""`。
   - `mapinterface` 包名为 `mapitf`,用 `mapitf.From(...)`/`mapitf.Fr(...)`。
   - 解析数字避免 `json.Unmarshal`,改用 `json.GetInt/GetFloat` 或 `sonic.Config{UseNumber:true}`。
   - 更多语法细节与可用库:yaegi-syntax.md;示例:yaegi-examples.md。
5. **编译**:落盘到 0.6 的约定路径 → 跑 `script compile` → 失败按 0.4 分桶修复。
6. **完成条件**:编译成功,且在 `/*----------end----------*/` 前**独立换一行**,不要把代码与结束标记写同一行。

### S2:创建草稿
0. 前置自检:`draft_created==true` → 转 S3。
1. `feature create-draft --type <script|ds> --content <json_file>`。
2. 请求体结构见 [`references/types.md`](references/types.md) 的 `CreateScriptProdUnitReq` / `CreateDsFeatureReq`(TypeScript 形式)。
3. `production_unit.code` = `agent_` + 随机后缀(符合 0.3);`production_unit.name` = code + "生产单元"。
4. 记录返回的 `mm_feature_id`,置 `draft_created=true`。

### S3:更新草稿
1. `feature get-rule-conf --id <mm_feature_id> --load-draft` → 返回结构 `GetScriptProdUnitData` / `GetDsFeatureData`(**含 `version`,后续必传**)。
2. 按 `UpdateScriptProdUnitReq` / `UpdateDsFeatureReq` 构造请求体。
3. 修改脚本代码 → 复用 0.6 的同一脚本文件 → 执行 S1。
4. `feature update-rule-conf --id <mm_feature_id> --content <请求体文件>`。

---

## Completion Checklist(发布前自检)

- [ ] 上下文表所有变量已回显且无空缺
- [ ] 相似检索已执行,复用/拷贝/新建路径与用户确认一致
- [ ] `production_unit.code` 以 `agent_` 开头且符合 0.3
- [ ] 脚本文件落盘路径符合 0.6,编译已通过
- [ ] `feature test` 使用**用户提供的真实参数**,已让用户确认结果
- [ ] `create-draft` 仅调用 1 次,后续修改走 `update-rule-conf`
- [ ] 已向用户返回 Ticket URL + 特征 code/name/value_type

---

## 参考文件索引

| 文件 | 用途 |
|---|---|
| [`references/commands.md`](references/commands.md) | bytedcli 子命令速查(唯一命令 SSOT) |
| [`references/invocation.md`](references/invocation.md) | 安装/站点矩阵/JSON 输出/HTTP 调试 |
| [`references/troubleshooting.md`](references/troubleshooting.md) | 报错排查(认证/版本) |
| [`references/troubleshooting-others.md`](references/troubleshooting-others.md) | 报错排查(编译/测算) |
| [`references/types.md`](references/types.md) | 草稿请求/响应结构(TypeScript) |
| [`references/yaegi-template.md`](references/yaegi-template.md) | Yaegi 完整模板与 import 清单(模板 SSOT) |
| [`references/yaegi-syntax.md`](references/yaegi-syntax.md) | Yaegi 语法限制 / 可用库 / 值类型 |
| [`references/yaegi-examples.md`](references/yaegi-examples.md) | 脚本示例库(Process 片段) |
