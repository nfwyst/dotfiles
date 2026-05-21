# Libra CLI Reference

## libra experiment create

通过 JSON 请求体创建新实验。

```bash
# 从 JSON 文件创建（--app-id 传 -1，实际 app_id 放在 body 内）
bytedcli --json libra experiment create --app-id -1 --request-file ./experiment.json

# 内联 JSON 创建
bytedcli --json libra experiment create --app-id -1 --request-json '{"name":"demo-exp", ...}'

# 基于单实验模板创建，request body 作为 override 覆盖模板默认值
bytedcli --json libra experiment create --app-id 1193 --template-id 3139 --request-file ./override.json

# 克隆 backtest / 同 layer 实验时放行可跳过冲突（默认 cn 站点；i18n-tt 等站点请加 --site）
bytedcli libra experiment create --app-id -1 --request-file ./copy.json --skip-conflicts
```

**选项：**

| Option                  | Description                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `--app-id <id>`         | Libra app ID，通常传 `-1`（实际 app_id 放在请求体内）                                                               |
| `--request-json <json>` | 内联 JSON 请求体                                                                                                    |
| `--request-file <path>` | 从文件读取 JSON 请求体                                                                                              |
| `--template-id <id>`    | Libra 单实验模板 ID；CLI 会先展开模板默认值，再用 request body 覆盖                                                 |
| `--skip-conflicts`      | preflight 返回 `code=213, can_skip=true` 时（典型场景：新老实验共用 `layer_id` + `ab_tag`），放行冲突继续创建       |
| `--no-verify`           | 跳过 GUI 的两步 preflight，按旧"一把梭"方式只 POST 一次；只在你已经在 body 里设置好 `skip_verification:true` 时使用 |

请求体会被自动包裹为 `{ "experiments": [body] }` 发送。

**模板模式说明**

- 当前支持 Libra 单实验模板（single-experiment template）
- CLI 会读取模板详情，把模板默认值转换成 create payload
- `--request-json` / `--request-file` 里的字段会覆盖模板默认值
- 实际使用时，至少建议覆盖 `name`、`versions`

**两步握手（默认行为）**

CLI 默认按 GUI 顺序连发两次 `/datatester/experiment/api/v3/app/<app_id>/batch_create_experiment`：

1. `only_verification:true, skip_verification:false` —— 让后端跑 filter rule / 流量 / layer 冲突等真实校验；如果失败，会用 `data.messages` / `data.conflict_experiments` 拼出具体原因抛出。
2. `only_verification:false, skip_verification:true` —— 真正落库。

无论 cn（默认）还是 i18n-tt 等站点，请求都打到同一个 `/batch_create_experiment` 路径，host 由 `--site` 和网络 profile 自动路由：cn 默认 → `data.bytedance.net`；i18n-tt 默认 → `libra-sg.tiktok-row.net`；生产网环境设置 `BYTEDCLI_NETWORK_PROFILE=prod` 后，i18n-tt 切到 `libra-sg.bytedance.net`。两步握手对所有站点都生效。

因此**不要**在 payload 里手动写 `skip_verification` / `only_verification`。CLI 看到这两个字段已存在时也会自动退化为单次 POST（与 `--no-verify` 等价），但容易绕掉真实校验，不建议这么做。

**request-file JSON 模板：**

```json
{
  "name": "实验名称",
  "manage_type": "strategy",
  "owners": [{ "id": 12345, "name": "demo.user" }],
  "description": "实验描述",
  "expectation": "",
  "scene": 0,
  "feature_type": 3,
  "app_id": 495,
  "is_long_time_flight": 0,
  "enable_gradual": false,
  "specified_psms": [],
  "filter_rule": [
    {
      "conditions": [
        {
          "logic": "&&",
          "condition": {
            "key": "app_id",
            "op": "==",
            "value": [8478],
            "type": "int",
            "custom_filter": false,
            "source": "libra",
            "property_type": "common_param"
          }
        },
        {
          "logic": "&&",
          "condition": {
            "key": "version_code",
            "op": ">=",
            "value": 100190000,
            "type": "int",
            "custom_filter": false,
            "source": "libra",
            "property_type": "common_param"
          }
        }
      ],
      "logic": "||"
    }
  ],
  "filter_user_list": 2,
  "transmit": true,
  "version_traffic_adjustable": false,
  "metric_scene": 2,
  "strategy_category_ids": [],
  "small_traffic_link": "",
  "large_traffic_link": "",
  "is_mab": 0,
  "duration": 2592000,
  "version_resource": 0.01,
  "book_version_resource": 0,
  "experiment_mode": 1,
  "product_id": 1538,
  "layer_info": {
    "create_layer_auto": false,
    "product_id": 1538,
    "hash_strategy": "did",
    "layer_id": 194016
  },
  "versions": [
    {
      "name": "control",
      "description": "对照组",
      "type": 0,
      "config_show_mode": 1,
      "weight": 500,
      "config": "{}"
    },
    {
      "name": "treatment",
      "description": "实验组",
      "type": 1,
      "config_show_mode": 1,
      "weight": 500,
      "config": "{\"key\":{\"param\":true}}"
    }
  ],
  "metrics": [],
  "tags": []
}
```

**关键字段说明：**

| 字段                                      | 说明                                                                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`                                    | 实验名称，全局唯一，最长 200 字符                                                                                                                      |
| `manage_type`                             | `"strategy"`（服务端）或 `"product"`（客户端）                                                                                                         |
| `owners`                                  | 负责人数组，每项含 `id`（employee_id）和 `name`                                                                                                        |
| `app_id`                                  | Libra 应用 ID（即 Libra 平台的 libraKey，可在 [应用管理页](https://data.bytedance.net/libra/access?page=1&status=4) 查询，与客户端上报的 app_id 不同） |
| `product_id`                              | 产品线 ID（与 layer_info.product_id 一致）                                                                                                             |
| `duration`                                | 实验时长，秒。30 天 = 2592000                                                                                                                          |
| `version_resource`                        | 实验流量比例，0~1（0.01 = 1%）                                                                                                                         |
| `layer_info.layer_id`                     | 流量层 ID                                                                                                                                              |
| `layer_info.hash_strategy`                | 分流方式：`"did"` / `"uid"`                                                                                                                            |
| `versions[].type`                         | 0 = 对照组，1 = 实验组                                                                                                                                 |
| `versions[].weight`                       | 流量权重（千分比），按比例分配                                                                                                                         |
| `versions[].config`                       | 参数配置 JSON 字符串                                                                                                                                   |
| `filter_rule`                             | 受众过滤规则数组，每个元素是一组 AND 条件                                                                                                              |
| `filter_rule[].conditions[].condition.op` | 操作符：`"=="`、`">="` 、`"in_bundle"` 等                                                                                                              |
| `metrics`                                 | 关注指标组数组，可为空（重要指标会自动关联）                                                                                                           |
| `traffic_map`                             | 流量段配置（克隆 backtest 时常见 `[{"start_time":"","pieces":[{"begin":0,"length":200}]}]`），缺失会导致 preflight 报"可用流量不足"                    |
| `skip_verification` / `only_verification` | **不要手动设置**，CLI 会按两步握手自动注入。已经设置时 CLI 会回退到单次 POST（等价 `--no-verify`）                                                     |

可通过 `bytedcli --json libra experiment get --flight-id <id>` 导出已有实验的完整字段结构作为参考模板。

## libra experiment get

查看实验详情，包含名称、状态、版本配置、owner、流量比例、标签等。

```bash
bytedcli libra experiment get --flight-id <flight_id>
bytedcli --json libra experiment get --flight-id <flight_id>
```

## libra experiment traffic

查看实验流量分配和版本权重。

```bash
bytedcli libra experiment traffic --flight-id <flight_id>
```

## libra experiment report

查看实验报告。不带 `--metric-group` 时列出所有可用指标组。

```bash
# 列出指标组
bytedcli libra experiment report --flight-id <flight_id>

# 查看具体指标组
bytedcli libra experiment report --flight-id <flight_id> --metric-group <metric_group_id>

# 指定日期和合并方式
bytedcli libra experiment report --flight-id <flight_id> --metric-group <metric_group_id> \
  --start 2026-03-18 --end 2026-03-25 --merge-type total

# 列出当前指标组支持的维度和值
bytedcli libra experiment report --flight-id <flight_id> --metric-group <metric_group_id> --list-dimensions

# 按维度拉取报告（查询该维度下全部值）
bytedcli libra experiment report --flight-id <flight_id> --metric-group <metric_group_id> --dimension <dimension_id>

# 只看指定维度值
bytedcli libra experiment report --flight-id <flight_id> --metric-group <metric_group_id> \
  --dimension <dimension_id:value_id1,value_id2>

# 多维交叉查询
bytedcli libra experiment report --flight-id <flight_id> --metric-group <metric_group_id> \
  --dimension <dimension_id:value_id1,value_id2> \
  --dimension <dimension_id:value_id3,value_id4>

# 查看逐日趋势
bytedcli libra experiment report --flight-id <flight_id> --metric-group <metric_group_id> --trend

# 指定单个机房（通常自动推导，不用传；只在自动推导错、或对比其它 region 时使用）
bytedcli libra experiment report --flight-id <flight_id> --metric-group <metric_group_id> --data-region eu_ttp

# 多机房合并查询（同时覆盖 ROW + EU TTP 的实验，不传会自动推导为 other,eu_ttp）
bytedcli libra experiment report --flight-id <flight_id> --metric-group <metric_group_id> --data-region other,eu_ttp

# 指定 Libra 报告口径（按页面抓包里的 data_caliber 值对齐普通/CUPED 等口径）
bytedcli libra experiment report --flight-id <flight_id> --metric-group <metric_group_id> --data-caliber 1

# 指定 baseline 版本（默认为实验内 type=0 的版本；长期反转/Holdout 类报告常需要把反转组显式设为 baseline）
bytedcli libra experiment report --flight-id <flight_id> --metric-group <metric_group_id> --baseline <vid>
```

**选项：**

| 选项                        | 说明                                                                                                                       | 默认值                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `--flight-id <id>`          | 实验 Flight ID（必填）                                                                                                     | -                                                                              |
| `--metric-group <id>`       | 指标组 ID                                                                                                                  | 省略则列出所有                                                                 |
| `--start <YYYY-MM-DD>`      | 开始日期                                                                                                                   | 最新有数日期                                                                   |
| `--end <YYYY-MM-DD>`        | 结束日期                                                                                                                   | 最新有数日期                                                                   |
| `--merge-type <type>`       | `total`(累计)/`sum`(日均)/`avg`                                                                                            | `total`                                                                        |
| `--trend`                   | 显示逐日趋势数据                                                                                                           | 关闭                                                                           |
| `--list-dimensions`         | 列出当前 metric group 可用维度和值 ID                                                                                      | 关闭                                                                           |
| `--dimension <spec>`        | 维度选择器，格式 `<dimension_id>` 或 `<dimension_id:value_id[,value_id...]>`；重复传多个维度时执行交叉查询                 | -                                                                              |
| `--data-region <region>`    | 机房路由：`sg` / `eu_ttp` / `us_ttp` / `tx` / `va` / `my` / `other`（其他机房聚合）；支持逗号分隔多个（如 `other,eu_ttp`） | 从实验 `truly_effected_regions` 自动推导（映射规则见下），推不出时回退 `other` |
| `--data-caliber <1\|2\|3>`  | Libra 报告口径原始值，对齐页面请求里的 `data_caliber`；用于对比普通/CUPED 等口径                                           | 不传时保持 CLI 默认口径                                                        |
| `--baseline <vid>`          | 指定 baseline 版本 ID（Libra 报告里作为参照组、diff 的分母与基准）                                                         | 默认取实验内 `type=0` 的版本（通常即 v0 / 对照组）                             |
| `--wait-timeout-sec <sec>`  | 多维交叉查询最长等待秒数                                                                                                   | `180`                                                                          |
| `--poll-interval-sec <sec>` | 多维交叉查询轮询间隔秒数                                                                                                   | `5`                                                                            |

说明：`--dimension <dimension_id>` 查询该维度下全部值；`--dimension <dimension_id:value_ids>` 只查询指定值；重复传多个 `--dimension` 时执行多维交叉。多维交叉查询走异步 adhoc 计算；若超时，命令会返回当前 `async_job_id` / `progress` / `status`，提示稍后重试同一条命令。`--data-caliber` 直接透传到 Libra report API，适合按浏览器抓包值复现页面上的普通/CUPED 等报告口径。

**`--baseline` 详解**：Libra 后端按 `base_vid` 决定哪个版本作为 diff 计算的参照组——所有非 baseline 版本的 `relative_diff` 与 `p_val` 都是「该版本 vs baseline」。CLI 默认取实验内 `type=0` 的版本（通常即 v0 / 对照组），与 Libra 页面默认行为一致。需要覆盖默认的典型场景：

- 长期反转 / Holdout 实验：把"反转组"显式设为 baseline，让线上组的 `relative_diff` 直接读作「线上 vs 反转」，diff 符号体现推全功能的长期效果
- 多组实验里想换一个版本做参照：例如 v0/v1/v2/v3 想看 v1 vs v3 / v2 vs v3 等

CLI 会先调 `libra experiment get` 校验传入的 vid 是否属于该 flight；不属于时会列出所有已知 version id + name 后退出。

**`--data-region` 详解**：Libra 后端按机房路由查询，传错区域会静默返回 `value=null`（接口仍返回 `code: 0`），并把 `end_date` clamp 到旧日期。

`data_region` 有两个维度的概念需要区分：

- **机房部署标签**（`truly_effected_regions`）：实验在哪些机房生效，对应 Libra 创建实验时的物理机房选项（新加坡机房 → `SG`、美东Maliva机房 → `VA`、GCP/EU-TTP机房 → `EU_TTP`、US-TTP机房组 → `US_TTP`）。
- **`data_region` 查询桶**：Libra 报表 API 的聚合分区，对应 Libra UI 里的「其他机房数据」/「EU-TTP机房数据」等筛选项。

`other` 是**"其他机房"聚合桶**（对应 Libra UI 的「其他机房数据」），包含 SG（新加坡机房）、VA（美东Maliva机房）、MY 等机房的数据聚合，不是某个具体机房的名称。

自动推导规则：将 `truly_effected_regions` 里的物理机房标签映射到对应查询桶，去重后逗号拼接：

| 实验 `truly_effected_regions` 示例 | 自动推导的 `data_region`              | 说明                                |
| ---------------------------------- | ------------------------------------- | ----------------------------------- |
| `["SG"]`                           | `other`                               | 新加坡机房 → 其他机房聚合桶         |
| `["VA"]`                           | `other`                               | 美东Maliva机房 → 其他机房聚合桶     |
| `["MY"]`                           | `other`                               | → 其他机房聚合桶                    |
| `["SG", "VA"]`                     | `other`                               | 均属其他机房，去重后单值            |
| `["EU_TTP"]`                       | `eu_ttp`                              | GCP/EU-TTP机房 → eu_ttp桶（1:1）    |
| `["US_TTP"]`                       | `us_ttp`                              | US-TTP机房组 → us_ttp桶（1:1）      |
| `["SG", "VA", "EU_TTP"]`           | `other,eu_ttp`                        | 典型跨区实验（如 i18n-tt 全球实验） |
| `["EU_TTP", "OTHER"]`              | `eu_ttp,other`                        | 多桶逗号拼接                        |
| 无法推导 / 空                      | `other`（兜底，仅查其他机房聚合数据） |                                     |

只有自动推导错、或者手工对比不同 region 表现时才需要加 `--data-region`。可通过 `bytedcli libra experiment get --flight-id <id>` 查看 `Regions` 字段确认实验生效机房。

## libra metric-group get

查看指标组基础信息。文本模式输出 owner / metric / virtual table 摘要；`--json` 返回完整 payload。

```bash
# 按指标组 ID 查询
bytedcli libra metric-group get --id <metric_group_id>

# i18n-tt / TikTok ROW
bytedcli --site i18n-tt libra metric-group get --id <metric_group_id>

# 生产网环境访问 i18n-tt：Gallery / Titan 自动切到 .bytedance.net 入口
BYTEDCLI_NETWORK_PROFILE=prod bytedcli --site i18n-tt libra metric-group get --id <metric_group_id>
```

**选项：**

| 选项        | 说明                    | 默认值 |
| ----------- | ----------------------- | ------ |
| `--id <id>` | Libra 指标组 ID（必填） | -      |

说明：`metric-group get` 当前仅支持 `prod` 和 `i18n-tt`。文本模式默认展示摘要；需要完整结构化结果时加 `--json`。

## libra metric-group template get

查看指标组模版（metric-group template / bundle）详情。支持直接传 `--id` 或模板页面 / API `--url`。

```bash
# 按 template id 查询
bytedcli libra metric-group template get --id <template_id>

# 已知 app 时显式传入
bytedcli libra metric-group template get --id <template_id> --app-id <app_id>

# 查看 conclusion 类型的指标组模版
bytedcli libra metric-group template get --id <template_id> --app-id <app_id> --type conclusion

# 直接传模版页面 URL
bytedcli libra metric-group template get --url <template_url>

# 直接传 API URL
bytedcli libra metric-group template get --url <metric_group_bundle_api_url>

# i18n-tt / TikTok ROW
bytedcli --site i18n-tt libra metric-group template get --url <template_url>
```

**选项：**

| 选项            | 说明                                                                                       | 默认值                                      |
| --------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------- |
| `--id <id>`     | Metric group template ID；与 `--url` 二选一                                                | -                                           |
| `--url <url>`   | 模版页面 URL 或 `metric_group_bundle`/`conclusion_report_bundle` API URL；与 `--id` 二选一 | -                                           |
| `--app-id <id>` | Libra App ID；已知时建议显式传入                                                           | 自动解析 / probing                          |
| `--type <type>` | 模版类型：`normal`（metric_group_bundle）或 `conclusion`（conclusion_report_bundle）       | `normal`，403 时自动 fallback 到 conclusion |

说明：省略 `--app-id` 时，会先尝试从模版页面解析 `app_id`，再查询 `metric_group_bundle` 模块下当前用户可访问的 app，最后才回退到 `-1`。两种模版类型使用不同的后端接口：`normal` 对应 `metric_group_bundle`，`conclusion` 对应 `conclusion_report_bundle`（返回层级分类结构和 conclusion 指标组）。不指定 `--type` 时默认 normal，403 时自动 fallback 到 conclusion。文本模式默认展示摘要；需要完整结构化结果时加 `--json`。
**报告字段说明：**

| 列      | 含义                                      |
| ------- | ----------------------------------------- |
| Metric  | 指标名称                                  |
| Version | 实验组名称（对照组不显示，作为 baseline） |
| Mean    | 指标均值                                  |
| Diff%   | 相对对照组的变化百分比                    |
| P-Value | 统计显著性 p 值                           |
| CI      | 置信区间                                  |
| Sig     | `*` p<0.05 / `**` p<0.01 / `***` p<0.001  |

## libra experiment list

搜索和筛选实验。`--app-id` 为必填参数。

```bash
# 按 App 列出实验
bytedcli libra experiment list --app-id <app_id>

# 按名称搜索
bytedcli libra experiment list --app-id <app_id> --search "example-experiment"

# 按创建者筛选
bytedcli libra experiment list --app-id <app_id> --creator "demo.user"

# 按 owner_type 筛选（可多选）
bytedcli libra experiment list --app-id -1 --owner-type my,favourite --page-size 50

# 按参数 key 搜索
bytedcli libra experiment list --app-id -1 --search "example-config-key" --search-type config

# 按状态筛选
bytedcli libra experiment list --app-id <app_id> --status 1
```

**选项：**

| 选项                     | 说明                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| `--app-id <id>`          | Libra App ID（必填）                                                                            |
| `-s, --search <keyword>` | 按名称搜索（数字自动识别为 ID 搜索）                                                            |
| `--search-type <type>`   | 搜索类型：`id`/`name`/`vid`/`config`                                                            |
| `--status <n>`           | 1=运行中, 2=已停止, 3=已暂停, 4=草稿                                                            |
| `--creator <email>`      | 按创建者邮箱前缀筛选                                                                            |
| `--owner-type <list>`    | 按 owner_type 筛选；支持原样透传单值或逗号分隔多值，如 `all`、`my`、`favourite`、`my,favourite` |
| `--page <n>`             | 页码，默认 1                                                                                    |
| `--page-size <n>`        | 每页条数，默认 20                                                                               |

## libra feature-flag list

按仓库查看 Libra 配置发布里的 feature flag 列表。该命令走页面侧 API，适合 agent 查询配置状态、值摘要和关联实验。

```bash
# 按 repo 列出 feature flags
bytedcli libra feature-flag list --repo-id 11681182

# 指定页码
bytedcli libra feature-flag list --repo-id 11681182 --page 3 --page-size 10

# 指定 side type 和 app_id
bytedcli libra feature-flag list --repo-id 11681182 --side-type scc_server --app-id -1

# 只看与某个实验关联的配置
bytedcli libra feature-flag list --repo-id 11681182 --related-experiment-id 4980416
```

**选项：**

| 选项                           | 说明                        |
| ------------------------------ | --------------------------- |
| `--repo-id <id>`               | 仓库 ID（必填）             |
| `--side-type <type>`           | 配置侧别，默认 `scc_server` |
| `--release-status <n>`         | 发布状态筛选，默认 `-1`     |
| `--page <n>`                   | 页码，默认 1                |
| `--page-size <n>`              | 每页条数，默认 10           |
| `--app-id <id>`                | Libra app ID，默认 `-1`     |
| `--related-experiment-id <id>` | 只返回与指定实验关联的配置  |

**输出重点字段：**

| 字段                                | 含义                    |
| ----------------------------------- | ----------------------- |
| `id`                                | feature flag ID         |
| `key`                               | 配置 key                |
| `owner_names`                       | 配置负责人              |
| `status`                            | 启用状态                |
| `release_status`                    | 发布状态原始值          |
| `released`                          | 是否已发布              |
| `value_type`                        | 值类型                  |
| `released_value`                    | 当前已发布值/条件表达式 |
| `experiment_id` / `experiment_name` | 关联实验                |

## libra layer create

创建 Libra 实验层。该命令走 Libra 页面 API，复用 Titan Passport 登录态。

```bash
# 创建实验层
bytedcli libra layer create --app-id 123 --product-id 456 --name demo-layer --owner demo.user

# 指定分流方式和优先级
bytedcli libra layer create --app-id 123 --product-id 456 --name demo-layer --owner demo.user --hash-strategy uid_only --priority 50
```

**选项：**

| 选项                         | 说明                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| `--app-id <id>`              | Libra app ID（必填）                                                               |
| `--name <name>`              | 实验层名称，全局唯一（必填）                                                       |
| `--owner <user>`             | 实验层 owner（必填）                                                               |
| `--product-id <id>`          | 功能模块 ID（必填）                                                                |
| `--description <text>`       | 实验层描述                                                                         |
| `--hash-strategy <strategy>` | 分流参数：`uid_only`、`uid`、`did`、`rid`、`uuid`、`cdid`、`ssid`、`webid`、`pkid` |
| `--hash-type <type>`         | 实验类型，例如 `ssid` / `uid`                                                      |
| `--hash-unit <unit>`         | 流量层类型，默认 `normal`                                                          |
| `--priority <n>`             | 优先级：`1` 高优，`50` 普通，`100` Launch 层                                       |
| `--traffic-turn <n>`         | 流量流转模式，默认 `0`                                                             |
| `--reusable`                 | 创建为共享层                                                                       |
| `--domain-id <id>`           | 归属互斥域 ID                                                                      |
| `--tag <tag>`                | 标签，可重复传                                                                     |
| `--white-list <user>`        | 白名单用户，可重复传                                                               |
| `--user-group-id <id>`       | 白名单群组 ID，可重复传                                                            |

## libra layer list

查询 Libra 实验层列表。

```bash
# 按功能模块查询
bytedcli libra layer list --app-id 123 --product-id 456

# 搜索名称 / 描述 / owner
bytedcli libra layer list --app-id 123 --search demo --page 1 --page-size 50

# 按分流方式与优先级过滤
bytedcli libra layer list --app-id 123 --product-id 456 --hash-strategy uid_only --priority 50
```

**选项：**

| 选项                         | 说明                            |
| ---------------------------- | ------------------------------- |
| `--app-id <id>`              | Libra app ID（必填）            |
| `--product-id <id>`          | 功能模块 ID                     |
| `--layer-id <id>`            | 实验层 ID 过滤                  |
| `--domain-group-id <id>`     | 互斥域组 ID 过滤                |
| `--hash-strategy <strategy>` | 分流参数过滤                    |
| `--priority <n>`             | 优先级过滤                      |
| `-s, --search <keyword>`     | 模糊检索名称、描述、owner       |
| `--page <n>`                 | 页码，默认 1                    |
| `--page-size <n>`            | 每页数量，默认 20，接口最多 100 |

## libra layer get

按实验层 ID 查询详情。

```bash
bytedcli libra layer get --layer-id <layer_id>
bytedcli --json libra layer get --layer-id <layer_id>
```

**选项：**

| 选项              | 说明                                            |
| ----------------- | ----------------------------------------------- |
| `--layer-id <id>` | 实验层 ID（必填）                               |
| `--app-id <id>`   | Libra app ID（可选；传入后详情会带 app 上下文） |

## libra experiment approve

批准或驳回实验的 peer review。支持传 peer-review 页面 URL 自动解析 `flight_id` / `review_id` / `app_id`，也可手动指定。

```bash
# 推荐：直接传 peer-review URL（从 URL 中提取 flight_id 和 review_id）
bytedcli libra experiment approve --url https://libra-<region>.tiktok-row.net/libra/peer-review/<flight_id>/view/<review_id>

# 驳回 review（默认是批准）
bytedcli libra experiment approve --url <peer_review_url> --reject

# 手动指定 review 和 app ID（无 URL 时使用）
bytedcli libra experiment approve --review-id <review_id> --app-id <app_id>
```

**选项：**

| 选项               | 说明                                                            |
| ------------------ | --------------------------------------------------------------- |
| `--url <url>`      | Libra peer-review 页面 URL，自动解析 `flight_id` 和 `review_id` |
| `--review-id <id>` | Review ID；`--url` 未提供时必填                                 |
| `--flight-id <id>` | 实验 Flight ID；用于推导 `--app-id`，省略时走接口 probing       |
| `--app-id <id>`    | Libra App ID；省略时从 `--flight-id` 推导                       |
| `--reject`         | 驳回 review（默认是批准）                                       |

说明：`--url`、`--review-id` 至少提供一个；传 `--url` 时会从 URL 解析出 `flight_id` 和 `review_id`，覆盖手动传入的同名参数。`<region>` 为 peer-review 站点区域（例如 `sg` / `va` / `us` / `eu`），通常与实验所在 site 一致。

**Operate type 枚举**（`approve` 命令本身不需要传，仅用于理解 review payload 里 `operate_type` 字段的含义；通过 page API 自己 `review/create/{flightId}` 时需要按场景选）：

| 值   | 名称                    | 含义                |
| ---- | ----------------------- | ------------------- |
| `1`  | start                   | 实验开启            |
| `2`  | edit                    | 实验编辑保存        |
| `3`  | resume                  | 实验恢复运行        |
| `4`  | launch_release          | 实验 launch 层全量  |
| `5`  | pause                   | 实验暂停            |
| `6`  | stop                    | 实验关闭            |
| `7`  | close_version           | 关闭实验组          |
| `10` | holdout_start           | Holdout 开始        |
| `11` | edit_holdout_subversion | 编辑 holdout 子版本 |

`auto_launch` 字段：发起 review 时传 `1` 表示 approve 通过后服务端自动 start 实验，传 `0` 表示 approve 后实验仍停在 `paused`，需要再人工 start。`extra` 字段是另一回事（review 触发方式：`0`=manual / `1`=auto / `2`=timer），跟 `auto_launch` 无关。

## libra experiment update（CLI 暂未实现 → page API workaround）

`bytedcli libra experiment` 当前**没有 `update` 子命令**。需要修改已存在实验的字段（`versions[].config` / `description` / `owners` / `effected_regions` ...）时，直接调 page API：

```
PUT /datatester/experiment/api/v3/app/{appId}/experiment/{flightId}
```

**Read-merge-write 模式**：先 GET 拿当前完整 payload（用 `bytedcli libra experiment get`），patch 想改的字段，整个对象 PUT 回去。**不要**像 create 那样 strip 派生字段——update 时后端容忍这些（毕竟它们就是后端自己生成的），strip 反而可能丢字段。

实测行为：

| 实验状态                                              | PUT 是否安全      | 说明                                                                                                                                                                          |
| ----------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status: 4` (draft)                                   | ✅ 直接 PUT       | 无 review 状态可影响                                                                                                                                                          |
| `status: 3` (paused) + `review_status: 2` (in_review) | ✅ 直接 PUT       | review 不会失效，原 review 链接照常生效                                                                                                                                       |
| `status: 1` (running)                                 | ⚠️ 取决于改的字段 | 改 `versions[].config` 通常会触发新一轮 `operate_type=2` 的 edit review，要重新发 review；改纯 metadata（如 `description`）通常无副作用。**实战中要现场观察 `review_status`** |

PUT 后用 `bytedcli libra experiment get --flight-id <id>` 反查确认改动落库。

## libra experiment search

按参数路径搜索包含指定配置参数的实验。

```bash
# 模糊搜索
bytedcli libra experiment search --key-path "example.feature_toggle"

# 精确匹配
bytedcli libra experiment search --key-path "example.feature_toggle" --exact-match

# 只看运行中的实验
bytedcli libra experiment search --key-path "example.feature_toggle" --status 1
```

**选项：**

| 选项                | 说明                                                         |
| ------------------- | ------------------------------------------------------------ |
| `--key-path <path>` | 参数路径（必填），如 `example.feature_toggle`                |
| `--app-id <id>`     | Libra App ID，默认 -1（所有 App）                            |
| `--exact-match`     | 精确匹配路径，默认模糊匹配                                   |
| `--status <list>`   | 逗号分隔的状态筛选：1=运行中, 2=已停止, 3=已暂停（默认 1,3） |
| `--page <n>`        | 页码，默认 1                                                 |
| `--page-size <n>`   | 每页条数，默认 20                                            |

## 概念辨析：业务 ab_tag vs Libra `versions[].ab_tag`

这两个 "ab_tag" 完全不是同一个东西，第一次踩很容易混。

| 名字                                       | 出处                                                                           | 类型          | 用途                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------------------- |
| **Libra payload 里的 `versions[].ab_tag`** | 实验 API payload 字段                                                          | 字符串 / null | Libra 平台内部对版本的"标签"标识，绝大多数实验都是 `null`，不影响业务行为 |
| **业务代码里的 `ab_tag`**                  | 策略 params（典型形式 `ctx.params->get({"<module>", "ab_tag"}, "<default>")`） | 字符串        | 落到 metric 上报的 tagkv，让 metric 平台能按 tag 切分实验组数据           |

**实战要点**：

- 用户说"换 ab_tag"时，**99% 指业务代码侧**。要去 `versions[].config` 里塞策略 params 路径覆盖默认值。Libra 的 `versions[].ab_tag` 字段几乎用不到。
- 业务代码里的 `ab_tag` 通常都有 default 值，不显式设也能跑，metric 会落到 default tag 上。**默认不需要在 v1 config 里塞 ab_tag** —— 除非用户明确说"要按这个实验单独切分指标"。
- control 组通常不需要塞 ab_tag（control 用默认行为，相关函数链路可能根本不会被调用，没有上报）。
- 怎么知道某个 metric 用的 ab_tag 来源？grep 业务代码里 `emit_timer` / `emit_counter` 的调用，看 tagkv 里 ab_tag 是从哪条 `params->get` 拿的，再决定要不要在 config 里塞。

## libra app list

列出所有可用的 Libra App。

```bash
bytedcli libra app list
```

## libra test-user list

查看实验所有版本的测试用户。

```bash
bytedcli libra test-user list --flight-id <flight_id>
```

## libra test-user add

添加测试用户到实验版本。

```bash
bytedcli libra test-user add --flight-id <flight_id> --uid <uid>

# 指定版本（多实验组时需要）
bytedcli libra test-user add --flight-id <flight_id> --uid <uid> --version <vid>

# 多个 UID（逗号分隔或重复 --uid）
bytedcli libra test-user add --flight-id <flight_id> --uid uid1,uid2
```

## libra test-user delete

从实验版本中删除测试用户。

```bash
bytedcli libra test-user delete --flight-id <flight_id> --uid <uid>
bytedcli libra test-user delete --flight-id <flight_id> --uid uid1,uid2 --version <vid>
```

**test-user 选项：**

| 选项               | 说明                                       |
| ------------------ | ------------------------------------------ |
| `--flight-id <id>` | 实验 Flight ID（必填）                     |
| `--uid <uid>`      | 测试用户 UID，可逗号分隔或重复使用（必填） |
| `--version <vid>`  | 目标版本 ID 或名称（单实验组时自动选择）   |

## libra test-whitelist list

查看实验所有版本的测试白名单分群。

```bash
bytedcli libra test-whitelist list --flight-id <flight_id>
```

## libra test-whitelist add

添加测试白名单分群到实验版本。

```bash
bytedcli libra test-whitelist add --flight-id <flight_id> --group-id <group_id>

# 指定版本（多实验组时需要）
bytedcli libra test-whitelist add --flight-id <flight_id> --group-id <group_id> --version <vid>

# 多个分群 ID（逗号分隔或重复 --group-id）
bytedcli libra test-whitelist add --flight-id <flight_id> --group-id 451385,451386
```

## libra test-whitelist delete

从实验版本中删除测试白名单分群。

```bash
bytedcli libra test-whitelist delete --flight-id <flight_id> --group-id <group_id>
bytedcli libra test-whitelist delete --flight-id <flight_id> --group-id 451385,451386 --version <vid>
```

**test-whitelist 选项：**

| 选项               | 说明                                            |
| ------------------ | ----------------------------------------------- |
| `--flight-id <id>` | 实验 Flight ID（必填）                          |
| `--group-id <id>`  | 测试白名单分群 ID，可逗号分隔或重复使用（必填） |
| `--version <vid>`  | 目标版本 ID 或名称（单实验组时自动选择）        |
