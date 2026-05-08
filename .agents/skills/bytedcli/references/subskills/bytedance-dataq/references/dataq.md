# DataQ

## DataQ RDS 查询

```bash
# 执行 DataQ RDS 查询 (US)
bytedcli --site i18n-tt dataq rds-query --geo "US" --dbname "my_database" --query "select * from users limit 10"

# 执行 DataQ RDS 查询 (EU)
bytedcli --site i18n-tt dataq rds-query --geo "EU" --dbname "my_database" --query "select * from users limit 10"
```

## 参数映射说明

- `--geo "US"` 会自动映射 region 为 `ova`，并使用专门的鉴权网关 `https://cloud-ttp-us.bytedance.net`。
- `--geo "EU"` 会自动映射 region 为 `us_east_gcp`，并使用默认的鉴权网关。
