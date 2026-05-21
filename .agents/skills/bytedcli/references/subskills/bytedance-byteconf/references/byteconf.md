# Byteconf MVP 命令说明

## 命令分组

当前 Byteconf 能力是 MVP，仅覆盖 `conf list`、`conf get`、`conf update` 三个主操作。

命令结构：

```bash
bytedcli [全局选项] byteconf conf <list|get|update> [命令选项]
```

## `conf list`

用于查询配置项列表，对应底层接口 `/byteconf/conf/list/v2`。

```bash
bytedcli --json byteconf conf list --ns-key "demo"
bytedcli --json byteconf conf list --ns-key "demo" --biz-tree-path "a/b/c" --keyword "feature" --page 1 --page-size 20
bytedcli --json byteconf conf list --from ./query.json --query-json '{"page_size":50}' --region "sg"
```

支持参数：

| 参数 | 说明 |
| --- | --- |
| `--ns-key` | namespace key，对应 `ns_key` |
| `--biz-tree-path` | 业务树路径，对应 `biz_tree_path` |
| `--keyword` | 关键字搜索，对应 `key_word` |
| `--page` | 页码，1-based，默认 `1` |
| `--page-size` | 分页大小，默认 `20` |
| `--from` | 从 JSON 文件读取基础 query |
| `--query-json` | 追加 query JSON（对象） |
| `--region` | 底层 `x-bcgw-tenant-id`，默认 `bytedance` |

## `conf get`

用于读取单个配置项详情，对应底层接口 `GET /byteconf/conf`。

```bash
bytedcli --json byteconf conf get --id 123 --version 1 --ns-key "demo"
bytedcli --json byteconf conf get --id 123 --version 7 --name "demo_conf" --biz-tree-path "a/b/c" --region "boe"
```

支持参数：

| 参数 | 说明 |
| --- | --- |
| `--id` | 配置 ID，必填 |
| `--version` | 版本号，默认 `1` |
| `--name` | 配置名称，可选 |
| `--ns-key` | namespace key，可选 |
| `--biz-tree-path` | 业务树路径，可选 |
| `--region` | 底层 `x-bcgw-tenant-id`，默认 `bytedance` |

建议：当用户描述为“查最新配置”但没有明确版本时，先用 `conf list` 找到目标版本，再调用 `conf get`。

## `conf update`

用于更新配置项，对应底层接口 `PUT /byteconf/conf`。

```bash
# 先检查 payload
bytedcli --json byteconf conf update --id 123 --version 7 --body-json '{"base":{"k":"v"}}' --dry-run

# 从文件更新
bytedcli --json byteconf conf update --id 123 --version 7 --from ./payload.json --region "sg"
```

支持参数：

| 参数 | 说明 |
| --- | --- |
| `--id` | 配置 ID，必填 |
| `--version` | 版本号，必填 |
| `--from` | 从 JSON 文件读取 body |
| `--body-json` | 追加 body JSON（对象） |
| `--region` | 底层 `x-bcgw-tenant-id`，默认 `bytedance` |
| `--dry-run` | 只输出最终 payload，不发请求 |

说明：

- `--from` 与 `--body-json` 至少要提供一个
- body 必须是 JSON 对象
- 显式传参的 `--id` / `--version` 会覆盖 body 中同名字段

## 多区域路由

`--region` 不只是展示字段，它会同时影响：

1. 请求头 `x-bcgw-tenant-id`
2. 请求头中的 `origin` / `referer`
3. 最终访问的底层网关地址

常见示例：

| `--region` | 路由目标示例 |
| --- | --- |
| `bytedance` / `cn` | `https://paas-gw.byted.org` |
| `boe` | `https://paas-gw-boe.byted.org` |
| `sg` | `https://paas-gw-i18n.byted.org` |
| `sinf` | `https://paas-gw.sinf.net` |

如果 region 未命中预置映射，CLI 会回退到当前 ByteCloud 站点对应的默认 host。

## 鉴权

Byteconf 的底层鉴权基于 Bytecloud SSO JWT：

- CLI 通过 `SSOClient().getBytecloudJwtForSite(site)` 获取 JWT
- 请求头自动注入 `x-jwt-token`
- 执行前建议先检查 `bytedcli auth status`

## 建议的 Agent 行为

- 机器消费结果时，优先使用 `--json`
- 更新操作默认先 `--dry-run`
- 用户只给出名称、namespace 或业务树路径时，不要直接猜 `id`；先做 `conf list`
- 用户提到 BOE、海外机房或特定租户时，显式设置 `--region`
