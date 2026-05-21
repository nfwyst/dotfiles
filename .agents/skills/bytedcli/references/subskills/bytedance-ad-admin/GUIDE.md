---
name: bytedance-ad-admin
description: "Skill for ad-admin 广告白名单查询。Use when tasks mention ad-admin、广告白名单、whitelist、命中白名单、白名单日志、业务线白名单。"
---

# Ad-admin 广告白名单

## When to use

- 需要查询某个用户是否命中指定广告白名单
- 需要按白名单 ID / key 查询白名单详情和是否全量开放
- 需要查询某业务线下的白名单列表
- 需要查询当前用户或指定负责人名下的白名单
- 需要查看白名单操作日志
- 需要查询某个用户命中了哪些白名单

## 前置条件

- 需要鉴权，先登录：`bytedcli auth login`

## 常用命令

```bash
# 查看帮助
bytedcli ad-admin --help

# 查询白名单详情
bytedcli ad-admin whitelist get --id 123
bytedcli ad-admin whitelist get --key sample_whitelist_key

# 查询用户是否命中白名单
bytedcli ad-admin whitelist membership get --user-id demo-user-id --whitelist-id 1
bytedcli ad-admin whitelist membership get --user-id demo-user-id --whitelist-key sample_whitelist_key

# 查询某业务线下白名单
bytedcli ad-admin whitelist business list --platform-id 2
bytedcli ad-admin whitelist business list --platform-id 2 --full-open-only

# 查询自己/指定负责人名下白名单
bytedcli ad-admin whitelist managed list
bytedcli ad-admin whitelist managed list --manager alice

# 查询白名单操作日志
bytedcli ad-admin whitelist log list --key sample_whitelist_key --limit 10

# 查询用户命中的白名单
bytedcli ad-admin whitelist hit list --user-id demo-user-id
```

## 平台 ID 参考

- `1`: Ad 平台
- `2`: Bp 平台
- `3`: Ad 2.0
- `4`: 本地推
- `5`: 千川
- `6`: 品牌
- `7`: 商家中心

## Notes

- `--json` 是全局参数，必须放在子命令前，例如：`bytedcli --json ad-admin whitelist get --id 123`
- 当命令返回鉴权错误时，先执行 `bytedcli auth login`，再重试 ad-admin 命令
