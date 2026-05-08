---
name: merlin-recipe-eval-exercise-setup
description: 从 DataCard 创建评估 Exercise 及其版本。当需要将已上传的评估数据集注册为 Seed 平台的 Exercise 时使用。触发词：创建 exercise、create exercise、评估练习、exercise version、DataCard 转 exercise、注册评估练习、新建 exercise。即使用户没有明确说"创建 exercise"，只要涉及将 DataCard 表注册为可运行的评估 Exercise，都应使用本 skill。
---

# 创建评估 Exercise

通过 `bytedcli merlin exercise create` 和 `bytedcli merlin exercise create-version` 将已有的 DataCard 表注册为 Seed 平台的评估 Exercise。

## 前置条件

- `bytedcli merlin` 已安装并完成认证：

```bash
bytedcli merlin --help &>/dev/null || \
  NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest merlin --help
```

如果遇到 401/403 认证错误，运行 `bytedcli auth login` 重新登录。

- 目标 DataCard 表已存在（可通过 `merlin-eval-data-upload` skill 上传）

## 创建流程

分两步：先创建 Exercise，再创建 Exercise Version 关联 DataCard。

### 第一步：创建 Exercise

```bash
bytedcli merlin exercise create --name '<exercise 名称>'
```

返回 `exercise.sid`，后续步骤需要用到。参数较多时先运行 `bytedcli merlin exercise create --schema`，再按字段传 `--kebab-case` option；object/array 字段传 JSON-valued option。

| 参数 | 说明 | 必填 |
|------|------|------|
| `name` | Exercise 名称 | 是 |
| `owners` | 所有者列表，省略则自动从 JWT 获取当前用户 | 否 |

### 第二步：创建 Exercise Version

```bash
bytedcli merlin exercise create-version --exercise-sid '<第一步返回的 sid>' --name '<版本名称>' --warehouse-db '<库名>' --warehouse-table '<表名>'
```

返回 `exercise_version.sid`。参数较多时先运行 `bytedcli merlin exercise create-version --schema`，再按字段传 `--kebab-case` option；object/array 字段传 JSON-valued option。

| 参数 | 说明 | 必填 | 默认值 |
|------|------|------|--------|
| `exercise_sid` | Exercise 的 SID | 是 | - |
| `name` | 版本名称 | 是 | - |
| `warehouse_db` | DataCard 库名 | 是 | - |
| `warehouse_table` | DataCard 表名 | 是 | - |
| `warehouse_snapshot` | 快照 ID，省略则自动获取最新快照 | 否 | 自动检测 |
| `gitlab_project_id` | 评估代码 GitLab 项目 ID | 否 | `469628` |
| `branch` | 评估代码分支 | 否 | `master` |
| `commit_sha` | 评估代码 commit | 否 | `HEAD` |
| `config` | Exercise 配置 JSON 字符串 | 否 | `{}` |

查看完整参数 schema：

```bash
bytedcli merlin exercise create --schema
bytedcli merlin exercise create-version --schema
```

### 评估参数配置（config）

`config` 是可选的 JSON 字符串，用于控制评估任务的运行参数。不传则默认 `{}`，由评估框架使用默认配置。

常见的 FreeForm（通用评估）示例：

```json
{"metrics_name": "accuracy", "steps": 512, "trial_num": 2}
```

在 CLI 中传递时需要转义为字符串：`"config": "{\"metrics_name\":\"accuracy\",\"steps\":512}"`

获取完整配置说明：

- **CLI schema**：运行 `bytedcli merlin exercise create-version --schema` 查看实时参数定义
- **评测集范例**：参考 `evals/evals/modules/README.md` 中各评测类型（LLM/VLM/Agent/Speech）的模板目录
- **接入指南**：[评测集接入指南（Lark）](https://bytedance.larkoffice.com/wiki/FYsQw6pJmi0MT4kwkarcN6LQnwg)

## 完整示例

将 DataCard 表创建为 Exercise：

```bash
# 1. 创建 Exercise
bytedcli merlin exercise create --name '<exercise_name>'
# 返回: {"exercise": {"sid": "<exercise_sid>", ...}}

# 2. 创建 Exercise Version（快照自动获取）
bytedcli merlin exercise create-version --exercise-sid '<exercise_sid>' --name v1 --warehouse-db '<your_database>' --warehouse-table '<your_table>'
# 返回: {"exercise_version": {"sid": "<exercise_version_sid>", ...}}

# 3. 查看 Exercise
# https://seed.bytedance.net/evaluation/exercise/<exercise_sid>?version_sid=<exercise_version_sid>
```

## 解读创建结果

两步操作均为同步调用，返回即表示创建成功。

第一步返回的关键字段：

| 字段 | 说明 |
|------|------|
| `exercise.sid` | Exercise ID，第二步创建版本时必须传入 |
| `exercise.name` | Exercise 名称 |

第二步返回的关键字段：

| 字段 | 说明 |
|------|------|
| `exercise_version.sid` | 版本 ID，用于拼接 Exercise URL 和后续运行评估 |
| `exercise_version.exercise_sid` | 所属 Exercise 的 ID |
| `exercise_version.name` | 版本名称 |

向用户展示结果时，重点呈现：Exercise URL（由 `exercise.sid` + `exercise_version.sid` 拼接）。两个 sid 都需要保存，后续运行评估时会用到。

## Exercise 地址

创建完成后，Exercise 详情页地址为：

```
https://seed.bytedance.net/seed/evaluation/exercises/<exercise_sid>?version_sid=<exercise_version_sid>
```

## 常见问题

| 现象 | 原因和处理 |
|------|-----------|
| Exercise 名称重复报错 | 同名 Exercise 已存在，换一个名称；或用 `merlin-eval-query` skill 查询已有 Exercise 的 SID，直接创建新版本 |
| Snapshot 自动获取失败 | DataCard 表可能不存在或上传尚未完成，先通过 `merlin-eval-data-upload` 确认 DataCard 状态正常 |
| 401 / 403 认证错误 | 运行 `bytedcli auth login` 重新登录 |
| `exercise_sid` 无效 | SID 拼写错误或 Exercise 不存在，用 `merlin-eval-query` skill 查询正确的 SID |

## 相关 Skills

- **前置**: `merlin-eval-data-upload` — 上传评估数据到 DataCard
- **下一步**: `merlin-recipe-eval-run` — 在 Exercise 上运行评估
- **查询**: `merlin-eval-query` — 查询已有 Exercise 信息
