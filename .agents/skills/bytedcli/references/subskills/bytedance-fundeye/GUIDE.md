---
name: bytedance-fundeye
description: "Operate FundEye / Fullink / TCheck workflows via bytedcli: get rule detail, list rules by product type, create rules, get diff detail, list diffs by rule and time window, and list alarms. Use this skill whenever the user mentions FundEye, Fullink, TCheck, reconciliation rules, rule creation, diff or alarm investigation, rule_id, diff_id, alarm_order_id, or wants to inspect or troubleshoot discrepancy records in these systems."
---

# bytedcli FundEye

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

- 查询 FundEye / Fullink 核对规则详情
- 按产品类型分页查询规则列表
- 查询某条 diff 的明细
- 按规则分页查询 diff 列表
- 查询告警列表
- 用户提到 `rule_id`、`diff_id`、`alarm_order_id`、核对规则、规则列表、差异详情、差异列表、FundEye、Fullink

## 能力范围

当前 skill 覆盖以下命令：

- 规则详情：`fundeye rule get`
- 规则列表：`fundeye rule list`
- 规则创建：`fundeye rule create`
- 差异详情：`fundeye diff get`
- 差异列表：`fundeye diff list`
- 告警列表：`fundeye alarm list`

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 首次使用前先确保 `bytedcli auth login` 已完成
- FundEye 请求依赖当前登录态自动补 `x-jwt-token` 和 `UserName`
- `fundeye diff list` 需要提供 `--rule-id`；排查 `fullink` 告警或按 `--alarm-order-id` 过滤时，推荐显式传 `--start`、`--end`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## 工作流约定

1. 需要机器可读输出时默认加 `--json`，并把它放在 `fundeye` 前面。
2. 规则详情优先用 `fundeye rule get --rule-id <id>`；如需兼容未来多站点路由，可额外携带预留参数 `--site`、`--tenant`，当前不会影响请求逻辑。
3. 规则列表优先用 `fundeye rule list --product-type fullink|tcheck`；默认查询 `fullink`，需要时再补 `--name`、`--owner`、`--status`、`--business-ownership`，`tcheck` 还支持 `--period`；`--site`、`--tenant` 当前仅占位。
4. 新建规则优先用 `fundeye rule create --product-type fullink|tcheck --rule-owner <owner> --params '<json>'`；`--params` 只传业务参数对象，CLI 会自动包装成 `source + agent_task_list` 请求体；需要等最终落规则时再加 `--poll`；`--site`、`--tenant` 当前仅占位。
5. diff 明细优先用 `fundeye diff get --diff-id <id> --rule-id <id>`。
6. diff 列表必须提供 `--rule-id`，默认查询 `fullink`；查 `tcheck` 时加 `--product-type tcheck`，其中 `--rule-version` 可省略且默认按 `0` 请求；排查 `fullink` 告警、尤其按 `--alarm-order-id` 缩小时，优先补 `--start`、`--end` 时间窗，再视情况加 `--rule-version`。
7. 如果服务端返回 500，优先保留 `request_id` 给后端排查；`fullink diff list` 还要先确认是否遗漏了时间窗。

## Quick start

```bash
# 规则详情
bytedcli --json fundeye rule get --rule-id 2604202570843580 --site boe --tenant demo-tenant

# 规则列表
bytedcli --json fundeye rule list \
  --product-type fullink \
  --status RUNNING \
  --owner demo-user \
  --site boe \
  --tenant demo-tenant \
  --page 1 \
  --page-size 10

# 使用 fullink 参数格式创建规则
bytedcli --json fundeye rule create \
  --product-type fullink \
  --rule-owner demo-user \
  --site boe \
  --tenant demo-tenant \
  --params '{"owner":"demo-user","business_ownership":"demo-biz","lark_no":"oc_sample_chat_id","rule_type":"double_check","data_sources":[{"vertex":"up","db_name":"sample_upstream_db","tb_name":"sample_upstream_table","filter_logic":"status == 98","is_trigger":true},{"vertex":"down","db_name":"sample_downstream_db","tb_name":"sample_downstream_table","filter_logic":"pay_status == \"SUCCESS\"","is_trigger":true}],"join":[{"from_vertex":"up","to_vertex":"down","join_info":"[{\"upstream\":\"order_id\",\"downstream\":\"out_order_no\"}]"}],"check_logic":"[up.total_amount] == [down.total_amount]"}'

# 使用 tcheck 参数格式创建规则并轮询到 rule_link
bytedcli --json fundeye rule create \
  --product-type tcheck \
  --rule-owner demo-user \
  --site boe \
  --tenant demo-tenant \
  --params '{"data_source_type":"krypton","check_tables":["sample_db.sample_table_a","sample_db.sample_table_b"],"user_check_requirement":"关联键: sample_key_a 和 sample_key_b; 核对规则: 筛选上游有记录但下游无匹配记录的异常数据; 输出字段: sample_field_a、sample_field_b"}' \
  --poll \
  --max-retries 30 \
  --interval 3

# diff 明细
bytedcli --json fundeye diff get \
  --diff-id "DOUBLE_DS_CHECK#^#0#^#demo-diff" \
  --rule-id 2601142357560097

# diff 列表
bytedcli --json fundeye diff list \
  --rule-id 2601142357560097 \
  --product-type fullink \
  --rule-version 11 \
  --start "2026-04-21 00:00:00" \
  --end "2026-04-21 23:59:59" \
  --page 1 \
  --page-size 20

# 告警列表
bytedcli --json fundeye alarm list --page 1 --page-size 20
```

## 常见工作流

### 1. 查看规则

- 使用 `fundeye rule get --rule-id <id>`
- 优先关注 `baseInfo` 和 `graphData`
- `layoutInfo`、内部原始 `raw` 不再对外输出

### 2. 按产品类型列规则

- 使用 `fundeye rule list --product-type fullink|tcheck`
- 默认查询 `fullink`
- `fullink` 支持 `--name`、`--owner`、重复 `--status`、`--business-ownership`
- `tcheck` 额外支持 `--period`

### 3. 创建规则

- CLI 的 `--params` 只传业务参数对象，不需要手动包 `source`、`agent_task_list`
- `fullink` 的 `--params` 至少包含：`owner`、`rule_type`、`data_sources`、`join`、`check_logic`
- `fullink` 的 `join[].join_info` 需要传字符串，字符串内容通常仍是 JSON 数组
- `tcheck` 的 `--params` 至少包含：`data_source_type`、`check_tables`、`user_check_requirement`
- 需要自定义幂等单号时加 `--out-biz-no`；需要轮询最终 `rule_link` 时加 `--poll`

### 4. 查看某条 diff

- 已知 `diff_id` 且知道所属规则时，用 `fundeye diff get`
- 如果只有告警单和规则信息，先用 `fundeye diff list` 缩小范围，再取具体 `diffId`

### 5. 按规则排查 diff

- 使用 `fundeye diff list --rule-id <id>`
- 默认查询 `fullink`，查 `tcheck` 时加 `--product-type tcheck`
- `tcheck` 的 `--rule-version` 可省略；未传时默认按 `0` 请求上游
- 排查 `fullink` 时优先补 `--start`、`--end` 时间窗
- 需要进一步缩小范围时，加 `--rule-version` 或 `--alarm-order-id`
- 对结果中的 `diffId` 再调用 `fundeye diff get`

### 6. 先看告警，再查 diff

- 先执行 `fundeye alarm list`
- 取返回里的 `alarmOrderId`、`ruleId`
- 再执行 `fundeye diff list --rule-id ... --alarm-order-id ... --start ... --end ...`

## Notes

- `--json` 是全局参数，必须放在 `fundeye` 前面，例如 `bytedcli --json fundeye rule get --rule-id ...`
- `fundeye rule create` 发送给服务端的请求体会自动包装成 `{"source":"platform_api","agent_task_list":[...]}`；CLI 侧 `--params` 只需要传单条任务里的业务参数对象
- `fundeye diff` 现在是分组命令；详情请用 `fundeye diff get`，列表请用 `fundeye diff list`
- `fundeye diff list` 缺少必填参数时会返回结构化 help JSON
- `fullink diff list` 排查告警时，优先显式传 `--start`、`--end`，再观察是否仍返回 `HTTP 500`
- 如果 diff/list 仍返回 `HTTP 500`，优先记录 `request_id`

## References

- `references/fundeye.md`
- `references/invocation.md`
- `references/troubleshooting.md`
