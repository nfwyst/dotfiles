---
name: merlin-model-card
description: 查询和管理 Seed/Titan 模型卡片 (Model Card)。支持查询模型列表、基础元信息、完整运行时配置、V2 模型更新和删除、修改历史、血缘资产、跨机房同步、HDFS 路径解析等。当用户需要了解模型信息、获取 model_evaluation_config、更新/删除模型、查看模型血缘或同步模型时使用。
---

# 模型卡片 (Model Card)

查询和管理 Seed/Titan 平台上的模型卡片。通过 `bytedcli merlin` 提供以下命令：

| 命令 | 用途                        |
|------|---------------------------|
| `bytedcli merlin model list` | 查询模型卡片列表，支持关键字、creator 过滤 |
| `bytedcli merlin model get-config` | 获取完整运行时配置（评估配置、推理参数等）     |
| `bytedcli merlin model get-v2-by-name` | 按模型名称查询 ModelCard 详情      |
| `bytedcli merlin model get-v2` | 使用 模型 SID 查询 ModelCard 详情 |
| `bytedcli merlin model update-v2` | 更新 ModelCard 信息           |
| `bytedcli merlin model delete` | 删除 ModelCard              |
| `bytedcli merlin model list-history` | 查询修改历史                    |
| `bytedcli merlin model get-lineage-asset` | 获取血缘资产信息                  |
| `bytedcli merlin model create-idc-sync-job` | 提交跨机房同步任务                 |
| `bytedcli merlin model list-idc-sync-record` | 查询同步记录                    |
| `bytedcli merlin model list-xgpt-server-launching-job` | 查询临时部署任务                  |
| `bytedcli merlin model parse-hdfs-detail-info-v2` | 解析 HDFS 路径上的模型信息          |

---

## 核心规则 (必须遵守)

### 1. 安全注意事项与脱敏
返回结果中可能包含 `api_key` 等敏感信息。**在向用户展示结果前，必须手动进行脱敏处理**：
- **脱敏规则**：只显示 `api_key` 的前 4 位 + `****`（如 `sk-a****`）。
- **禁止行为**：不要将完整 `api_key` 写入聊天记录、日志或共享文档。即使是调试也严禁展示。

### 2. URL 提取与校验 (必须前置校验)
在使用任何工具（如 `model get-config` 或 `model get-v2`）前：
- **第一步：格式检查**：必须立即校验用户提供的 URL 是否包含 `/model/modelcard/` 路径。
- **第二步：处理无效 URL**：如果 URL 不符合格式（如 `example.com` 或不相关的页面），**严禁调用任何 CLI 工具**。你必须立即回复用户，指出 URL 格式不正确，并提供正确示例（如 `https://seed.bytedance.net/model/modelcard/<sid>`）。

### 3. 最终回复要求 (禁止只展示 JSON)
工具执行成功后，**严禁只显示工具的原始 JSON 输出就结束任务**。你必须根据用户需求提取信息并回复：
- **提取逻辑**：从 `model_evaluation_config` 中提取用户关心的 `url`、`base_url`、`api_key`（需脱敏）等字段。
- **回复示例**：若用户问推理地址，应回复：“该模型的推理地址（base_url）为：`https://...`”。
- **确认完成**：只有在用自然语言正面回答了用户的所有问题并完成了所有要求（如脱敏）后，任务才算真正完成。

---

## 前置条件

```bash
bytedcli merlin --help &>/dev/null || \
  NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest merlin --help
```

如果出现认证错误（401/403），运行 `bytedcli auth login` 重新登录。

---

## 1. 查询模型卡片列表 (model list)

支持通过模型名称关键字、所有者、创建者等进行过滤，获取模型卡片列表。

### CLI 命令

```bash
bytedcli merlin model list --model-name-keyword doubao --creator chenyirong.33 --limit 10 --offset 0
```

### 参数说明

- `model_name_keyword`: 模型名称关键字过滤
- `creator`: 创建者过滤
- `limit`: 返回数量限制，默认10
- `offset`: 偏移量，默认0
- `skip_detail`: 是否只返回基本信息，避免接口过慢
- `review_passed`: 是否通过审核
- `like`: 是否收藏

---

## 2. 获取详细信息 (model get-v2)

使用模型 SID 获取详细的模型信息（包含名称、所有者、类型、创建时间等）。

```bash
bytedcli merlin model get-v2 --titan-model-sid '<SID>'
```

### 参数

| 参数 | 说明 | 必填 |
|------|------|------|
| `titan_model_sid` | 模型 SID | 是 |

---

## 4. 完整参数配置查询 (model get-config)

```bash
bytedcli merlin model get-config --model-sid '<model_sid>'
```

支持直接传入 ModelCard 页面 URL，自动提取 SID：

```bash
bytedcli merlin model get-config --model-sid 'https://seed.bytedance.net/model/modelcard/<model_sid>?tab=config_info'
```

### 参数

| 参数 | 说明 | 必填 | 默认值 |
|------|------|------|--------|
| `model_sid` | 模型 SID 或 ModelCard 页面 URL | 是 | - |
| `field` | 只返回指定字段（如 `model_evaluation_config`） | 否 | 返回全部字段 |
| `parse_eval_config` | 自动解析 `model_evaluation_config` JSON 字符串为结构化对象 | 否 | `false` |

### 关键返回字段

| 字段 | 说明 |
|------|------|
| `model_sid` | 模型 SID |
| `name` | 模型全名（含 namespace，如 `external-api/Doubao-2.0-lite`） |
| `model_type` | 模型类型（`EXTERNAL_API` / `CHECKPOINT` 等） |
| `model_source` | 模型来源 |
| `model_modal` | 模型模态（`MultiModal` / `Text` 等） |
| `model_evaluation_config` | **核心字段** — 评估配置（API 端点、重试策略、VIT 参数等），默认为 JSON 字符串，加 `parse_eval_config: true` 可解析 |
| `model_extra_config` | 额外配置 |
| `hdfs_path` | HDFS 模型路径（Checkpoint 类型时有值） |
| `owners` | 模型 owner 列表 |
| `model_url` | ModelCard 页面链接（自动注入） |

### 示例

```bash
# 查询完整配置
bytedcli merlin model get-config --model-sid qrpadva5216990840f

# 只查询评估配置（自动解析 JSON 字符串）
bytedcli merlin model get-config --model-sid qrpadva5216990840f --field model_evaluation_config --parse-eval-config
```

---

## 5. 按名称查询 V2 (model get-v2-by-name)

```bash
bytedcli merlin model get-v2-by-name --name '<model_name>'
```

---

## 6. 更新与删除 ModelCard

```bash
# 更新
bytedcli merlin model update-v2 --titan-model-sid '<sid>' --custom-suffix new-suffix --description 'updated description'

# 删除
bytedcli merlin model delete --sid '<sid>'
```

---

## 7. 修改历史

```bash
bytedcli merlin model list-history --model-sid '<sid>' --limit 10
```

---

## 8. 血缘资产

获取 ModelCard 的血缘资产信息，用于追踪模型来源和关联数据。

```bash
bytedcli merlin model get-lineage-asset --titan-model-sid '<sid>'
```

---

## 9. 跨机房同步

```bash
# 提交同步任务
bytedcli merlin model create-idc-sync-job --titan-model-sid '<sid>' --target-idc '<idc_name>'

# 查看同步记录
bytedcli merlin model list-idc-sync-record --titan-model-sid '<sid>'
```

---

## 10. HDFS 模型信息解析

通过 HDFS 路径、训练任务 URL 或基础路径解析模型详细信息。

```bash
bytedcli merlin model parse-hdfs-detail-info-v2 --hdfs-path hdfs://path/to/model
```

---

## 11. 临时部署任务

| 现象 | 原因和处理 |
|------|-----------|
| `bytedcli: command not found` | 先安装/升级 bytedcli |
| 401 / 403 认证错误 | 运行 `bytedcli auth login` 重新登录 |
| `cannot extract model_sid` | URL 格式非 ModelCard 页面或 SID 缺失。调用前需校验 URL 路径是否含 `/model/modelcard/`。 |
| `model_evaluation_config` 是字符串而非对象 | 加上 `"parse_eval_config": true` 参数自动解析 |

## 关联技能

- `merlin-recipe-eval-run`：对模型运行评估
- `merlin-insight`：模型能力分析与对比
