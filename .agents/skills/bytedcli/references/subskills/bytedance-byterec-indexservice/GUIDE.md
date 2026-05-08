---
name: bytedance-byterec-indexservice
description: "Query Byterec index service product/config and the same component's Holmes IndexService proto/record debug capabilities via bytedcli. Use when tasks mention index service、product、config、proto、record、PSM、service ID、正排索引服务产品信息、正排索引服务配置、proto 查询、record 读取."
---

# bytedcli Byterec Indexservice

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
- Byterec indexservice 查询会跟随全局 `--site` / `BYTEDCLI_CLOUD_SITE` 自动选择控制面；默认使用 `BYTEDCLI_CLOUD_SITE=i18n-tt` 或 `--site i18n-tt`

## When to use

- 查询指定 PSM 的 Byterec index service 产品信息（`byterec indexservice product get`）
- 查询指定 PSM 的 Byterec index service 配置（`byterec indexservice config get`）
- 在 Holmes 平台查询同组件的 IndexService debug proto 列表/创建/详情（`holmes indexservice proto list` / `create` / `get`）
- 在 Holmes 平台按显式参数读取 IndexService record，并解码 `message`（`holmes indexservice record get`）
- 查询 record / group info 时，默认直接进入 Holmes proto / record 链路；不要先查询 `byterec indexservice product get`
- 需要机器可读结果供脚本或 Agent 继续处理时，使用 `--json`

## 前置条件

- Byterec 查询会跟随全局 `--site` / `BYTEDCLI_CLOUD_SITE` 路由控制面：`i18n*` -> VA/SG，`us-ttp*` -> US，`eu-ttp` -> EU，`cn` -> CN
- 首次使用前先按目标站点执行：`BYTEDCLI_CLOUD_SITE=<site> bytedcli auth login --session`
- 结构化输出使用 `--json`，并且它是全局参数，必须放在 `byterec` 或 `holmes` 之前
- `byterec indexservice product/config get` 要求显式传 `--psm`
- `holmes indexservice proto list` 支持显式传 `--service-id`，也支持传 `--psm` 自动解析 Holmes 自己的 `service_id`
- `holmes indexservice record get` 要求显式传 `--service-id` 或 `--psm` 二选一，以及 `--idc`、`--index-name`、`--key`、`--service-type`、`--shard-num`、`--pb`、`--pb-class`

## Quick start

```bash
# 查询 index service 产品信息
BYTEDCLI_CLOUD_SITE=i18n-tt bytedcli byterec indexservice product get --psm example.indexservice.psm

# 查询 index service 配置
BYTEDCLI_CLOUD_SITE=i18n-tt bytedcli byterec indexservice config get --psm example.indexservice.psm

# 以 JSON 形式获取产品信息
BYTEDCLI_CLOUD_SITE=i18n-tt bytedcli --json byterec indexservice product get --psm example.indexservice.psm

# 以 JSON 形式获取配置
BYTEDCLI_CLOUD_SITE=i18n-tt bytedcli --json byterec indexservice config get --psm example.indexservice.psm

# Holmes 平台：列 debug proto（显式 service_id）
bytedcli holmes indexservice proto list --service-id 12345

# Holmes 平台：按 PSM 自动解析 Holmes service_id 后再列 proto
bytedcli holmes indexservice proto list --psm sample.service.psm

# Holmes 平台：创建 debug proto
bytedcli holmes indexservice proto create --name SampleRecordPb --content 'message SampleRecordPb { string id = 1; }'

# Holmes 平台：按 proto_id 获取 proto classes
bytedcli holmes indexservice proto get --proto-id 1001

# Holmes 平台：读取 record 并自动尝试解码 message（显式 service_id）
bytedcli holmes indexservice record get \
  --service-id 12345 \
  --idc sg1 \
  --index-name sample_index:v1:sample \
  --key record-key \
  --service-type sample_service \
  --psm sample.psm \
  --shard-num 2 \
  --pb SampleRecordPb \
  --pb-class SampleRecordPb

# Holmes 平台：按 psm 自动解析 Holmes service_id，并把同一个 psm 写入 debug 请求
bytedcli holmes indexservice record get \
  --psm sample.service.psm \
  --idc sg1 \
  --index-name sample_index:v1:sample \
  --key record-key \
  --service-type sample_service \
  --shard-num 2 \
  --pb SampleRecordPb \
  --pb-class SampleRecordPb

# 等价的站点写法
bytedcli --site i18n-tt byterec indexservice product get --psm example.indexservice.psm
```

## 输出说明

- `product get` 文本输出包含：`Byterec Service`、`Byterec Resource Summary`、`Byterec Clusters`、`Byterec Authorization`、`Byterec Topology`、`Byterec Config Files`
- `config get` 文本输出包含：`Byterec Service`、`Byterec Platform Constants`、`Byterec Config Variables`、`Byterec Env Variables`、`Byterec Distribution Variables`、`Byterec Config Files`
- `holmes indexservice proto list` 文本输出包含最终使用的 `service_id`、可选的 `Resolved From PSM`，以及 proto 列表分页表格
- `holmes indexservice proto create` 文本输出包含 `Name`、`Request ID`、`Message`
- `holmes indexservice proto get` 文本输出包含 proto classes 表格
- `holmes indexservice record get` 文本输出包含最终使用的 `service_id`、可选的 `Resolved From PSM`、请求参数、record items，以及解码后的 `decoded_message` / `decode_error`
- JSON 模式会返回完整结构化结果，适合脚本或 Agent 继续处理
- 部分表格块在数据为空时可能不会显示，这是正常行为

## Authentication

Byterec indexservice 查询会复用目标控制面对应站点的登录态。首次使用前可执行：

```bash
BYTEDCLI_CLOUD_SITE=i18n-tt bytedcli auth login --session
BYTEDCLI_CLOUD_SITE=us-ttp bytedcli auth login --session
BYTEDCLI_CLOUD_SITE=eu-ttp bytedcli auth login --session
BYTEDCLI_CLOUD_SITE=cn bytedcli auth login --session
```

Holmes IndexService 调试命令使用 Holmes 的 BDSSO CAS 登录态。首次使用前可执行：

```bash
bytedcli auth login --session
```

如需先确认当前认证状态：

```bash
BYTEDCLI_CLOUD_SITE=i18n-tt bytedcli auth status
bytedcli auth status
```

## Notes

- 当前覆盖两组能力：Byterec 平台下的 `product get` / `config get`，以及 Holmes 平台下的 `proto list` / `proto create` / `proto get` / `record get`
- 查询 record / group info 时，默认直接进入 Holmes proto / record 链路；只有用户明确要求 product/config 平台信息时，才查询 Byterec `product get` / `config get`
- `byterec` 侧命令必须显式传 `--psm <psm>`
- Holmes 与 Byterec 是两套平台，`service_id` 不共用同一命名空间；在 Holmes 侧可用 `--psm` 自动解析 Holmes 自己的 `service_id`
- `holmes indexservice record get` 中，`--psm` 会同时用于解析 Holmes `service_id`，并作为 debug 请求体里的业务字段
- **当 Holmes record 查询存在多个可用 `pb` / `pb-class` 候选时，必须先向用户展示候选并使用 `AskUserQuestion` 让用户明确选择；不能由 Agent 自行决定最终使用哪一个**
  - **当 Holmes record 查询不存在可用 `pb` / `pb-class` 候选时，必须先向用户说明这个问题，并使用 `AskUserQuestion` 让用户选择新建 proto 还是检查其他参数是否出错**
  - **如果用户选择新建 proto，必须先向用户索取 proto 定义，再执行 `holmes indexservice proto create`；不能自行猜测或补写 proto 内容**
- `holmes indexservice record get` 不会自动 create proto，也不会自动查询 proto class；`--pb` 和 `--pb-class` 需要显式传入
- `--json` 是全局参数，必须放在 `byterec` 或 `holmes` 之前
- Byterec 侧会按全局站点自动路由控制面，默认建议使用 `i18n-tt`；Holmes 侧按默认 Holmes 站点执行
- 该 skill 只覆盖查询与调试读取，不涉及写业务配置

## References

- `skills/bytedance-byterec-indexservice/references/invocation.md`
- `skills/bytedance-byterec-indexservice/references/troubleshooting.md`
- `src/cli/commands/byterec/indexservice.ts`
- `src/cli/handlers/byterec/indexservice.ts`
