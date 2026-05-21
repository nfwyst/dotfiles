# FundEye 命令说明

## 当前覆盖能力

- `fundeye rule get --rule-id <rule-id>`
- `fundeye rule list`
- `fundeye rule create --product-type fullink|tcheck --rule-owner <owner> --params '<json>'`
- `fundeye biz get --path '<层级1-层级2>'`
- `fundeye diff get --diff-id <diff-id> --rule-id <rule-id>`
- `fundeye diff list --rule-id <rule-id>`
- `fundeye alarm list`

## 参数约定

### 规则详情

```bash
bytedcli --json fundeye rule get --rule-id 2604202570843580
```

- 对外参数统一使用 `--rule-id`
- 规则详情默认查询 `fullink`；查询 `tcheck` 时使用 `--product-type tcheck`
- 支持预留参数 `--site`、`--tenant`；当前仅占位，不影响请求逻辑
- `fullink` 保持原有返回结构，JSON 输出不包含 `layoutInfo`、`raw`
- `tcheck` 返回原生字段，例如 `rule_id`、`name`、`period`、`sql`、`receiver`

### 规则列表

```bash
bytedcli --json fundeye rule list \
  --product-type fullink \
  --name "demo-rule" \
  --owner "demo-owner" \
  --status RUNNING \
  --status DRAFT \
  --business-ownership demo-biz \
  --page 1 \
  --page-size 10
```

```bash
bytedcli --json fundeye rule list \
  --product-type tcheck \
  --name "demo-rule" \
  --owner "demo-owner" \
  --status unpublished \
  --status open \
  --period daily \
  --business-ownership demo-biz \
  --page 1 \
  --page-size 10
```

- 默认产品类型是 `fullink`
- CLI 使用重复 `--status`；`fullink` 映射成 `status`，`tcheck` 映射成 `status[]`
- `fullink` 支持：`--name`、`--owner`、`--status`、`--business-ownership`
- `tcheck` 额外支持：`--period`

### 创建规则

```bash
bytedcli --json fundeye rule create \
  --product-type fullink \
  --rule-owner "demo-owner" \
  --params '{"owner":"demo-owner","business_ownership":"demo-biz","lark_no":"oc_sample_chat_id","rule_type":"double_check","data_sources":[{"vertex":"up","db_name":"sample_upstream_db","tb_name":"sample_upstream_table","filter_logic":"status == 98","is_trigger":true},{"vertex":"down","db_name":"sample_downstream_db","tb_name":"sample_downstream_table","filter_logic":"pay_status == \"SUCCESS\"","is_trigger":true}],"join":[{"from_vertex":"up","to_vertex":"down","join_info":"[{\"upstream\":\"order_id\",\"downstream\":\"out_order_no\"}]"}],"check_logic":"[up.total_amount] == [down.total_amount]"}'
```

```bash
bytedcli --json fundeye rule create \
  --product-type tcheck \
  --rule-owner "demo-owner" \
  --params '{"data_source_type":"krypton","check_tables":["sample_db.sample_table_a","sample_db.sample_table_b"],"user_check_requirement":"关联键: sample_key_a 和 sample_key_b; 核对规则: 筛选上游有记录但下游无匹配记录的异常数据; 输出字段: sample_field_a、sample_field_b"}' \
  --poll \
  --max-retries 30 \
  --interval 3
```

- `--product-type` 支持 `fullink`、`tcheck`
- `--params` 必须是 JSON 对象字符串；CLI 会把它再次序列化成接口要求的字符串字段 `params`
- CLI 会自动把 `--params` 包装进请求体 `{"source":"platform_api","agent_task_list":[{"task_type":...,"rule_owner":...,"params":"..."}]}`，不需要手动传整段外层 JSON
- `fullink` 的 `--params` 至少包含：`owner`、`rule_type`、`data_sources`、`join`、`check_logic`
- `fullink` 的 `data_sources` 至少 2 个数据源；每项至少包含 `vertex`、`db_name`、`tb_name`
- `fullink` 的 `join[].join_info` 需要传字符串，字符串内容通常仍是 JSON 数组
- `tcheck` 的 `--params` 至少包含：`data_source_type`、`check_tables`、`user_check_requirement`
- `tcheck` 的 `check_tables` 必须是非空列表
- `--poll` 会继续调用 `query_tasks`，直到拿到 `rule_link`、失败或超时
- 轮询参数使用 `--max-retries`、`--interval`

### 业务归属查询

```bash
bytedcli --json fundeye biz get --path '财经-数据平台'
bytedcli --json fundeye biz get --path '财经-数据平台-会员'
```

- 用于把业务归属名称路径解析成 `business_ownership` ID
- `--path` 使用 `-` 拼接层级名称
- 兼容旧参数 `--name`
- 支持预留参数 `--site`、`--tenant`；当前仅占位，不影响请求逻辑
- JSON 输出包含 `businessOwnership.path` 与 `businessOwnership.value`
- 返回的 `value` 可直接透传给 `fundeye rule list --business-ownership`
- 业务归属树中可能存在同名节点；若只传单层标题，可能返回歧义错误，优先传完整路径

### diff 明细

```bash
bytedcli --json fundeye diff get \
  --diff-id "DOUBLE_DS_CHECK#^#0#^#demo-diff" \
  --rule-id 2601142357560097
```

- `fundeye diff` 是分组命令，详情查询必须走 `diff get`
- JSON 输出不再包含 `raw`

### diff 列表

```bash
bytedcli --json fundeye diff list \
  --rule-id 2601142357560097 \
  --product-type fullink \
  --rule-version 11 \
  --start "2026-04-21 00:00:00" \
  --end "2026-04-21 23:59:59" \
  --alarm-order-id "2601142357560097##20260421065000##1_2##11" \
  --page 1 \
  --page-size 20
```

- `--rule-id` 必填
- `fullink` 推荐显式传 `--rule-version`；未传时 CLI 会自动从规则详情解析最新版本
- 默认产品类型是 `fullink`；查 `tcheck` 差异列表时使用 `--product-type tcheck`
- 排查 `fullink` 告警、尤其按 `--alarm-order-id` 缩小时，推荐显式传 `--start`、`--end`
- `tcheck` 的 `--rule-version` 可省略；未传时默认按 `0` 请求上游
- `--alarm-order-id` 可选
- JSON 输出当前保留：
  - `diffs`
  - `current`
  - `page_size`
  - `total`
  - `actual_diff_cnt`
  - `diff_money`
  - `alarm_condition`
- JSON 输出不再包含：
  - 每个 diff item 的 `raw`

### 告警列表

```bash
bytedcli --json fundeye alarm list --page 1 --page-size 20
```

- 支持分页
- 支持按产品和优先级过滤

## 使用建议

- 需要机器可读结果时，优先加 `--json`
- 当用户只有业务归属名称路径时，推荐流程是：
  - `fundeye biz get --path '<层级1-层级2>'`
  - `fundeye rule list --business-ownership <value>`
- 先看告警，再查 diff 时，推荐流程是：
  - `fundeye alarm list`
  - `fundeye diff list`
  - `fundeye diff get`
