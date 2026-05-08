---
name: bytedance-log
description: "Operate log service via bytedcli: search logs by PSM/LogID/instance/pod, view log clusters. Use when tasks mention log search, logid lookup, instance logs, or log clustering."
---

# bytedcli Log

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

- 按 PSM / 时间搜索日志
- 按 LogID 查询日志
- 按接口维度查看 BytedTrace 总体性能分析
- 按 LogID 查看 BytedTrace 调用树与节点延迟
- 按环境 / 实例 / Pod 搜索日志
- 查看日志聚类

## 前置条件

- 使用通用调用方式：`references/invocation.md`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## 重试策略（Skill 行为）

- 默认不自动重试：日志查询命令执行失败时，不要在后台静默重跑。
- 失败后交互确认：首次失败后，必须清晰展示失败原因，并询问用户是否重试；用户确认后才进行下一次尝试。
- 可控重试次数：默认最多重试 1 次；若用户明确要求，可按用户给定上限执行，但是最多3次重试，且每一次重试都必须再次询问确认。
- 不建议重试的场景：参数校验失败（如缺少必填参数、格式错误）应提示用户修正参数，不进入重试流程。

## 查询策略（Skill 喜好）

- PSM 关键词查询默认不启用索引加速：除非用户明确要求开启索引（或明确要求短语查询），否则一律不加 `--enable-index`。
- LogID 查询优先级更高：当用户诉求包含某个/某些 LogID（即便同时给出 PSM），优先用 `log get-logid-log <logid> --psm <psm>` 查询。
- 如果用户明确要“先看接口总体瓶颈，再决定查哪些 logid”，优先用 `log analysis performance --psm <psm> --method <method> --start <time> --end <time>`。
- 如果用户明确要“看链路耗时 / 各节点延迟 / 调用树”，优先用 `log trace-tree --log-id <logid>`，不要继续用 `get-logid-log` 解析日志明细代替。
- 任何情况下不并发查询：同一轮对话中如需多次查询（多 LogID、多 PSM、多时间段），必须串行执行，上一条完成后再发下一条。
- 时间范围尽量精准且渐进扩展：优先使用用户给出的精确时间点（或从告警/工单/调用链获得的时间），先用 15m~30m 窗口定位；只有在证据不足时才逐步扩大窗口，避免一上来用小时级或天级范围。`get-logid-log` 支持 `--start`/`--end`（RFC3339 或 epoch 秒）显式指定时间范围，不传时由 `--scan-span` 推导。
- 日志条数尽量最小且可控：首次 PSM 查询优先设置较小的收集上限（如 `--max-logs 200`）与单次请求上限（如 `--limit 50` 或 `--limit 100`）；除非用户明确要求，不要使用 `--max-logs 0`（无限制）。
- 扩大范围前先收窄条件：时间窗口不变时，优先通过 `--keyword/--exclude/--kv-filter/--idc` 收敛结果，再考虑扩大时间范围或提高 `--max-logs`。
- 关键词传参优先用重复选项：多关键词场景优先重复传 `--keyword/--exclude`（例如 `--keyword "a,b" --keyword "c"`），避免使用逗号分隔写法导致关键词内包含逗号时被误拆分。
- **vregion 必须显式指定**：`--vregion` 决定服务端去哪个区域的日志存储查数据，默认值按站点不同：`cn` 为 `China-North`，`boe` 为 `China-BOE`，`i18n`/`i18n-bd` 为 `Singapore-SaaS`，`i18n-tt` 为 `Singapore-Central`，`us-ttp`/`us-ttp-bdee`/`us-ttp-usts` 为 `US-TTP`。当目标服务部署在其他区域时，必须传正确的 `--vregion`（如 US-TTP 对应 useast5、`US-TTP2` 对应 useast8，必须显式传 `--vregion US-TTP2` 才会路由到 tx2 host），否则会在错误的区域查询，导致返回空结果。如果不确定目标区域，应先询问用户服务部署在哪个 region。

## Quick start

```bash
# PSM 日志搜索
bytedcli log search-psm-log --psm "psm.name" --start "2026-02-02T08:00:00" --end "2026-02-02T09:00:00"

# PSM 日志搜索（直接输出到控制台）
bytedcli log search-psm-log --psm "psm.name" --start "2026-02-02T08:00:00" --end "2026-02-02T09:00:00" --output console

# PSM 日志搜索（指定输出文件）
bytedcli log search-psm-log --psm "psm.name" --start "2026-02-02T08:00:00" --end "2026-02-02T09:00:00" --output file --output-file "/tmp/bytedcli.search.log"

# PSM 日志搜索（按 KV 过滤）
bytedcli log search-psm-log --psm "example.service.api" --keyword "deploy" --kv-filter "method=Deploy|Rollback" --kv-filter "_idc=lf|hl"

# PSM 日志搜索（索引加速查询：enable_index=true）
bytedcli log search-psm-log --psm "psm.name" --start "2026-02-02T08:00:00" --end "2026-02-02T09:00:00" --keyword "error" --enable-index

# PSM 日志搜索（索引加速 + 短语查询：is_term=true，不分词）
bytedcli log search-psm-log --psm "psm.name" --start "2026-02-02T08:00:00" --end "2026-02-02T09:00:00" --term "User not found" --enable-index

# PSM 日志搜索（BOE 的 boei18n 分区 US-BOE）
bytedcli --site boe --json log search-psm-log --psm "demo.psm" --vregion "US-BOE" --start "2026-04-16T21:08:48-07:00" --end "2026-04-16T21:33:48-07:00" --keyword "demo-keyword" --output console

# LogID 查询（国内，默认 vregion=China-North）
bytedcli log get-logid-log "20260202085428C91A145A63CB5F0B9D80" --psm "psm.name" --vregion "China-North"

# 接口总体性能分析（默认把完整结果落到本地文件）
bytedcli log analysis performance --psm "psm.name" --method "QueryFoo" --start "2026-02-02T08:00:00+08:00" --end "2026-02-02T09:00:00+08:00"

# 接口总体性能分析（默认 only-normal-trace=true；如需放宽可显式传 false）
bytedcli log analysis performance --psm "psm.name" --method "QueryFoo" --start "1776866375" --end "1776952775" --only-normal-trace false

# LogID 调用树（默认 region=China-North，默认 time_range_right_shift=600，并把完整结果落到本地文件）
bytedcli log trace-tree --log-id "sample-trace-logid-001"

# LogID 调用树（指定保存路径）
bytedcli log trace-tree --log-id "sample-trace-logid-001" --output-file "/tmp/trace-tree-demo.json"

# LogID 调用树（调整 trace 搜索窗口）
bytedcli log trace-tree --log-id "sample-trace-logid-001" --time-range-right-shift 900

# LogID 查询（BOE 的 boei18n 分区 US-BOE）
bytedcli --site boe log get-logid-log "20260417132015F8E8485573EF893978AE" --psm "demo.psm" --vregion "US-BOE" --output console

# LogID 查询（指定时间范围，RFC3339 或 epoch 秒；不传时由 --scan-span 推导）
bytedcli log get-logid-log "20260202085428C91A145A63CB5F0B9D80" --vregion "EU-Compliance2" --start "2026-06-12T05:31:02" --end "2026-06-12T05:41:02"

# LogID 查询（国际化，新加坡区域）
BYTEDCLI_CLOUD_SITE=i18n-bd bytedcli log get-logid-log "20260202085428C91A145A63CB5F0B9D80" --psm "psm.name" --vregion "Singapore-Central"

# LogID 查询（EU TTP 区域，支持 EU-Compliance2/EU-Compliance/EU-TTP/EU-TTP2/US-EastRed）
bytedcli --site eu-ttp log get-logid-log "20260202085428C91A145A63CB5F0B9D80" --vregion "EU-Compliance2"

# LogID 查询（直接输出到控制台）
bytedcli log get-logid-log "20260202085428C91A145A63CB5F0B9D80" --psm "psm.name" --vregion "China-North" --output console

# LogID 查询（指定输出文件）
bytedcli log get-logid-log "20260202085428C91A145A63CB5F0B9D80" --psm "psm.name" --vregion "China-North" --output file --output-file "/tmp/bytedcli.logid.log"

# 泳道实例日志
bytedcli log get-lane-instance-log "psm.name" --env "ppe_xxx" --start "2026-02-02T08:00:00"

# 生产实例日志（按 Pod）
bytedcli log search-prod-instance-log --psm "psm.name" --env prod --region "China-North" --range 1h --keyword "error"

# 生产实例日志（直接输出到控制台）
bytedcli log search-prod-instance-log --psm "psm.name" --env prod --region "China-North" --range 1h --keyword "error" --output console

# 生产实例日志（指定输出文件）
bytedcli log search-prod-instance-log --psm "psm.name" --env prod --region "China-North" --range 1h --keyword "error" --output file --output-file "/tmp/bytedcli.prod.instance.log"

# 日志聚类
bytedcli log get-log-cluster "psm.name" --start "2026-02-02T08:00:00"

# 日志聚类（按 KV 过滤，如日志级别）
bytedcli log get-log-cluster "psm.name" --start "2026-02-02T08:00:00" --kv-filter "level=ERROR|WARN"
```

## Notes

- `--start/--end` 支持 RFC3339 或时间戳（秒/毫秒），不传则默认近 1 小时
- `--start/--end` 的 RFC3339 形式支持显式时区偏移（如 `2026-04-16T21:08:48-07:00`、`2026-04-16T21:08:48+08:00`、`2026-04-16T21:08:48Z`）；不带偏移时按运行机器的本地时区解析，跨机器/跨时区场景建议显式带偏移避免歧义
- `--range` 和 `--start -1h` 相对语法仅 `search-prod-instance-log` 支持
- 日志查询时间范围上限为 7 天（`end - start <= 7d`），超出会报错
- `--keyword/--exclude` 支持重复或逗号分隔
- `search-psm-log` 可用 `--enable-index` 开启索引加速查询（`enable_index=true`），适用于 PSM 关键词搜索
- `search-psm-log` 可用 `--term` 开启短语查询（`is_term=true`，不分词）；短语查询必须配合索引加速（`--enable-index`）
- `search-psm-log` 开启 `--enable-index` 时会提示二次确认 PSM 是否已开索引，并给出索引说明文档：`https://bytedance.larkoffice.com/docx/K1lHdQppSo0d1HxkAMscn1Wfnff`；非交互场景可加 `--yes` 跳过确认
- `search-psm-log` 默认最多收集 1000 条日志（`--max-logs 1000`）；传 `--max-logs 0` 表示无限制
- `search-psm-log` 和 `get-log-cluster` 支持 `--kv-filter key=value1|value2`，可重复传递多个过滤条件
- `--idc` 在 `search-psm-log` 中会自动映射为 `_idc` 过滤
- `get-log-cluster` 使用 `--kv-filter` 可按日志级别等字段过滤聚类结果，例如 `--kv-filter "level=ERROR|WARN"`
- `search-psm-log` / `get-logid-log` 使用 `--vregion`，`search-prod-instance-log` / `get-lane-instance-log` 使用 `--region`；在 `i18n-tt` 站点时，`search-psm-log` / `get-logid-log` 不提供 `--vregion` 的话默认使用 `Singapore-Central`
- `log analysis performance` 使用 `--metrics-region`，默认 `cn`；它表示分析接口所使用的指标区域，不是 logservice 的 `--vregion`。
- `trace-tree` 使用 `--region`（BytedTrace region），首版默认 `China-North`；它不是 logservice 的 `--vregion`
- `log analysis performance` 默认把完整分析 JSON 保存到本地临时文件；可用 `--output-file` 指定路径；stdout 固定返回 summary preview，不支持 stdout JSON
- `log analysis performance` 默认使用 `--only-normal-trace true`；如需分析不完整链路，显式传 `--only-normal-trace false`
- 如果 agent 需要理解 `log analysis performance` 完整结果的字段语义，先看 `references/log.md` 里的“完整结果 JSON 关键字段语义”，不要只靠字段名猜测 `cost_in_us`、`called_percentage`、`analysis_span_histogram` 等含义
- `trace-tree` 默认把完整 trace JSON 保存到本地临时文件；可用 `--output-file` 指定路径；stdout 固定返回 summary preview，不支持 stdout JSON
- `trace-tree` 遇到 `others` / merge span 聚合导致下游挂载不稳定时，可能补充 `[raw]` 预览子节点；更精确的 parent-child 关系以保存下来的完整 payload 为准
- `--vregion` 默认值按站点不同：`cn` 为 `China-North`，`boe` 为 `China-BOE`，`i18n`/`i18n-bd` 为 `Singapore-SaaS`，`i18n-tt` 为 `Singapore-Central`，`us-ttp`/`us-ttp-bdee`/`us-ttp-usts` 为 `US-TTP`。该参数决定服务端在哪个区域的日志存储中查询，传错区域会导致查到空结果而非报错。常见 vregion 值：`China-North`、`Singapore-SaaS`、`Singapore-Central`、`US-East`、`US-TTP`、`US-TTP2`、`China-BOE`、`US-BOE`、`EU-Compliance2`、`EU-Compliance`、`EU-TTP`、`EU-TTP2`、`US-EastRed`
- `--vregion US-TTP`（别名 `usttp`、`ttp-us`、`ttp-us-limited`）会自动路由到 US-TTP 专用 logservice（`logservice-tx.tiktok-us.org`，对应 `useast5`），JWT 获取走 `cloud-ttp-us.bytedance.net`
- `--vregion US-TTP2`（别名 `usttp2`、`ttp-us2`）会路由到 US-TTP2 专用 logservice（`logservice-tx2.tiktok-us.org`，对应 `useast8`），与 US-TTP 是独立的 vregion；JWT 同样走 `cloud-ttp-us.bytedance.net`
- `--vregion US-BOE`（BOE 的 boei18n 分区）会路由到 `logservice-boei18n.byted.org`，JWT 从 `cloud.bytedance.net`（bytedance SSO）获取，与 China-BOE 的 `logservice-boe.byted.org` + `cloud-boe.bytedance.net` 不同。使用方式：`bytedcli --site boe log search-psm-log --psm demo.psm --vregion US-BOE ...`（传错 China-BOE 分区会报 `vregion ... is not in the same site/partition`，error_code=101400）
- `--vregion` 支持 EU TTP 域的 5 个区域：`EU-Compliance2`、`EU-Compliance`、`EU-TTP`、`EU-TTP2`、`US-EastRed`。使用 `--site eu-ttp` 或 `--site i18n-tt` 时，这些 vregion 会自动路由到 `tiktok-eu.org` 域的专用 logservice，JWT 使用 i18n-tt 站点凭证
- 切换 i18n 站点时建议显式使用 `--site i18n-bd` 或 `--site i18n-tt`。认证隔离按 SSO 环境生效：`i18n-tt`、`eu-ttp` 与 `cn`/`i18n`/`i18n-bd` 隔离，使用前需先确认对应站点已登录（如 `BYTEDCLI_CLOUD_SITE=i18n-tt ... auth status`），否则可能报 `获取字节云 JWT 失败: 401`，详见 `references/troubleshooting.md`
- **建议在 `i18n-tt` 站点查询实例日志时显式指定 `--region`**：`search-prod-instance-log` 和 `get-lane-instance-log` 在 `--site i18n-tt` 时，不提供 `--region` 的话默认使用 `Singapore-Central`。如需查询其他区域的日志，建议显式传入 `--region`，例如 `--region "Singapore-Central"`、`--region "US-East"`等。常见的 i18n-tt 站点 region 值包括：`Singapore-Central`、`US-East` 等。
- `search-psm-log` / `get-logid-log` / `get-log-cluster` 等命令需要结构化输出时可加 `--json`（全局选项，放在子命令之前，如 `bytedcli --json log search-psm-log ...`）；`log analysis performance` 与 `trace-tree` 不支持 stdout JSON
- `search-psm-log` / `search-prod-instance-log` / `get-logid-log` 默认 `--output file`，会在控制台打印输出文件路径；可用 `--output console` 直接打印日志
- `search-psm-log` 文本导出默认透出全部字段；支持 `--fields` 指定字段导出（可重复或逗号分隔）
- `trace-tree` 默认直接输出文本树，不支持 `--output file|console` 切换；文本模式仍会打印保存下来的结果文件路径
- 日志时间统一按 UTC+8 输出
- **沙箱环境优先使用 `--output file`**：在沙箱环境（如 Trae IDE）中，`--output console` 可能因输出缓冲或权限限制导致结果不显示，建议使用默认的 `--output file`。
- 

## References

- `references/log.md`
