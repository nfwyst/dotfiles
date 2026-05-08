# IAM (Identity and Access Management)

```bash
# 查询员工信息
bytedcli iam get-employee <username>

# JSON 格式输出
bytedcli --json iam get-employee <username>
```

## 返回字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `peopleId` | number | 员工 ID |
| `username` | string | 用户名 |
| `displayName` | string | 显示名称 |
| `email` | string | 邮箱地址 |
| `idPhotoUrl` | string | 证件照 URL |
