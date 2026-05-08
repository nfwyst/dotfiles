# ByteLake 建表（bytedcli）

本技能对应命令：

- `bytedcli bytelake table create`
- `bytedcli bytelake ddl apply`

## 支持机房

- `cn` -> `--site cn`
- `sg` / `gcp` / `va` / `us-ttp` / `eu-ttp2` / `eu-compliance2` / `eu-ttp` -> `--site i18n-tt`
- `mycis` / `mybd` -> `--site i18n-bd`

## 输入信息清单（建议按这个顺序收集）

- 站点与区域：`--site`、`--region`
- 库表名：`--db`、`--table`
- 表描述：`--comment`
- 字段：多次 `--column "name:type:comment"`
- 分区字段（可选但常用）：多次 `--partition-column "pdate:string:日期分区"`
- 聚簇/桶（可选）：`--cluster-by "id"` + `--buckets 32`
- ByteLake 主键相关：`--record-key "id"`、`--precombine "time"`
- Owner：多次 `--username your.name`
- TTL（可选）：`--ttl 7 --ttl-column pdate --ttl-pattern yyyyMMdd`

## 典型模式

### 最小可用（推荐先 explain）

```bash
bytedcli --site cn bytelake table create \
  --region cn \
  --db demo_db \
  --table demo_tbl \
  --comment "demo" \
  --column "id:bigint:pk" \
  --partition-column "pdate:string:ds" \
  --record-key "id" \
  --precombine "id" \
  --username your.name \
  --explain-only
```

### 启用 buckets

```bash
bytedcli --site cn bytelake table create \
  --region cn \
  --db demo_db \
  --table demo_tbl \
  --comment "demo" \
  --column "id:bigint:pk" \
  --column "name:string:name" \
  --partition-column "pdate:string:ds" \
  --cluster-by "id" --buckets 32 \
  --record-key "id" \
  --precombine "id" \
  --username your.name
```

### 直接提交 DDL

默认只做校验：

```bash
bytedcli --site cn bytelake ddl apply \
  --region cn \
  --sql "CREATE TABLE \`demo_db\`.\`demo_tbl\` (\`id\` bigint) STORED AS ByteLake" \
  --username your.name
```

需要真正创建时，显式传 `--no-explain-only`：

```bash
bytedcli --site cn bytelake ddl apply \
  --region cn \
  --sql "CREATE TABLE \`demo_db\`.\`demo_tbl\` (\`id\` bigint) STORED AS ByteLake" \
  --username your.name \
  --no-explain-only
```

## 输出与验证

- `--explain-only` 时，成功输出包含：`DDL validation succeeded` 和 `Skipped create`
- `bytelake ddl apply` 默认也只做 explain；显式传 `--no-explain-only` 后才会创建
- 实际创建时，成功输出包含：`DDL validation succeeded` 和 `Table created`
- 创建后可以用 Hive 域名查询元数据（示例）：

```bash
bytedcli --site cn hive detail demo_db demo_tbl --region cn
```
