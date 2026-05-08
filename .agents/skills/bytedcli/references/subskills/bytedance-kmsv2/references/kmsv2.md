# KMS v2 (Key Management Service v2)

```bash
# 获取密钥环信息（VA 区域）
bytedcli kmsv2 get-keyring <namespace> --region va

# 获取密钥环信息（SG 区域）
bytedcli kmsv2 get-keyring <namespace> --region sg

# 获取密钥环信息（BOE-I18N 区域）
bytedcli kmsv2 get-keyring <namespace> --region boei18n

# 列出客户密钥
bytedcli kmsv2 list-keys <namespace> --region va

# 获取客户密钥详情
bytedcli kmsv2 get-key <namespace> --key-name <keyName> --region va

# 添加服务权限（PSM 自动转换为 SPIFFE）
bytedcli kmsv2 add-permission <namespace> --key-name <keyName> --services <psm1> <psm2> --region va

# 添加用户权限
bytedcli kmsv2 add-permission <namespace> --key-name <keyName> --users <user1> <user2> --region va

# 同时添加服务和用户权限
bytedcli kmsv2 add-permission <namespace> --key-name <keyName> --services <psm1> --users <user1> --region va
```

## 区域与 API 域名对应关系

- VA (US)：`prod-row-kmsv2-control-og.tiktok-row.org`
- SG：`prod-row-kmsv2-control-sg.tiktok-row.org`
- BOE-I18N：`boei18n-kmsv2-control.byted.org`

## 权限管理说明

- `--services`：服务 PSM 名称，会自动转换为 SPIFFE URI（添加到 Decode 和 Encode ACL）
- `--users`：用户名，添加到 user_authorization_data
- `add-permission` 是增量操作，新权限会与现有权限合并

## SPIFFE URI 格式

服务 PSM 会按区域转换为 SPIFFE URI：
- ROW：`spiffe://row.byted.org/ns:*/r:*/vdc:*/id:<psm>`
- BOE：`spiffe://boe.byted.org/ns:*/r:*/vdc:*/id:<psm>`

## ⚠️ 并发安全警告

`add-permission` 命令采用 read-modify-write 模式实现：
1. 读取当前密钥权限
2. 合并新权限
3. 写回更新后的权限

此操作**不是原子的**，存在竞态条件风险。如果多个操作同时执行，可能导致部分权限丢失。

**请勿在以下场景使用**：
- 高频自动化脚本
- 多人同时操作同一密钥
- CI/CD 并行任务
