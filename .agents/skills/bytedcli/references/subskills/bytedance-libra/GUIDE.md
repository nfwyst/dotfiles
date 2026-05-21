---
name: bytedance-libra
description: "Operate Libra/DataTester A/B testing platform via bytedcli: create experiments, view experiment details, report data with metrics/P-Value/significance, search experiments, manage test users, approve or reject experiment peer reviews. Use when tasks mention Libra, A/B test, experiment, flight, metric group, DataTester, create experiment, experiment report, P-Value, significance, traffic allocation, test user, peer review, approve experiment, reject experiment, or when users ask about experiment results, want to check if an experiment is statistically significant, need to find experiments, analyze metric trends, or approve/reject a peer review."
---

# bytedcli Libra

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

Libra (DataTester) A/B 实验平台 CLI，通过 SSO 认证访问，无需额外凭证。

## When to use

- 查看实验详情、流量分配、版本配置
- 查看实验报告：指标数据、P-Value、显著性判断
- 分析指标趋势：逐日累计或分段趋势
- 搜索 / 筛选实验
- 按 repo / side type 列出配置发布里的 feature flag
- 管理实验测试用户

## Prerequisites

- 通用调用方式见 `references/invocation.md`
- 首次使用：`bytedcli auth login`（device login；后续自动复用）

> 下面示例直接写 `bytedcli`，实际执行前缀见 `references/invocation.md`。

## Workflows

### 创建实验（推荐：从模板克隆）

如果你已经有 Libra 单实验模板 ID，优先直接走模板模式。模板默认值会被转换成 create payload，再由你的 request body 覆盖实验专属字段：

```bash
# 示例：基于现有单实验模板（3139）
bytedcli --json libra experiment create --app-id 1193 --template-id 3139 --request-file ./override.json
```

模板模式当前支持 Libra 单实验模板。实际使用时，至少建议在 override 里覆盖：

- `name`
- `versions`
- 必要时覆盖 `description`、`filter_rule`

最稳的创建方式是"找一个同 layer / 同类型的实验当模板，改最小必要字段，再发 create"。直接手写 payload 极易踩到 `HTTP 500 网络异常` 或 `[213] create experiment failed`，因为 Libra 对 `layer_info` / `version_resource` / `traffic_map` / `metrics` 的组合有隐性校验。

```bash
# 1) 拉模板完整结构
bytedcli --site i18n-tt --json libra experiment get --flight-id <template_flight_id> > /tmp/template.json

# 2) 基于模板改最小必要字段：至少 name，以及需要改的 versions / owners / effected_regions；
#    保留 layer_info（连同 layer_id / create_layer_auto:false / product_id / hash_strategy 等）、
#    version_resource、traffic_map、filter_rule、metrics、flight_mode、experiment_mode、
#    manage_type、strategy_category_ids。
#    剥掉派生/只读字段（id / status / start_time / end_time / create_time / modify_time /
#    truly_effected_regions / father_info / reopen_info / review_info / actions / extra /
#    small_traffic_link / large_traffic_link 等）。

# 3) 发起创建
bytedcli --site i18n-tt --json libra experiment create --app-id -1 --request-file /tmp/new_exp.json
# 成功后从返回 JSON 的 experiments[0].id 取新 flight_id，拼接链接：
# https://data.bytedance.net/libra/flight/<experiment_id>/report/main
```

`libra experiment create` 默认会复刻 GUI 在 `/batch_create_experiment` 上的两步握手：

1. 第一次 POST `only_verification:true, skip_verification:false`，让后端做 filter rule / 流量 / layer 冲突等真实校验，保留 `code=213` 时的 `messages` / `conflict_experiments` 详情。
2. 第二次 POST `only_verification:false, skip_verification:true`，真正落库。

两步握手对所有站点都生效。host 由 `--site` 和网络 profile 自动路由：cn 默认 → `data.bytedance.net`；i18n-tt 默认 → `libra-sg.tiktok-row.net`；生产网环境设置 `BYTEDCLI_NETWORK_PROFILE=prod` 后，i18n-tt 切到 `libra-sg.bytedance.net`。路径都是同一个 `/batch_create_experiment`。

也就是说 **请求体里不要再写 `skip_verification` / `only_verification`** —— CLI 会自动处理。如果你确实想保留旧的"一把梭"行为（例如你已经手工写好了 `skip_verification:true`），加 `--no-verify`。

冲突处理：克隆 backtest / 同 layer 实验时，preflight 偶尔会回 `code=213, can_skip=true`（典型场景：新实验和老实验共用 `layer_id` + `ab_tag`）。这时默认会以 `LIBRA_CREATE_CONFLICTS` 报错并提示重试加 `--skip-conflicts`；确认无误后重试一次即可放行：

```bash
bytedcli --site i18n-tt libra experiment create \
  --app-id -1 \
  --request-file /tmp/new_exp.json \
  --skip-conflicts
```

#### 冲突决策：什么时候才应该用 `--skip-conflicts`

`--skip-conflicts` 不是兜底开关——同 key 跨 layer 强行 skip 会让两个实验落到同一批用户上，互相污染指标。preflight 报 `LIBRA_CREATE_CONFLICTS` 时按下面的算法决策：

1. 取所有 `data.conflict_experiments` 的 unique `layer_id` 集合 S。注意 preflight 响应里只给 `layer_type`，要拿 `layer_id` 需要对每个冲突 `experiment_id` 调一次 `bytedcli libra experiment get`（`-j` 模式取 `data.layer_info.layer_id`）。
2. 决策：
   - `|S| == 1` 且 ≠ 当前 `layer_info.layer_id` → **colocate**：把当前 payload 的 `layer_info.layer_id` 改成那个唯一冲突 layer，重新跑一次 create。preflight 会把"在同一 layer 上的冲突"判为可接受。
   - `|S| == 1` 且 == 当前 `layer_info.layer_id` → 同层冲突（多半是 `versions[].ab_tag` / 业务 key 重叠），停下来问用户。
   - `|S| > 1` → 物理上无法 colocate，停下来问用户。
3. 撞冲突且无法 colocate 时，给用户列冲突清单 + 三个选项：放弃 / 改 keys / 明确同意 skip。**只有用户拍板说 skip，才加 `--skip-conflicts`**。

关键 payload 规则（来自 JS bundle 反编译 + 踩坑结果）：

- `versions[].type` 是数字 `0`（对照）/`1`（实验组）；`versions[].config` 必须是 **JSON 字符串**（例如 `"{\"k\":true}"`），不是对象。
- `metrics` 是对象数组；可以为空数组但不能缺字段。
- `layer_info` 必须是完整对象：克隆时 **复用模板的 `layer_id`** 并保持 `create_layer_auto:false`；设 `create_layer_auto:true` 会让 `batch_create_experiment` 后端抛 HTTP 500（"网络异常"）。
- `version_resource`（流量占比，backtest 常见 `0.2`）和 `traffic_map`（流量段，backtest 常见 `[{"start_time":"","pieces":[{"begin":0,"length":200}]}]`）必须保留，否则 preflight 会报 `可用流量不足，请重新设置流量分配`。
- Backtest / 自动审批型实验不需要 review，不要再调 `review create` —— 会收到 `[215] 无需创建review`。

#### 从模板克隆时：用白名单 KEEP，不要用黑名单 DROP

`bytedcli libra experiment get` 拉到的模板 JSON 里，不少字段嵌的是模板自己的运行时引用（不是策略元信息）。直接整个 PUT 到新实验会被 `batch_create_experiment` 抛 `[500] record not found`，且报错追溯不到具体字段，调试很费劲。常见的"不能照搬"的字段：

- `lane_gray_info`：嵌模板原本的灰度报告 URL、灰度时间戳、lane 名字
- `test_start_time` / `freeze_time` / `version_freeze_time` / `freeze_status`：模板实验的生命周期时间
- `is_query_experiment` / `version_freeze` / `is_version_freeze_historically_closed` / `is_favourite`：用户态字段
- `close_reason` / `reopen_reason` / `date_end_time` / `is_date_end`：关停信息
- `id` / `status` / `create_time` / `modify_time` / `truly_effected_regions` / `father_info` / `reopen_info` / `review_info` / `actions` / `extra` / `small_traffic_link` / `large_traffic_link`：派生 / 只读字段

**安全做法**：用白名单 KEEP，只从模板继承"策略元字段"，剩下的让后端补默认值。典型可继承的 11 个字段：`flight_mode` / `experiment_mode` / `reuse_type` / `scene` / `metric_scene` / `is_long_time_flight` / `enable_gradual` / `is_mab` / `transmit` / `manage_type` / `strategy_category_ids`。`layer_info` 同理只 KEEP 必要字段：`hash_strategy` / `create_layer_auto` (固定 `false`) / `purpose` / `layer_id` / `layer_name` / `layer_status` / `layer_type` / `product_id` / `layer_reusable` / `layer_priority` / `layer_hash_name` / `domain`。

业务字段（`name` / `description` / `app_id` / `duration` / `type` / `version_resource` / `traffic_map` / `effected_regions` / `owners` / `filter_rule` / `versions` / `metrics`）必须显式重写。

### 判断实验是否显著

这是最常见的场景：用户想知道某个实验的指标是否有统计显著的提升。

```bash
# 0. 创建实验（通过 JSON 文件传入完整请求体；CLI 自动做 preflight + create 两步）
bytedcli --json libra experiment create --app-id -1 --request-file ./experiment.json

# 0.1 基于单实验模板创建；override body 会覆盖模板默认值
bytedcli --json libra experiment create --app-id 1193 --template-id 3139 --request-file ./override.json
# 创建成功后，从返回的 JSON 中提取实验 ID，拼接实验链接给用户：
# https://data.bytedance.net/libra/flight/<experiment_id>/report/main

# 1. 查看实验基本信息
bytedcli libra experiment get --flight-id <flight_id>

# 2. 列出可用指标组（找到目标指标组 ID）
bytedcli libra experiment report --flight-id <flight_id>

# 3. 查看指标组报告（含 P-Value 和显著性标记）
bytedcli libra experiment report --flight-id <flight_id> --metric-group <metric_group_id>

# 4. 如需看趋势变化
bytedcli libra experiment report --flight-id <flight_id> --metric-group <metric_group_id> --trend

# 5. 如需按页面报告口径复现（例如普通/CUPED 口径），传抓包里的 data_caliber
bytedcli libra experiment report --flight-id <flight_id> --metric-group <metric_group_id> --data-caliber 1
```

报告中 `Sig` 列按学术惯例分级：`*` p<0.05 / `**` p<0.01 / `***` p<0.001。

### 跨机房实验报告（data_region）

Libra 后端按机房路由查询；`lean-data-v2` 接口必须传正确的 `data_region`，否则会"静默"返回全空数据（所有 metric 的 `value=null`，且 `end_date` 被 clamp 到旧日期）。CLI 会自动从实验的 `truly_effected_regions` 推导 `data_region`，大多数时候无需手动指定；只有当自动推导结果与实际不符时才用 `--data-region` 覆盖。

```bash
# 自动推导（EU_TTP flight 会自动用 eu_ttp，无需额外参数）
bytedcli --site i18n-tt libra experiment report --flight-id <flight_id> --metric-group <metric_group_id>

# 手动指定（强制某个 region）
bytedcli --site i18n-tt libra experiment report --flight-id <flight_id> --metric-group <metric_group_id> --data-region eu_ttp
```

支持的 `data_region` 取值与实验 `truly_effected_regions` 的映射：

| `truly_effected_regions` | `data_region` | 说明                           |
| ------------------------ | ------------- | ------------------------------ |
| `SG`                     | `sg`          | Singapore (TTP-SG)             |
| `VA`                     | `va`          | Virginia / US（老 US 机房）    |
| `US_TTP`                 | `us_ttp`      | US-TTP（对应 `tx` 别名也接受） |
| `EU_TTP`                 | `eu_ttp`      | EU-TTP（GCP 欧洲机房）         |
| `MY`                     | `my`          | My-Compliance                  |
| 多区域 / 无明确区域      | `other`       | 默认值                         |

**典型排查**：如果 report 全 `-`，先 `bytedcli libra experiment get --flight-id <id>` 看 `truly_effected_regions`，再确认 `--data-region` 的取值匹配。手动传 `--data-region other` 可以快速复现老行为（作为对照）。

### 查看指标组信息

```bash
# 先从实验报告里拿到 metric group ID
bytedcli libra experiment report --flight-id <flight_id>

# 再查看指标组基础信息
bytedcli libra metric-group get --id <metric_group_id>
```

### 查看指标组模版

```bash
# 查看指标组模版（默认 normal 类型）
bytedcli libra metric-group template get --id <template_id> --app-id <app_id>

# 查看 conclusion 类型的指标组模版
bytedcli libra metric-group template get --id <template_id> --app-id <app_id> --type conclusion

# 直接传模版页面 URL
bytedcli libra metric-group template get --url <template_url>
```

### 查看实时指标

查看实验的实时监控数据（默认最近 1 小时）。

```bash
# 1. 列出实验可用的实时仪表盘
bytedcli libra experiment realtime --flight-id <flight_id>

# 2. 查看仪表盘详情（获取指标组 ID）
bytedcli libra experiment realtime --dashboard-info <dashboard_id>

# 3. 查看特定指标组的实时数据
bytedcli libra experiment realtime --flight-id <flight_id> --metric-group <metric_group_id>

# 指定时间范围
bytedcli libra experiment realtime --flight-id <flight_id> --metric-group <metric_group_id> \
  --start "2026-04-08 10:00:00" --end "2026-04-08 11:00:00"

# 分钟级数据
bytedcli libra experiment realtime --flight-id <flight_id> --metric-group <metric_group_id> --period-type m

# 查看指标含义（显示指标描述）
bytedcli libra experiment realtime --flight-id <flight_id> --metric-group <metric_group_id> --describe

# 列出所有可用的实时仪表盘
bytedcli libra experiment realtime --list-dashboards

# 查看仪表盘详情及 SQL 定义（帮助理解指标计算逻辑）
bytedcli libra experiment realtime --dashboard-info <dashboard_id> --show-sql
```

### 搜索并查看实验

```bash
# 列出可用 App
bytedcli libra app list

# 按名称搜索实验
bytedcli libra experiment list --app-id <app_id> --search "example-experiment"

# 按参数 key 搜索（跨所有 App）
bytedcli libra experiment list --app-id -1 --search "example-config-key" --search-type config

# 按创建者 / 状态筛选（1=运行中, 2=已停止, 3=已暂停, 4=草稿）
bytedcli libra experiment list --app-id <app_id> --creator "demo.user" --status 1
```

### 查看配置发布里的 feature flag

```bash
# 按 repo 查看配置发布列表
bytedcli libra feature-flag list --repo-id 11681182

# 指定页码和每页条数
bytedcli libra feature-flag list --repo-id 11681182 --page 3 --page-size 10

# 显式指定 side type（默认 scc_server）
bytedcli libra feature-flag list --repo-id 11681182 --side-type scc_server
```

### 管理实验层

实验层命令走 Libra 页面 API，复用 Titan Passport 登录态；不需要 DataOpen app credential。

```bash
# 创建实验层
bytedcli libra layer create --app-id 123 --product-id 456 --name demo-layer --owner demo.user

# 查询实验层列表
bytedcli libra layer list --app-id 123 --product-id 456 --search demo --page-size 50

# 查询实验层详情
bytedcli libra layer get --layer-id <layer_id>
```

### 管理测试用户

```bash
# 查看测试用户
bytedcli libra test-user list --flight-id <flight_id>

# 添加测试用户
bytedcli libra test-user add --flight-id <flight_id> --uid <uid>

# 删除测试用户
bytedcli libra test-user delete --flight-id <flight_id> --uid <uid>

# 指定版本（多实验组时需要）
bytedcli libra test-user add --flight-id <flight_id> --uid <uid> --version <vid>
```

### 管理测试白名单分群

```bash
# 查看测试白名单分群
bytedcli libra test-whitelist list --flight-id <flight_id>

# 添加测试白名单分群到实验组
bytedcli libra test-whitelist add --flight-id <flight_id> --group-id <group_id>

# 删除测试白名单分群
bytedcli libra test-whitelist delete --flight-id <flight_id> --group-id <group_id>

# 指定版本（多实验组时需要）
bytedcli libra test-whitelist add --flight-id <flight_id> --group-id <group_id> --version <vid>
```

### 按参数路径搜索实验

```bash
# 模糊搜索：包含该路径的实验
bytedcli libra experiment search --key-path "example.feature_toggle"

# 精确匹配
bytedcli libra experiment search --key-path "example.feature_toggle" --exact-match

# 只看运行中的（默认 1=运行中 + 3=已暂停）
bytedcli libra experiment search --key-path "example.feature_toggle" --status 1
```

### 批准 / 驳回实验 peer review

```bash
# 推荐：直接传 peer-review 页面 URL，自动解析 flight/review/app ID
bytedcli libra experiment approve --url https://libra-<region>.tiktok-row.net/libra/peer-review/<flight_id>/view/<review_id>

# 驳回（默认是批准）
bytedcli libra experiment approve --url <peer_review_url> --reject

# 手动传 review 和 app ID（无 URL 时）
bytedcli libra experiment approve --review-id <review_id> --app-id <app_id>
```

## Command overview

| Command                                                                                                             | Description                                                                        |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `libra experiment create --app-id <id> --request-file <path> [--template-id <id>] [--skip-conflicts] [--no-verify]` | 创建实验（支持单实验模板默认值 + override，默认走 preflight + create 两步）        |
| `libra experiment get --flight-id <id>`                                                                             | 实验详情（版本、流量、owner）                                                      |
| `libra experiment traffic --flight-id <id>`                                                                         | 流量分配和版本权重                                                                 |
| `libra experiment report --flight-id <id>`                                                                          | 实验报告（指标、P-Value、趋势）                                                    |
| `libra experiment realtime --flight-id <id>`                                                                        | 实时指标（最近 1 小时监控数据）                                                    |
| `libra metric-group get --id <id>`                                                                                  | 指标组基础信息（文本摘要；`--json` 返回完整 payload）                              |
| `libra metric-group template get --id <id> --app-id <id>`                                                           | 指标组模版信息（支持 `--type normal\|conclusion`，默认 normal，403 自动 fallback） |
| `libra experiment list --app-id <id>`                                                                               | 搜索和筛选实验                                                                     |
| `libra experiment search --key-path <path>`                                                                         | 按参数路径搜索实验                                                                 |
| `libra feature-flag list --repo-id <id>`                                                                            | 按仓库列出配置发布里的 feature flags                                               |
| `libra layer create --app-id <id> --product-id <id> --name <name> --owner <user>`                                   | 创建实验层（页面 API / Titan Passport 鉴权）                                       |
| `libra layer list --app-id <id> [--product-id <id>]`                                                                | 查询实验层列表                                                                     |
| `libra layer get --layer-id <id>`                                                                                   | 查询实验层信息                                                                     |
| `libra experiment approve --url <url>`                                                                              | 批准或驳回实验 peer review                                                         |
| `libra app list`                                                                                                    | 列出所有可用 App                                                                   |
| `libra test-user list --flight-id <id>`                                                                             | 查看测试用户                                                                       |
| `libra test-user add --flight-id <id> --uid <uid>`                                                                  | 添加测试用户                                                                       |
| `libra test-user delete --flight-id <id> --uid <uid>`                                                               | 删除测试用户                                                                       |
| `libra test-whitelist list --flight-id <id>`                                                                        | 查看测试白名单分群                                                                 |
| `libra test-whitelist add --flight-id <id> --group-id <id>`                                                         | 添加测试白名单分群                                                                 |
| `libra test-whitelist delete --flight-id <id> --group-id <id>`                                                      | 删除测试白名单分群                                                                 |

各命令的完整参数、选项和 `request-file` 格式说明见 `references/libra.md`。

## Key notes

- `--json` 是全局选项，放在子命令前：`bytedcli --json libra experiment get --flight-id <flight_id>`
- 用户提到 `ROW`、`i18n`、`US` 或 `TTP` 场景时，默认加 `--site i18n-tt`（例如：`bytedcli --site i18n-tt libra app list`）
- 任何需要 `--app-id` 的 Libra 命令，默认使用 `--app-id -1`，除非用户明确指定其他 app_id。
- `test-user` 更新的是 `versions[].user_list` 里的 `type=id` 条目；`test-whitelist` 更新的是 `versions[].user_list` 里的 `type=group` 条目
- `test-whitelist --group-id` 只接受数字分群 ID，不接受分群名称
- `layer` 命令使用 Libra 页面 API 鉴权，复用 Titan Passport；create/list 需要 `--app-id`，create 还需要 `--product-id`
- report 默认 `--merge-type total`（累计，含 P-Value），可选 `sum`（日均）或 `avg`
- report `--trend` 显示逐日趋势，`total` 为累计趋势，`avg` 为分段趋势
- report `--data-caliber <1|2|3>` 透传 Libra API 的 `data_caliber`，用于按页面抓包值对齐普通/CUPED 等报告口径；不传时保持 CLI 默认口径
- report `--data-region` 控制机房路由，默认从实验 `truly_effected_regions` 自动推导（EU_TTP→`eu_ttp` / SG→`sg` / VA→`va` / US_TTP→`us_ttp` / MY→`my` / 其它→`other`）；传错值会静默返回全空数据，排查空报告时首先检查这个
- 需要分维度报表时，先执行 `libra experiment report --flight-id <id> --metric-group <metric_group_id> --list-dimensions`，再用 `--dimension <dimension_id>` 或 `--dimension <dimension_id:value_id[,value_id...]>` 拉取维度数据
- 需要多维交叉时，重复传 `--dimension`；若只是分别查看两个维度，请各跑一条命令
- 多维交叉查询走异步 adhoc 计算，若超时就提示稍后重试同一条命令
- `metric-group get` 当前仅支持 `prod` 和 `i18n-tt`
- 访问 `i18n-tt` 时，请显式使用 `--site i18n-tt`
- 在生产网环境访问 i18n-tt 时，设置 `BYTEDCLI_NETWORK_PROFILE=prod`；Libra Page API / Gallery / Titan 会从默认 `.tiktok-row.net` 入口切到生产网可达的 `.bytedance.net` 入口。

## Troubleshooting

常见错误和处理方式见 `references/troubleshooting.md`。典型问题：

- **metric-group get 需要完整结构化结果**：加 `--json`，文本模式默认只展示摘要
- **报告数据为空**：先确认 `truly_effected_regions` 与自动推导的 `--data-region` 匹配；若匹配但仍空，再考虑实验数据 T+1/T+2 延迟，或用 `libra experiment report --flight-id <id>` 检查可用指标组

## References

- `references/libra.md` — 各命令完整参数和选项
- `references/troubleshooting.md` — 常见错误和处理
- `references/invocation.md` — 通用调用方式和站点切换
