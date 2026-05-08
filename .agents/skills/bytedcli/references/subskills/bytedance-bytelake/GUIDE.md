---
name: bytedance-bytelake
description: "Create and validate ByteLake Hive tables via bytedcli using DataLeap CoralNG Hive bridge. Use when tasks mention ByteLake/Bytelake, DataLeap, Coral, creating Hive tables stored as ByteLake, setting recordkey/precombine, partitioning, clustering/buckets, TTL, or when you need a repeatable CLI workflow for table creation across Hive-supported regions such as cn, sg, gcp, va, mycis, mybd, us-ttp, eu-ttp2, eu-compliance2, and eu-ttp."
---

# bytedcli ByteLake (DataLeap CoralNG Hive bridge)

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

- 创建 ByteLake 表（`STORED AS ByteLake`）
- 在创建前通过 `bridge/hive/explain` 校验 DDL
- 对已有 `CREATE TABLE ... STORED AS ByteLake` DDL 做 explain / create
- 用结构化参数生成标准 ByteLake DDL（字段/分区/聚簇/桶/recordkey/precombine）
- 在 Hive 支持的多个机房之间切换创建（cn、sg、gcp、va、mycis、mybd、us-ttp、eu-ttp2、eu-compliance2、eu-ttp）

## 前置条件

- 已登录对应站点：`bytedcli auth status` / `bytedcli auth login`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Supported Regions

| Hive region (`--region`) | 建议站点 (`--site`) |
|---|---|
| `cn` | `cn` |
| `sg` | `i18n-tt` |
| `gcp` | `i18n-tt` |
| `va` | `i18n-tt` |
| `mycis` | `i18n-bd` |
| `mybd` | `i18n-bd` |
| `us-ttp` | `i18n-tt` |
| `eu-ttp2` | `i18n-tt` |
| `eu-compliance2` | `i18n-tt` |
| `eu-ttp` | `i18n-tt` |

## --site 与 --region 的搭配（必看）

- `--region cn`：建议 `--site cn`
- `--region sg|gcp|va|us-ttp|eu-ttp2|eu-compliance2|eu-ttp`：建议 `--site i18n-tt`
- `--region mycis|mybd`：建议 `--site i18n-bd`  

## Quick start

### 1) 先校验 DDL（不创建）

```bash
bytedcli --site cn bytelake table create \
  --region cn \
  --db demo_db \
  --table demo_tbl \
  --comment "demo bytelake table" \
  --column "id:bigint:pk" \
  --column "name:string:name" \
  --partition-column "pdate:string:ds" \
  --record-key "id" \
  --precombine "id" \
  --username your.name \
  --explain-only
```

### 2) 创建表

```bash
bytedcli --site cn bytelake table create \
  --region cn \
  --db demo_db \
  --table demo_tbl \
  --comment "demo bytelake table" \
  --column "id:bigint:pk" \
  --column "name:string:name" \
  --partition-column "pdate:string:ds" \
  --cluster-by "id" --buckets 32 \
  --record-key "id" \
  --precombine "id" \
  --ttl 7 --ttl-column pdate --ttl-pattern yyyyMMdd \
  --username your.name
```

### 3) 直接提交 DDL

默认只做 explain：

```bash
bytedcli --site cn bytelake ddl apply \
  --region cn \
  --sql "CREATE TABLE \`demo_db\`.\`demo_tbl\` (\`id\` bigint) STORED AS ByteLake" \
  --username your.name
```

显式创建时，追加 `--no-explain-only`：

```bash
bytedcli --site cn bytelake ddl apply \
  --region cn \
  --sql "CREATE TABLE \`demo_db\`.\`demo_tbl\` (\`id\` bigint) STORED AS ByteLake" \
  --username your.name \
  --no-explain-only
```

## Notes

- `--column` / `--partition-column` 是可重复参数，格式为 `name:type[:comment]`
- `--cluster-by` 与 `--buckets` 必须同时提供
- `--record-key` / `--precombine` 会写入 `TBLPROPERTIES`，用于 ByteLake MERGE_ON_READ
- `--explain-only` 只跑校验，不会触发创建请求
- `bytelake ddl apply` 默认也是 explain-only；需要创建时显式传 `--no-explain-only`

## References

- `references/bytelake.md`
- `references/invocation.md`
- `references/troubleshooting.md`
