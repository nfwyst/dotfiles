# Log

```bash
# PSM 日志搜索
bytedcli log search-psm-log --psm "psm.name" --start "2026-02-02T08:00:00" --end "2026-02-02T09:00:00"

# PSM 日志搜索（默认写入临时文件，并在控制台打印文件路径）
bytedcli log search-psm-log --psm "psm.name" --start "2026-02-02T08:00:00" --end "2026-02-02T09:00:00" --output file

# PSM 日志搜索（直接输出到控制台）
bytedcli log search-psm-log --psm "psm.name" --start "2026-02-02T08:00:00" --end "2026-02-02T09:00:00" --output console

# PSM 日志搜索（指定输出文件）
bytedcli log search-psm-log --psm "psm.name" --start "2026-02-02T08:00:00" --end "2026-02-02T09:00:00" --output file --output-file "/tmp/bytedcli.search.log"

# PSM 日志搜索（按字段导出，适合只保留 logid/podname 等关键字段）
bytedcli log search-psm-log --psm "psm.name" --start "2026-02-02T08:00:00" --end "2026-02-02T09:00:00" --fields "logid,podname,_idc"

# PSM 日志搜索（按 KV 过滤）
bytedcli log search-psm-log --psm "example.service.api" --keyword "deploy" --kv-filter "method=Deploy|Rollback" --kv-filter "_idc=lf|hl"

# PSM 日志搜索（索引加速查询：enable_index=true）
bytedcli log search-psm-log --psm "psm.name" --start "2026-02-02T08:00:00" --end "2026-02-02T09:00:00" --keyword "error" --enable-index

# PSM 日志搜索（索引加速 + 短语查询：is_term=true，不分词）
bytedcli log search-psm-log --psm "psm.name" --start "2026-02-02T08:00:00" --end "2026-02-02T09:00:00" --term "User not found" --enable-index

# 非交互环境执行索引加速查询（跳过二次确认提示）
bytedcli log search-psm-log --psm "psm.name" --start "2026-02-02T08:00:00" --end "2026-02-02T09:00:00" --keyword "error" --enable-index --yes

# PSM 日志搜索（BOE 的 boei18n 分区 US-BOE）
bytedcli --site boe --json log search-psm-log --psm "demo.psm" --vregion "US-BOE" --start "2026-04-16T21:08:48-07:00" --end "2026-04-16T21:33:48-07:00" --keyword "demo-keyword" --output console

# LogID 查询
bytedcli log get-logid-log "20260202085428C91A145A63CB5F0B9D80" --psm "psm.name" --vregion "China-North"

# 接口总体性能分析（默认把完整结果落到本地文件）
bytedcli log analysis performance --psm "psm.name" --method "QueryFoo" --start "2026-02-02T08:00:00+08:00" --end "2026-02-02T09:00:00+08:00"

# 接口总体性能分析（默认 only-normal-trace=true；如需放宽可显式传 false）
bytedcli log analysis performance --psm "psm.name" --method "QueryFoo" --start "1776866375" --end "1776952775" --only-normal-trace false

# LogID 调用树（默认把完整 trace JSON 落到本地文件）
bytedcli log trace-tree --log-id "sample-trace-logid-001"

# LogID 调用树（指定保存路径）
bytedcli log trace-tree --log-id "sample-trace-logid-001" --output-file "/tmp/trace-tree-demo.json"

# LogID 调用树（调整 trace 搜索窗口）
bytedcli log trace-tree --log-id "sample-trace-logid-001" --time-range-right-shift 900

# LogID 查询（BOE 的 boei18n 分区 US-BOE）
bytedcli --site boe log get-logid-log "20260417132015F8E8485573EF893978AE" --psm "demo.psm" --vregion "US-BOE" --output console

# LogID 查询（指定时间范围，RFC3339 或 epoch 秒）
bytedcli log get-logid-log "20260202085428C91A145A63CB5F0B9D80" --vregion "EU-Compliance2" --start "2026-06-12T05:31:02" --end "2026-06-12T05:41:02"

# LogID 查询（国际化，新加坡区域）
BYTEDCLI_CLOUD_SITE=i18n-bd bytedcli log get-logid-log "20260202085428C91A145A63CB5F0B9D80" --psm "psm.name" --vregion "Singapore-Central"

# LogID 查询（EU TTP 区域，支持 EU-Compliance2/EU-Compliance/EU-TTP/EU-TTP2/US-EastRed）
bytedcli --site eu-ttp log get-logid-log "20260202085428C91A145A63CB5F0B9D80" --vregion "EU-Compliance2"

# LogID 查询（默认写入临时文件，并在控制台打印文件路径）
bytedcli log get-logid-log "20260202085428C91A145A63CB5F0B9D80" --psm "psm.name" --vregion "China-North" --output file

# LogID 查询（直接输出到控制台）
bytedcli log get-logid-log "20260202085428C91A145A63CB5F0B9D80" --psm "psm.name" --vregion "China-North" --output console

# LogID 查询（指定输出文件）
bytedcli log get-logid-log "20260202085428C91A145A63CB5F0B9D80" --psm "psm.name" --vregion "China-North" --output file --output-file "/tmp/bytedcli.logid.log"

# 泳道实例日志
bytedcli log get-lane-instance-log "psm.name" --env "ppe_xxx" --start "2026-02-02T08:00:00"

# 生产实例日志
bytedcli log search-prod-instance-log --psm "psm.name" --env prod --region "China-North" --range 1h --keyword "error"

# 生产实例日志（默认写入临时文件，并在控制台打印文件路径）
bytedcli log search-prod-instance-log --psm "psm.name" --env prod --region "China-North" --range 1h --keyword "error" --output file

# 生产实例日志（直接输出到控制台）
bytedcli log search-prod-instance-log --psm "psm.name" --env prod --region "China-North" --range 1h --keyword "error" --output console

# 生产实例日志（指定输出文件）
bytedcli log search-prod-instance-log --psm "psm.name" --env prod --region "China-North" --range 1h --keyword "error" --output file --output-file "/tmp/bytedcli.prod.instance.log"

# 日志聚类
bytedcli log get-log-cluster "psm.name" --start "2026-02-02T08:00:00"

# 日志聚类（按 KV 过滤，如日志级别）
bytedcli log get-log-cluster "psm.name" --start "2026-02-02T08:00:00" --kv-filter "level=ERROR|WARN"
```

## `log analysis performance` 完整结果 JSON 关键字段语义

- `report_base_info`：这次分析报表的基础信息，例如 `report_id`、`psm`、`method`、分析时间窗、分析到的 trace 数。
- `analysis_criteria`：请求条件快照；通常用来回看本次分析实际用了哪些过滤条件和默认值。
- `performance_tree`：聚合后的调用树；根节点通常就是目标接口本身。
- `analysis_span_histogram`：按耗时区间聚合的慢 span 分桶；这里的 `start_time_us` / `end_time_us` 表示**耗时桶边界**，不是事件发生时间。
- `performance_tree.log_ids`、各子节点上的 `log_ids`、以及 `analysis_span_histogram[].span_list[].log_id` 都只是接口返回的**样本线索**，不是 CLI 内置推荐结果。
- `cost_in_us`：当前聚合节点的耗时指标；排查时通常先按它看热点节点。
- `local_pure_cost_in_us`：节点本地纯耗时。
- `network_cost_in_us`：节点网络相关耗时。
- `called_percentage`：该聚合节点在分析样本中的调用占比；它不是固定含义的“错误率/成功率”。
- `span_list`：当前耗时桶中的样本 span，常带 `log_id`、`trace_id`、`duration_us`。
- CLI 会在 stdout footer 里打印保存路径；落盘文件本身不包含 额外路径字段。

## 使用约束

- CLI 只做确定性摘要，不做 AI 根因判断。
- CLI 不内置固定 logid 推荐策略。
- 需要继续深挖时，优先读取命令 footer 提示的完整 JSON 文件，再挑选 `log_id` 去跑 `bytedcli log trace-tree --log-id <id>`。
