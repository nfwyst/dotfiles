---
name: bytedance-bytedoc
description: "Operate ByteDoc via bytedcli: search/list/get databases, list and manage collections, run Mongo shell style queries, perform document CRUD for cloud-native/Volc Mongo, and inspect slow-query data. Use when tasks mention ByteDoc, bytedoc, Mongo collections/documents in ByteDoc, or ByteDoc slow queries."
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
- 查看集合，执行 Mongo shell 风格查询。
- 对 cloud-native / Volc Mongo ByteDoc 做集合创建、删除、重命名。
- 对 cloud-native / Volc Mongo ByteDoc 做文档 query / insert / update / delete。
- 查看 ByteDoc 慢查询 overview、detail、scope、subscriber、metrics、index recommend。

## 前置条件

- 需要鉴权时先登录：`bytedcli auth login`
- BOE ByteDoc / Volc Mongo 场景通常使用全局 `--site boe`。
- 更完整的调用、站点和 JSON 输出约定见 `references/invocation.md`。

## Routing

- 所有命令都在 `bytedoc db` 下，没有独立 `dbw` 命令面。
- `bytedoc db search` 以 ByteDoc Cloud Service Search 为准，默认返回 `backend=classic|cloud-native|volc` 和原始 `mode`；`--backend` 是严格三态选择器，`--deploy-mode` 只是 legacy 两态过滤项。
- `volc` 是独立 backend，表示 Cloud Service Search 返回的 DBW / Volc Mongo 后端；不要把它归到 cloud-native backend。
- 读集合和 Mongo shell 查询优先用 `bytedoc db collections` / `bytedoc db query`；CLI 会自动识别 classic、cloud-native 或 Volc Mongo，也可用 `--backend` 消歧。
- cloud-native / Volc Mongo 的结构化写操作使用 `bytedoc db collection ...` 和 `bytedoc db document ...`。
- `list` / `follow` / `slow-query` 仍只有 classic / cloud-native 平台接口，没有独立 Volc 后端；Volc 页面上的日志、备份、参数等能力属于 DBW / Volc 详情面，不等同于这些平台接口。
- 慢查询使用 `bytedoc db slow-query ...`；classic 的 detail 支持 fingerprint id 自动展开。

## Quick start

```bash
# 搜索 / 列表 / 详情
bytedcli bytedoc db search --keyword "demo_orders"
bytedcli bytedoc db search --keyword "demo_orders" --backend volc
bytedcli --json bytedoc db list
bytedcli --json bytedoc db list --all --deploy-mode cloud-native
bytedcli --json bytedoc db get --service "demo_orders" --deploy-mode classic

# 集合与 Mongo shell 风格查询
bytedcli --json bytedoc db collections --service "demo_orders"
bytedcli --json bytedoc db query --service "demo_orders" --collection "demo_records" --query 'find().limit(10)'
bytedcli --json bytedoc db query --service "example.bytedoc.demo_catalog" --backend volc --collection "demo_items" --query 'find().limit(10)'

# cloud-native / Volc Mongo 结构化写操作
bytedcli --json bytedoc db collection create --service "example.bytedoc.demo_catalog" --collection "demo_items"
bytedcli --json bytedoc db document query --service "example.bytedoc.demo_catalog" --collection "demo_items" --filter-json '{"tenant":"demo"}' --limit 10
bytedcli --json bytedoc db document insert --service "example.bytedoc.demo_catalog" --collection "demo_items" --doc-json '{"tenant":"demo","value":1}'

# 慢查询
bytedcli --json bytedoc db slow-query overview --service "demo_orders" --deploy-mode classic --millis 100
```

## Notes

- 需要结构化输出加 `--json`，并放在 `bytedoc` 前面。
- 完整 collection / document CRUD、`--query-file`、JSON 文件入参和慢查询命令矩阵见 `references/bytedoc.md`。
- 对现有业务集合执行写入、删除或重命名前，先确认目标 service、db、collection 和 filter；批量更新/删除需显式传 `--many`。

## References

- `references/bytedoc.md`
- `references/invocation.md`
- `references/troubleshooting.md`
