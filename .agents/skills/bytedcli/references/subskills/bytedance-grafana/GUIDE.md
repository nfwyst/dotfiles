---
name: bytedance-grafana
description: "Operate Grafana dashboards via bytedcli: dashboard/group/panel/variable/link CRUD, Metrics link injection, and panel screenshots. Use when tasks mention Grafana dashboards, panels, groups, variables, links, or dashboard screenshots."
---

# bytedcli Grafana

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

- Grafana 大盘的增删查改
- 大盘分组（Row）管理
- 面板的创建、更新、删除、查询
- 大盘变量与链接管理
- Metrics 链接注入
- 面板截图

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 认证：SSO 登录后自动通过 OAuth2 换取用户级 Grafana session（6h 缓存）；也可通过 `--grafana-session` 或 `GRAFANA_SESSION` 手动指定；未登录时降级到服务端公共账号

> 示例省略 invocation 前缀。

## Quick start

```bash
# 大盘
bytedcli grafana dashboard get --url "https://grafana.example.com/d/demo-uid/demo-slug"
bytedcli grafana dashboard create --title "demo-dashboard"
bytedcli grafana dashboard update --uid "demo-uid" --title "demo-updated"
bytedcli grafana dashboard delete --uid "demo-uid"

# 分组
bytedcli grafana group list --url "https://grafana.example.com/d/demo-uid/demo-slug"
bytedcli grafana group create --url "https://grafana.example.com/d/demo-uid/demo-slug" --title "demo-group"
bytedcli grafana group get --url "https://grafana.example.com/d/demo-uid/demo-slug" --group-title "demo-group"

# 面板
bytedcli grafana panel list --url "https://grafana.example.com/d/demo-uid/demo-slug"
bytedcli grafana panel get --url "https://grafana.example.com/d/demo-uid/demo-slug" --panel-id 123
bytedcli grafana panel create --url "https://grafana.example.com/d/demo-uid/demo-slug" --panel-json '{"title":"demo-panel","type":"graph"}'

# 变量
bytedcli grafana variable get --url "https://grafana.example.com/d/demo-uid/demo-slug"
bytedcli grafana variable update --url "https://grafana.example.com/d/demo-uid/demo-slug" --variables-json '[{"name":"interval","type":"custom","query":"30s,1m,5m"}]'

# 链接
bytedcli grafana link get --url "https://grafana.example.com/d/demo-uid/demo-slug"

# 工具
bytedcli grafana inject-metrics-links --url "https://grafana.example.com/d/demo-uid/demo-slug"
bytedcli grafana screenshot --url "https://grafana.example.com/d/demo-uid/demo-slug?viewPanel=123"
```

## 命令速查

```bash
grafana dashboard create --title <title> [--folder-id <id>] [--panels-json <json>] [--templating-json <json>] [--links-json <json>] [--grafana-session <token>]
grafana dashboard get (--uid <uid> | --url <url>) [--grafana-session <token>]
grafana dashboard update (--uid <uid> | --url <url>) [--title <title>] [--panels-json <json>] [--templating-json <json>] [--links-json <json>] [--grafana-session <token>]
grafana dashboard delete (--uid <uid> | --url <url>) [--grafana-session <token>]
grafana variable get (--uid <uid> | --url <url>) [--grafana-session <token>]
grafana variable update (--uid <uid> | --url <url>) --variables-json <json> [--mode <append|overwrite>] [--grafana-session <token>]
grafana link get (--uid <uid> | --url <url>) [--grafana-session <token>]
grafana link update (--uid <uid> | --url <url>) --links-json <json> [--mode <append|overwrite>] [--grafana-session <token>]
grafana group create (--uid <uid> | --url <url>) --title <title> [--collapsed] [--position-json <json>] [--grafana-session <token>]
grafana group get (--uid <uid> | --url <url>) (--group-id <id> | --group-title <title>) [--no-panels] [--grafana-session <token>]
grafana group list (--uid <uid> | --url <url>) [--keyword <keyword>] [--grafana-session <token>]
grafana group update (--uid <uid> | --url <url>) (--group-id <id> | --target-group-title <title>) [--title <title>] [--collapsed] [--position-json <json>] [--grafana-session <token>]
grafana group delete (--uid <uid> | --url <url>) (--group-id <id> | --group-title <title>) [--keep-panels] [--grafana-session <token>]
grafana panel create (--uid <uid> | --url <url>) --panel-json <json> [--group-id <id>] [--target-group-title <title>] [--position-json <json>] [--enable-compare <offsets>] [--grafana-session <token>]
grafana panel get (--uid <uid> | --url <url>) (--panel-id <id> | --panel-title <title>) [--grafana-session <token>]
grafana panel list (--uid <uid> | --url <url>) [--keyword <keyword>] [--grafana-session <token>]
grafana panel update (--uid <uid> | --url <url>) (--panel-id <id> | --panel-title <title>) [--panel-json <json>] [--group-id <id>] [--target-group-title <title>] [--position-json <json>] [--enable-compare <offsets>] [--grafana-session <token>]
grafana panel delete (--uid <uid> | --url <url>) (--panel-id <id> | --panel-title <title>) [--grafana-session <token>]
grafana inject-metrics-links (--uid <uid> | --url <url>) [--grafana-session <token>]
grafana screenshot --url <url> [--duration <duration>] [--end-time <time>] [--width <px>] [--height <px>] [--grafana-session <token>]
```

## Bosun 表达式格式（重要）

创建/更新面板时，targets 中的 `expr` 必须使用标准 Bosun `nv(q(...))` 语法，分两种格式：

**非多值指标**（QPS使用 `rate{counter}:`）：
```
$child= nv(q("sum:30s-avg-zero:rate{counter}:指标名{}{}","$start", "30s"),0)
$child
```
示例：
```json
{
  "title": "激活成功率",
  "targets": [
    {
      "expr": "$child= nv(q(\"sum:30s-avg-zero:rate{counter}:caijing.fe.akali.do_active_success{}{}\",\"$start\", \"30s\"),0) \n$mother = nv(q(\"sum:30s-avg-zero:rate{counter}:caijing.fe.akali.do_active{}{}\",\"$start\", \"30s\"),0) \n$child/$mother"
    }
  ]
}
```

**多值指标**（QPS使用 `.delta_counter` + `[rate]`）：
```
$child= nv(q("sum:30s-avg-zero:指标名.delta_counter{}{}[rate]","$start", "30s"),0)
$child
```
示例：
```json
{
  "title": "绑卡量",
  "targets": [
    {
      "expr": "$child= nv(q(\"sum:30s-avg-zero:kepler.finance_fe.monitor.wallet_bcard_institution_bind_result.delta_counter{}{}[rate]\",\"$start\", \"30s\"),0) \n$child"
    }
  ]
}
```

**转化率（多变量除法）**：
```json
{
  "title": "激活转化率",
  "targets": [
    {
      "expr": "$child= nv(q(\"sum:30s-avg-zero:rate{counter}:caijing.fe.akali.do_active_success{}{}\",\"$start\", \"30s\"),0) \n$mother= nv(q(\"sum:30s-avg-zero:rate{counter}:caijing.fe.akali.do_active{}{}\",\"$start\", \"30s\"),0) \n$child/$mother"
    }
  ]
}
```

### Bosun 分组与过滤语法

指标格式：`metric{group}{filter}`，两个 `{}` 分别是分组条件和过滤条件。

- **分组 `{group}`**（= SQL GROUP BY）
  - `{tag=*}`：按 tag 值分组展示
  - `{}`：不分组（聚合所有数据）
- **过滤 `{filter}`**（= SQL WHERE）
  - `{tag=value}`：精确匹配
  - `{tag=literal_or(a|b|c)}`：WHERE IN（区分大小写）
  - `{tag=not_literal_or(a|b)}`：WHERE NOT IN
  - `{tag=wildcard(*.douyin.com)}`：通配符匹配
  - `{tag=regexp(data\\-[0-9])}`：正则匹配
  - 多条件逗号分隔：`{host=web*, dc=lf}`
- **注意**：两个 Group 必须互为子集才能运算，否则报 `unjoined group`

示例：按 method 分组，过滤 err_code=0：
```
sum:30s-avg-zero:rate{counter}:metric{method=*}{err_code=literal_or(0)}
```

### 注意事项

- 不要传简单的 `metric{tag}` 格式，必须包裹在 `nv(q(...))` 中
- 系统会兜底转换简单格式：含 `.delta_counter` 走多值，否则走非多值 `rate{counter}`
- tags 的 `{}` 中只放确定存在的固定值，不要使用 Grafana 模板变量（如 `$xxx`），避免目标大盘缺少该变量导致查询失败
- 支持多变量计算如 `$a/$b`、`$a + $b` 等
- 如果用户未指定 `target` 字段，系统自动设为 `"Bosun Query"`
- 如果用户未指定 `datasource`，默认使用 `"bosun"`

## Notes

- 大盘标识支持 `--uid` 或 `--url`（至少传一个），URL 支持带 `var-*` 模板变量
- 复杂参数（panels、variables、links、position）通过 `--xxx-json` 传递 JSON 字符串
- 创建大盘时 `--folder-id` 默认 164421972
- 所有命令通过 MCP 自动暴露为 `grafana_*` 系列 tool
