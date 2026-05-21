---
name: bytedance-bytedoc
description: "Operate ByteDoc via bytedcli: search/list/get databases, list and manage collections, run Mongo shell style queries, perform document CRUD for classic/cloud-native/Volc Mongo, and inspect slow-query data. Use when tasks mention ByteDoc, bytedoc, Mongo collections/documents in ByteDoc, or ByteDoc slow queries."
---

# bytedcli ByteDoc

## 如何调用 bytedcli

```bash
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest <command> [options]
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npm install -g @bytedance-dev/bytedcli@latest
bytedcli <command> [options]
```

下面示例默认直接写 `bytedcli`；使用 `npx` 时把 `bytedcli` 替换成上面的 npx 前缀。

## When to use

- 搜索、列出或查看 ByteDoc 数据库。
- 查看集合，执行 Mongo shell 风格命令。
- 对 classic / cloud-native / Volc Mongo ByteDoc 做集合创建、删除、重命名。
- 对 classic / cloud-native / Volc Mongo ByteDoc 做文档 list / insert / update / delete。
- 查看 ByteDoc 慢查询 overview、detail、scope、subscriber、metrics、index recommend。

## 前置条件

- 需要鉴权时先登录：`bytedcli auth login`
- BOE ByteDoc / Volc Mongo 场景通常使用全局 `--site boe`。
- 海外 ByteDoc 控制面使用全局站点和 vregion，例如 `--site i18n-tt --vregion Singapore-Central`；`--site i18ntt` 可作为 `i18n-tt` 的别名。
- 更完整的调用、站点和 JSON 输出约定见 `references/invocation.md`。

## Routing

- 主入口是 `bytedoc <action>`；旧的 `bytedoc db <action>` 作为兼容入口保留，不作为新示例首选。
- `bytedoc search` 在支持 Cloud Service Search 的站点上返回 `backend=classic|cloud-native|volc` 和原始 `mode`；不支持该聚合接口的海外控制面会自动回退到 classic / cloud-native 平台搜索。
- `volc` 是独立 backend，表示 Cloud Service Search 返回的 DBW / Volc Mongo 后端；不要把它归到 cloud-native backend。
- 海外控制面回退到平台搜索时没有独立 Volc 聚合来源；`--backend volc` 不会返回结果。
- 读集合和 Mongo shell 风格命令优先用 `bytedoc collections` / `bytedoc shell`；CLI 会自动识别 classic、cloud-native 或 Volc Mongo，也可用 `--backend` 消歧。
- classic / cloud-native 的查询、集合操作和文档 CRUD 统一走 DMS；Volc Mongo 走 DBW。
- 结构化 Mongo 操作使用 `bytedoc collection ...` 和 `bytedoc document ...`。
- `list` / `follow` / `slow-query` 仍只有 classic / cloud-native 平台接口，没有独立 Volc 后端；Volc 页面上的日志、备份、参数等能力属于 DBW / Volc 详情面，不等同于这些平台接口。
- 慢查询使用 `bytedoc slow-query ...`；classic 的 detail 支持 fingerprint id 自动展开。

## Quick start

```bash
# 搜索 / 列表 / 详情
bytedcli bytedoc search --keyword "demo_orders"
bytedcli bytedoc search --keyword "demo_orders" --backend volc
bytedcli --site i18n-tt --vregion Singapore-Central bytedoc search --keyword "demo_orders"
bytedcli --json bytedoc list
bytedcli --json bytedoc list --all --deploy-mode cloud-native
bytedcli --json bytedoc get --service "demo_orders" --deploy-mode classic

# 集合与 Mongo shell 风格命令
bytedcli --json bytedoc collections --service "demo_orders"
bytedcli --json bytedoc shell --service "demo_orders" --collection "demo_records" --query 'find().limit(10)'
bytedcli --json bytedoc shell --service "example.bytedoc.demo_catalog" --backend volc --collection "demo_items" --query 'find().limit(10)'

# classic / cloud-native / Volc Mongo 结构化操作
bytedcli --json bytedoc collection create --service "example.bytedoc.demo_catalog" --collection "demo_items"
bytedcli --json bytedoc document list --service "example.bytedoc.demo_catalog" --collection "demo_items" --filter-json '{"tenant":"demo"}' --limit 10
bytedcli --json bytedoc document insert --service "example.bytedoc.demo_catalog" --collection "demo_items" --doc-json '{"tenant":"demo","value":1}'

# 慢查询
bytedcli --json bytedoc slow-query overview --service "demo_orders" --deploy-mode classic --millis 100
```

## Notes

- 需要结构化输出加 `--json`，并放在 `bytedoc` 前面。
- 完整 collection / document CRUD、`--query-file`、JSON 文件入参和慢查询命令矩阵见 `references/bytedoc.md`。
- 复杂 aggregate / distinct / index 命令优先使用 `--query-file`，减少 shell quoting 干扰。
- 对现有业务集合执行写入、删除或重命名前，先确认目标 service、db、collection 和 filter；批量更新/删除需显式传 `--many`。

## References

- `references/bytedoc.md`
- `references/invocation.md`
- `references/troubleshooting.md`
