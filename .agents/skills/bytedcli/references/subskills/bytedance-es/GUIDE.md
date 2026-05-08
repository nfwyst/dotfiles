---
name: bytedance-es
description: "Query Elasticsearch via Kibana console API: execute ES DSL queries, search indices, and retrieve documents. Get ES index mapping. Submit ES index mapping update tickets with automatic field deletion detection. Use when tasks mention ES, Elasticsearch, Kibana queries, mapping changes, or log/data search."
---

# bytedcli ES

## 如何调用 bytedcli

先选择一种调用方式。下面所有示例默认直接写 `bytedcli`。

```bash
# 方式 1：直接用 npx 运行最新版
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest <command> [options]

# 方式 2：先全局安装，再直接调用 bytedcli
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npm install -g @bytedance-dev/bytedcli@latest
bytedcli <command> [options]
```

- 使用 `npx` 时，把后文示例里的 `bytedcli` 替换成 `NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest`
- 已全局安装时，直接按后文示例执行 `bytedcli ...`

## When to use

- ES 查询（通过 Kibana Console API）
- 索引搜索、文档检索
- ES DSL 查询执行
- 获取 ES 索引 mapping
- 提交 ES index mapping 修改工单（自动获取 oldMapping，字段删除检测）

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 需要鉴权时先登录：`bytedcli auth login`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

### ES 查询

```bash
# 执行 ES 查询（国内生产，默认站点）
bytedcli es search \
  --psm byte.es.kefu_data_center \
  --index kefu_incoming_ivr \
  --method POST \
  --idc hl \
  --query '{"query":{"match_all":{}}}'

# TikTok ROW（全局站点切到 i18n-tt）
bytedcli --site i18n-tt es search \
  --psm byte.es.kefu_data_center \
  --index kefu_incoming_ivr \
  --idc my \
  --query '{"query":{"match_all":{}}}'

# BOE 测试环境（全局站点切到 boe）
bytedcli --site boe es search \
  --psm byte.es.demo_psm \
  --index demo-index \
  --idc boe \
  --query '{"query":{"match_all":{}}}'
```

### 获取索引 Mapping

```bash
# 获取 ES 索引的 mapping（提交工单前建议先查看当前 mapping）
bytedcli es get-index-mapping \
  --psm byte.es.kefu_data_center \
  --index kefu_incoming_relation_test- \
  --idc hl
```

### 提交 Mapping 修改工单

```bash
# 提交 ES mapping 修改工单（自动获取 oldMapping 并检测字段删除）
bytedcli es submit-mapping-ticket \
  --psm byte.es.kefu_data_center \
  --index kefu_incoming_relation_test- \
  --idc hl \
  --new-mapping '{"channel_id":{"type":"text"},"new_field":{"type":"keyword"}}' \
  --assignee zhangsan

# 强制更新（跳过字段删除检测）
bytedcli es submit-mapping-ticket \
  --psm byte.es.kefu_data_center \
  --index kefu_incoming_relation_test- \
  --idc hl \
  --new-mapping '{"channel_id":{"type":"text"}}' \
  --assignee zhangsan \
  --force
```

## ⚠️ 重要注意事项

### 1. 仅支持单个索引

- **重要**：`--index` 参数**仅支持单个具体索引名称**
- **不支持**：索引模板（如 `kefu_incoming_ivr-*`）或索引别名（如 `kefu_incoming_ivr`）
- **原因**：mapping 更新是针对单个索引的操作，无法批量更新多个索引
- **建议**：如需更新多个索引，请逐个执行命令

### 2. 覆盖式更新（非增量合并）

- **重要**：`--new-mapping` 参数是**覆盖式更新**，不是增量合并
- 提交的 mapping 会**完全替换**当前索引的 mapping（仅 properties 部分）
- **建议流程**：
  1. 先执行 `es get-index-mapping` 查看当前 mapping
  2. 基于当前 mapping 修改，确保不会误删字段
  3. 再执行 `es submit-mapping-ticket` 提交工单

### 3. `--assignee` 参数（必填）

- **含义**：工单审批人，**不是发起人**
- **必填**：必须指定审批人
- **约束**：审批人与发起人必须不是同一个人
- **格式**：
  - 字节内部英文名（唯一 ID），如 `zhangsan`、`lisi`
  - 或字节邮箱，如 `zhangsan@bytedance.com`

### 3. 字段删除检测

- **默认行为**：对比新旧 mapping，若存在字段删除则报错终止
- **报错示例**：
  ```
  此次更新存在字段被删除，
  
  请先执行以下命令查看当前索引的 mapping：
    bytedcli es get-index-mapping --psm xxx --index xxx --idc xxx
  
  确认无误后，可使用 --force 参数强制执行更新。
  ```
- **跳过检测**：使用 `--force` 参数强制执行

### 4. `--new-mapping` 格式要求

- **必须是合法的 JSON 字符串**（properties 对象）
- 建议使用单引号包裹 JSON，避免 shell 转义问题
- 提交前建议用 `jq` 或其他工具校验 JSON 格式：
  ```bash
  # 校验 JSON 格式
  echo '{"channel_id":{"type":"text"}}' | jq .
  ```

## 参数说明

### es search

| 参数 | 必填 | 说明 |
|------|------|------|
| `--psm` | ✅ | Kibana 实例 PSM 标识（如 `byte.es.kefu_data_center`） |
| `--index` | ✅ | ES 索引名称 |
| `--query` | ✅ | ES DSL 查询 JSON 字符串 |
| `--method` | ⚪ | Kibana Console proxy 的 HTTP 方法；默认 `GET`，推荐使用 `GET`、`POST`、`PUT`、`HEAD` |
| `--idc` | ⚪ | 机房标识，用于选择 Kibana 路径段（如 `hl`、`my`、`boe`；默认 `hl`，`--site i18n-tt` 时默认 `my`） |
| `--size` | ⚪ | 返回文档数量 |
| `--from` | ⚪ | 分页偏移量 |
| `--output` | ⚪ | 输出模式：`console`（默认）或 `file` |
| `--output-file` | ⚪ | 输出文件路径（默认：`es-search-{psm}-{index}-{timestamp}.json`） |

### es get-index-mapping

| 参数 | 必填 | 说明 |
|------|------|------|
| `--psm` | ✅ | ES PSM，如 `byte.es.kefu_data_center` |
| `--index` | ✅ | ES 索引名称 |
| `--idc` | ✅ | 机房标识，用于选择网关域名（如 `hl`、`lf`、`boe`） |

### es submit-mapping-ticket

| 参数 | 必填 | 说明 |
|------|------|------|
| `--psm` | ✅ | ES PSM，如 `byte.es.kefu_data_center` |
| `--index` | ✅ | ES 索引名称 |
| `--idc` | ✅ | 机房标识，用于选择网关域名（如 `hl`、`lf`、`boe`） |
| `--new-mapping` | ✅ | 新的 mapping JSON 字符串（properties 对象，覆盖式更新） |
| `--assignee` | ✅ | 审批人英文名或邮箱（如 `zhangsan` 或 `zhangsan@bytedance.com`） |
| `--force` | ⚪ | 跳过字段删除检测，强制更新 |

## Notes

- 默认文本模式；结构化输出加 `--json`（全局选项，放在子命令之前）
- `es search` 的 Kibana host 跟随全局 `--site`；默认使用 `https://kibana-bytees.bytedance.net`，`--site i18n-tt` 时自动切到 `https://kibana-bytees-i18n.tiktok-row.net`，`--site boe` 时自动切到 `https://kibana-bytees-boe.bytedance.net`
- `es search` 未显式传 `--method` 时默认使用 `GET`；常见推荐值为 `GET`、`POST`、`PUT`、`HEAD`
- `es search` 未显式传 `--idc` 时默认用 `hl`；`--site i18n-tt` 时默认 `idc` 改为 `my`，`--site boe` 时默认 `idc` 改为 `boe`
- **鉴权方式**（根据命令不同）：
  - `es search`：使用 doas 获取 GDPR Token 进行认证
  - `es get-index-mapping`：使用 SSO JWT 认证
  - `es submit-mapping-ticket`：使用 SSO JWT 认证
- 首次使用会校验登录态，如未登录会触发命令行二维码，需扫码登录
- 登录成功后会缓存 Token，后续使用无需重复登录
- 支持标准 ES DSL 查询语法
- `--new-mapping` 必须是合法的 JSON 字符串，命令会自动校验格式

## References

- `references/es.md`
