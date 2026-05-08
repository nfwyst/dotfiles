---
name: bytedance-sip
description: "Query SIP 智能运维平台 events (LIBRA 实验、Demotion、TCE 变更、Release 等) via bytedcli. Invoke when tasks mention SIP、智能运维、stability event、稳定性事件、实验变更、Demotion 事件 或需要按时间窗口查询 TikTok 线上变更."
---

# bytedcli SIP

## 如何调用 bytedcli

先选择一种调用方式。下面所有示例默认直接写 `bytedcli`。

```bash
# 方式 1：直接用 npx 运行最新版
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest <command> [options]

# 方式 2：先全局安装，再直接调用 bytedcli
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npm install -g @bytedance-dev/bytedcli@latest
bytedcli <command> [options]
```

## When to use

- 查询指定时间窗口内的 SIP stability events（LIBRA 实验变更、Demotion、TCE 变更、Release 等）
- 按 region / biz / category / 关键字过滤事件列表
- 对应 SIP UI：`https://sip.tiktok-row.net/stability/event`
- 根因分析、变更回溯：查某个时间段里发生了哪些线上动作

## Quick start

```bash
# 零交互，按 --site 自动选 SIP region
bytedcli --site i18n-tt sip event list --duration 1h
bytedcli --site cn sip event list --duration 1h --biz aweme
bytedcli --site i18n-tt sip event list --duration 1h --biz tiktok_live

# 最近 24 小时 Demotion 事件（--filter 覆盖 --biz 自动推导的默认）
bytedcli --site i18n-tt sip event list --duration 24h \
  --filter '{"holmes_demotion":{"status":["启用","执行","结束"]}}'

# 按绝对时间窗口 + 指定 region
bytedcli --site i18n-tt sip event list \
  --start 2026-04-14T22:00:00+08:00 \
  --end   2026-04-14T23:00:00+08:00 \
  --region us-ttp --region sg

# 按 category 做客户端过滤（大小写不敏感子串）
bytedcli --site i18n-tt sip event list --duration 6h --category libra

# JSON 输出（agent / 脚本消费）
bytedcli --json --site i18n-tt sip event list --duration 1h --page-size 20

# 查询单个事件详情
bytedcli --site i18n-tt sip event get --id 7628873892584488977
```

## Authentication

默认零交互：bytedcli 自动用当前 SSO 身份完成 SIP 鉴权，不需要任何配置。

CI / agent 场景下如果要跳过自动鉴权，可用 `BYTEDCLI_SIP_TOKEN` 传入已准备好的 token：

```bash
export BYTEDCLI_SIP_TOKEN='eyJhbGci...'
bytedcli --site i18n-tt sip event list --duration 1h
```

## Notes

- **时间窗口**：默认 `--duration 30m`，最常用的是 `15m / 30m / 1h / 6h / 24h`。也可以用 `--start / --end` 传绝对时间（ISO 8601、epoch ms 或 `-1h` 这样的相对偏移）。
- **SIP region**（API host）：默认按 `--site` 自动选 — `cn / boe → sip.bytedance.net`、`i18n / i18n-bd → sip-sg.byteintl.net`、其他 → `sip.tiktok-row.net`。可通过 `BYTEDCLI_SIP_REGION=cn|sg|row` 或 `BYTEDCLI_SIP_BASE_URL=https://...` 覆盖。
- **vdc**：`--region` 指的是事件的 **vdc** 过滤(不是 SIP region),可重复传入,取值映射到 SIP 后端的记号:`us-ttp → TTP`、`sg1/singapore → SG`、`va1 → VA`、`gcp → GCP`、`cn → CN`。省略时默认查全部 region 的 vdc。
- **biz / filter**：`--biz` 默认 `tiktok_feeds`，对应 SIP UI 顶部 product tab。bytedcli 启动时调 `/api/v1/assistant/event/product` 抓该 product 的 `product_config`，**自动展开**成完整过滤树发送（和 UI 点击 product tab 等价）。切 product line 只需 `--biz tiktok_live` / `--biz content_ecom` 等。需要更细粒度时用 `--filter '<json>'` 直接覆盖，常用子树 `libra` / `holmes_demotion` / `release` / `tce` / `recall_center` / `bernard`；JSON 输出里 `filter.biz_matched` 指示 `--biz` 是否在 `/product` 列表里命中。
- **category 过滤**：`--category` 是客户端过滤，按大小写不敏感子串匹配 `category` 字段（`LIBRA` / `Demotion` / `TCE` / `Release` 等）。和 `--filter` 的服务端过滤互补使用。
- **分页**：`--page-no` / `--page-size`（默认 12）。总数通过 JSON 输出的 `total_count` 查看。
- **mode**：`--mode simple` 对应 SIP UI 上方的时间线简表；`--mode card`（默认）对应主列表的卡片视图。
- **响应字段展平**：返回的 `events[]` 每条包含 `id / name / category / product / region / psm / creator / start_time / url`。`product` 优先从 `tags[app]` 派生（因为 LIBRA 事件里是个 tag），`psm` 从 `psm_list[0]` 派生。完整原始对象放在 JSON 输出的 `raw.list[]` 里。
- 对应 UI：`https://sip.tiktok-row.net/stability/event`。

## References

- [sip.md](./references/sip.md)
- [invocation.md](./references/invocation.md)
- [troubleshooting.md](./references/troubleshooting.md)
