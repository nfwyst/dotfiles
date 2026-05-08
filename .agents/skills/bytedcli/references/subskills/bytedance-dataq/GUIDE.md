---
name: bytedance-dataq
description: "Operate DataQ platform via bytedcli: run RDS queries via DataQ. Use when tasks mention querying DataQ or dataq rds operations."
---
# bytedcli DataQ

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

- 通过 DataQ 平台查询 RDS 数据库的数据

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 需要鉴权时先登录：`bytedcli --site i18n-tt auth login`
- dataq平台主要供海外区域使用，需要获取i18n-tt站点授权

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

```bash
# 执行 DataQ RDS 查询 (US)
bytedcli --site i18n-tt dataq rds-query --geo "US" --dbname "my_database" --query "select * from users limit 10"

# 执行 DataQ RDS 查询 (EU)
bytedcli --site i18n-tt dataq rds-query --geo "EU" --dbname "my_database" --query "select * from users limit 10"
```

## 参数说明

- `--geo`: (必填) 地理位置，仅支持 "US" 或 "EU"。
  - 当 geo 为 "US" 时，底层自动使用 `https://cloud-ttp-us.bytedance.net` 获取 JWT，且请求的 region 对应 "ova"。
  - 当 geo 为 "EU" 时，底层自动使用默认的 ByteCloud 获取 JWT，且请求的 region 对应 "us_east_gcp"。
- `--dbname`: (必填) 数据库名。
- `--query`: (必填) SQL 查询语句。

## Notes

- 需要结构化输出加 `--json`（全局选项，放在子命令之前，如 `bytedcli --json dataq rds-query ...`）

## References

- `references/dataq.md`
