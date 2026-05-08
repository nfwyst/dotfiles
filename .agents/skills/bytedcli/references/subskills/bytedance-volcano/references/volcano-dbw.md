# Volcano DBW (Database Workbench)

## 认证方式

DBW 命令支持两种认证方式：

1. **SSO Session 认证（推荐）**：使用 `--volc-account-id <babi-account-id>` 参数
2. **AK/SK 认证**：使用 `--access-key-id` 和 `--secret-access-key` 参数，或通过 `volcano auth config` 配置

## 命令示例

### 列出数据库实例

```bash
bytedcli volcano dbw instance list --region <region> --volc-account-id <babi-account-id>
```

### 列出实例中的数据库

```bash
bytedcli volcano dbw database list --instance-id <instance-id> --region <region> --volc-account-id <babi-account-id>
```

### 列出数据库中的表

```bash
bytedcli volcano dbw table list --instance-id <instance-id> --region <region> --database <db-name> --volc-account-id <babi-account-id>
```

### 获取表结构

```bash
bytedcli volcano dbw table get --instance-id <instance-id> --region <region> --database <db-name> --table <table-name> --volc-account-id <babi-account-id>
```

### 执行 SQL

```bash
bytedcli volcano dbw sql execute --instance-id <instance-id> --region <region> --database <db-name> --command "<sql>" --volc-account-id <babi-account-id>
```

### 从文件读取 SQL 执行

```bash
bytedcli volcano dbw sql execute --instance-id <instance-id> --region <region> --database <db-name> --command-file <file-path> --volc-account-id <babi-account-id>
```

## 参数说明

| 参数 | 说明 |
|------|------|
| `--region <region>` | 地域，如 `cn-beijing`、`cn-north-1` 等 |
| `--volc-account-id <id>` | Babi 账号 ID，用于 SSO Session 认证 |
| `--instance-id <id>` | 数据库实例 ID |
| `--database <name>` | 数据库名称 |
| `--table <name>` | 表名称 |
| `--command <sql>` | SQL 命令 |
| `--command-file <path>` | 从文件读取 SQL 命令 |

## 参考文档

- [SQL 任务执行文档](https://www.volcengine.com/docs/6956/152609?lang=zh)
- [ListDatabases 文档](https://www.volcengine.com/docs/6956/2068408?lang=zh)
- [ListTables 文档](https://www.volcengine.com/docs/6956/2068409?lang=zh)
