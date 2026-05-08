---
name: bytedance-cache
description: "Operate Cache platform via bytedcli: list/search cache services, get service details, execute Redis commands, query slow logs, list big keys, manage tickets. Use when tasks mention cache services, Redis queries, slow logs, or big keys."
---

# bytedcli Cache

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

- 缓存服务搜索 / 收藏 / 详情
- Redis 命令执行
- 慢查询、大热 Key 查询
- 工单管理
- 支持国内站（prod）和海外站；使用全局 `--site` 选择站点：`i18n-tt`（SG）、`ttp-us-limited`（US TTP）、`ttp-eu`（EU TTP）

## 前置条件

- 使用通用调用方式：`references/invocation.md`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

```bash
# 服务列表
bytedcli cache list-starred-service --page 1 --page-size 20
bytedcli cache search-service --keyword "cache.demo" --page 1 --page-size 20
bytedcli cache get-service --psm "cache.demo"

# Redis 命令
bytedcli cache execute-command --psm "cache.demo" --command "GET" --args "key"

# 慢查询 / 大热 Key
bytedcli cache slow-log --psm "cache.demo"
bytedcli cache list-big-keys --psm "cache.demo" --date "2026-02-05" --start "00:00:00" --end "23:59:59"

# 工单
bytedcli cache list-my-tickets --psm "cache.demo"
bytedcli cache list-service-tickets --psm "cache.demo" --page 1 --page-size 20
```

## Notes

- 需要结构化输出加 `--json`（全局选项，放在子命令之前，如 `bytedcli --json cache list-starred-service ...`）
- Flag renames: `--page-num` is now `--page`, `--begin` is now `--start`; old names still work as hidden aliases
- 海外 TTP 场景使用全局 `--site ttp-us-limited` 或 `--site ttp-eu`；别名 `us-ttp` / `eu-ttp` 也可用。Per-service `--cache-site` is a hidden alias for backward compatibility.

## References

- `references/cache.md`
