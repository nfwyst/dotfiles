# Megatron CLI Reference

Megatron 是 Spark 应用管理平台，提供 Spark 应用元数据查询、应用搜索、队列使用情况查询和用户队列配额查询能力。

## Routing

- 使用全局 `--site` 选择站点：`cn`、`i18n-tt`、`eu-ttp`、`us-ttp`、`us-ttp-bdee`、`us-ttp-usts`、`boe`。
- 使用 `-r, --region <region>` 或全局 `--vregion <vregion>` 选择站点内 Megatron 虚拟区域。
- `i18n-tt` 默认 `sg`；常用值：`sg`、`va`、`us-west`、`us_south_west`、`eu`、`id`、`mygp`。
- `eu-ttp` 默认 `i18n_gcp`；常用值：`eu_ttp`、`i18n_gcp_gp`、`i18n_gcp`、`eu_ttp_no`。
- `boe` 默认 `boe`；常用值：`boe`、`boei18n`。
- `cn`、`us-ttp`、`us-ttp-bdee`、`us-ttp-usts` 不接受 `-r/--region`（站点本身唯一定位区域）。

## Commands

### app get

```bash
bytedcli megatron app get --app-ids <appIds...> [-r <region>]
```

- `--app-ids <appIds...>`：Application IDs，支持逗号或空格分隔。
- `-r, --region <region>`：Megatron 虚拟区域。

Examples:

```bash
bytedcli megatron app get --app-ids application_1234567890000_000001
bytedcli --site i18n-tt megatron app get --app-ids application_1234567890000_000001,application-abc-123 -r sg
bytedcli --site i18n-tt megatron app get --app-ids application_1234567890000_000001 application-abc-123 -r va
```

### app search

```bash
bytedcli megatron app search [filters] [-r <region>]
```

Filters: `--app-id`、`--app-name`、`--real-name`、`--me`、`--state`、`--application-type`、`--fuzzy <bool>`、`--page-size <n>`。

- `--state` 取值：`SUBMITTED`、`ACCEPTED`、`RUNNING`、`NEW_SAVING`、`NEW`、`FINISHED`、`FAILED`、`KILLED`。
- `--application-type` 取值：`MAPREDUCE`、`SPARK`、`ZION`、`Flink`、`Primus`、`FLUCTLIGHT`、`ALFRED`、`PRESTO`、`SPARK_STREAMING`、`Ray`。
- `--me` 自动以当前登录的 SSO 用户填充 `--real-name`。
- JSON 输出包含 `next_page_token`，文本输出在表格下方提示该 token。

```bash
bytedcli --site i18n-tt megatron app search --app-name demo-app --state RUNNING -r sg
bytedcli --site i18n-tt megatron app search --me -r va
```

### queue get-usage

```bash
bytedcli megatron queue get-usage --queue-name <queueName> [-r <region>]
```

```bash
bytedcli --site i18n-tt megatron queue get-usage --queue-name root.demo_queue -r sg
```

### queue calc-user-quota

按用户在该队列的 ratio（list-users 中存在则使用该值，否则使用 default）计算用户在该队列的 **保障份额（min × ratio）** 与 **突发上限（max × ratio）**，展示与当前已用资源的对比，并给出可用余量。

```bash
bytedcli megatron queue calc-user-quota --queue-name <queueName> [--user-name <userName>] [-r <region>]
```

- `--user-name <userName>`：未指定时默认使用当前登录的 SSO 用户。
- 输出包含：
  - `ratio`、`ratio_source`（`per_user` 或 `default`）
  - `queue_min_cpu` / `queue_max_cpu` / `queue_min_memory` / `queue_max_memory` / `queue_used_cpu` / `queue_used_memory` / `others_used_cpu` / `others_used_memory`
  - `user_min_cpu` / `user_max_cpu` / `user_min_memory` / `user_max_memory` / `user_used_cpu` / `user_used_memory`
  - `available_guaranteed_cpu` / `available_burst_cpu` / `available_guaranteed_memory` / `available_burst_memory`
- 计算口径：
  - `available_guaranteed = max(0, user_min - user_used)`：始终属于你的余量，与他人占用无关。
  - `available_burst = max(0, min(user_max, queue_max - others_used) - user_used)`：你还能借用的突发余量，受队列其他用户当前占用影响。
- `min` 是队列保障的最低份额，`max` 是允许借用空闲资源时的突发上限；判断是否超额优先看 `used / user_min_*`。

```bash
bytedcli --site i18n-tt megatron queue calc-user-quota --queue-name root.demo_queue -r sg
bytedcli --site i18n-tt megatron queue calc-user-quota --queue-name root.demo_queue --user-name demo-user -r sg
```

### queue quota

```bash
bytedcli megatron queue quota list-users --queue-name <queueName> [-r <region>]
bytedcli megatron queue quota get-default --queue-name <queueName> [-r <region>]
```

- `list-users`：列出该队列下所有按用户配置的 ratio。
- `get-default`：返回该队列的默认 user-quota ratio。

```bash
bytedcli --site i18n-tt megatron queue quota list-users --queue-name root.demo_queue -r sg
bytedcli --site i18n-tt megatron queue quota get-default --queue-name root.demo_queue -r sg
```

## Authentication

The CLI uses ByteCloud JWT authentication via SSO. Ensure you are logged in:

```bash
bytedcli auth login
```
