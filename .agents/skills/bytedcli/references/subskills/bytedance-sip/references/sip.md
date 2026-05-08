# SIP（智能运维平台）

SIP 汇聚线上稳定性事件（LIBRA 实验变更、Demotion、TCE 变更、Release、recall_center 等），bytedcli 通过 `/api/v1/assistant/event/*` 提供查询能力。对应 UI：

- CN: <https://sip.bytedance.net/stability/event>
- SG: <https://sip-sg.byteintl.net/stability/event>
- TikTok ROW: <https://sip.tiktok-row.net/stability/event>

## 命令

```bash
bytedcli sip event list [options]               # --site 自动选 SIP region
bytedcli sip event get --id <event_id>
```

`sip` / `sip event` 不带子命令时打印帮助。

`--site` 到 SIP region 的映射:

| `--site` | SIP 后端 |
|---|---|
| `cn` / `boe` | `https://sip.bytedance.net`(Douyin / Toutiao / ...) |
| `i18n` / `i18n-bd` | `https://sip-sg.byteintl.net`(ByteIntl SG) |
| `i18n-tt` / `us-ttp` / `us-*` / `eu-ttp` | `https://sip.tiktok-row.net`(TikTok ROW,默认) |

也可以用 `BYTEDCLI_SIP_REGION=cn|sg|row` 或 `BYTEDCLI_SIP_BASE_URL=https://...` 显式覆盖。

### `sip event list`

在时间窗口内查询 SIP 事件列表。默认 30 分钟窗口、全部 4 个 region、`--biz tiktok_feeds`(对应 SIP UI 的 product tab,filter 从 `/product` 动态抓)。

| 参数 | 默认 | 说明 |
|------|------|------|
| `--duration <dur>` | `30m` | 相对时间窗口（`15m`/`1h`/`24h`），`--start` 存在时忽略 |
| `--start <time>` | — | 绝对起始时间（ISO 8601、epoch ms、或 `-1h` 相对偏移） |
| `--end <time>` | `now` | 绝对结束时间 |
| `--region <r>` | `SG,GCP,VA,TTP` | region / vdc，可重复。别名自动归一：`us-ttp→TTP`、`sg1→SG`、`va1→VA` |
| `--biz <biz>` | `tiktok_feeds` | Product line,对应 SIP UI 顶部的 product tab(`tiktok_feeds` / `tiktok_live` / ...)。bytedcli 启动时自动调 `/product` 接口抓取对应产品的 `product_config`,展开成过滤树,和 UI 点击 product tab 等价 |
| `--filter <json>` | 从 `--biz` 自动推导 | 服务端过滤树 JSON,显式传时**原样覆盖** `--biz` 的默认值。SIP 后端要求至少一个过滤字段,否则返回空 |
| `--category <cat>` | — | 客户端子串过滤 `category`：`LIBRA`/`Demotion`/`TCE`/`Release` |
| `--keyword <kw>` | — | 关键字（映射为 `main_search`） |
| `--page-no <n>` | `1` | 页码 |
| `--page-size <n>` | `12` | 每页条数 |
| `--mode <m>` | `card` | `card`（主卡片视图）或 `simple`（时间线简表） |

#### 过滤树示例

从 `https://sip.tiktok-row.net/api/v1/assistant/event/product` 返回的 `product_config` 可以看到完整字段。bytedcli `--biz <name>` 默认会自动把对应产品的整份 config 展开,和 UI 点顶部 product tab 一致;只有需要更细粒度过滤时才手动传 `--filter`:

```jsonc
// 仅 LIBRA 实验变更（TikTok 主 app）— 覆盖 --biz 的全量配置
{"libra": {"app": ["TikTok"]}}

// Demotion 事件
{"holmes_demotion": {"status": ["启用", "执行", "结束"]}}

// TCE 变更
{"tce": {"status": ["upgrade", "update", "rollback_ticket"]}}

// Release 变更
{"release": {"type": ["abonly", "reversalab", "ab", "noab"]}}

// recall_center
{"recall_center": {"status": ["小流量发布", "全量发布"]}}
```

可以组合多个子树，对应 UI 里多个 section 同时勾选。

#### 输出

- **文本模式**：表格列 `ID / Category / Name / Product / Region / PSM / Creator`。标题栏会显示 `返回数 / 总数`。
- **JSON 模式**：`data.events[]` 为扁平化后的卡片字段，`data.raw.list[]` 保留后端原始响应，`data.total_count` 是过滤前的总数，`data.returned` 是本地 category 过滤之后的条数。

### `sip event get`

```bash
bytedcli --site i18n-tt sip event get --id <event_id>
```

`--id` 必填，对应 `card_list` 返回里的 `id`（LIBRA flight ID、Demotion job ID 等）。响应字段会同时兼容 `{value}` 包装和扁平两种格式。

## 认证

默认零交互:bytedcli 自动用当前 SSO 身份完成 SIP 鉴权,不需要任何配置。

```bash
bytedcli --site i18n-tt sip event list --duration 1h
```

CI / agent 场景下如果要跳过自动鉴权,可用 `BYTEDCLI_SIP_TOKEN` 传入已准备好的 token:

```bash
export BYTEDCLI_SIP_TOKEN='eyJhbGci...'
bytedcli --site i18n-tt sip event list --duration 1h
```

## 常见使用姿势

**根因分析 / 告警回溯**：告警发生在 `2026-04-14 14:30 TTP`，反查前 30 分钟的所有变更：

```bash
bytedcli --site i18n-tt sip event list \
  --start 2026-04-14T14:00:00+08:00 \
  --end   2026-04-14T14:30:00+08:00 \
  --region us-ttp \
  --filter '{"libra":{"app":["TikTok"]},"tce":{"status":["upgrade","update"]},"holmes_demotion":{"status":["启用","执行"]}}'
```

**每日事件概览**：最近 24h 的 LIBRA + Demotion：

```bash
bytedcli --json --site i18n-tt sip event list --duration 24h --page-size 50 \
  --filter '{"libra":{"app":["TikTok"]},"holmes_demotion":{"status":["启用","执行","结束"]}}'
```

**快速定位某个实验的变更链**：

```bash
bytedcli --site i18n-tt sip event list --duration 7d --keyword "admix_my_lry"
```

## 常见错误

- `SIP token sign endpoint returned an unexpected response` → SIP 的 JWT 签发端点 `/api/v1/sip/base_common/jwt_token/` 返回异常。用 `bytedcli auth userinfo` 确认当前 SSO username 是否有效
- `Could not determine SIP username` → `auth.userinfo()` 拿不到 username。先跑 `bytedcli auth login`
- `SIP API authentication failed: need login with sso` / HTTP 401 → 签发端点拿到的 token 被 SIP gateway 拒绝(罕见,比如 username 在该 region 无效)。换 region 或换账号再试;也可以 `export BYTEDCLI_SIP_TOKEN='<jwt>'` 传一个已知有效的 JWT
- HTTP 500 `KeyError: 'vdc'` → SIP 后端要求 `vdc` 必须非空数组。bytedcli 默认传 `["SG","GCP","VA","TTP"]`;如果你显式传 `--region` 但值全部无法识别,归一化后可能为空,改用默认或合法值(`us-ttp`/`sg`/`va`/`gcp`/`ttp`/`cn`)
- 返回 `events: []` 但 UI 里能看到事件 → SIP 后端只在至少一个产品过滤字段存在时才返回结果。默认 `--biz tiktok_feeds`(TikTok ROW)会自动从 `/product` 拉整份 product_config 展开;在 CN region 要改用 `--biz aweme` / `--biz toutiao` 等。如果被 `--filter` 收紧过或 `biz_matched=false`,可以去掉 `--filter` 或换 `--biz`
- `--filter is not valid JSON` → 用单引号包整个 JSON,JSON 内部全部用双引号,不要混用或转义:`--filter '{"libra":{"app":["TikTok"]}}'`
