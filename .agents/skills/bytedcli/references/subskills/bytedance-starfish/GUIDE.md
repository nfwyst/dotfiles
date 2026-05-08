---
name: bytedance-starfish
description: "Query Starfish moderation traces on webcast.bytedance.net via bytedcli. Use when tasks mention Starfish, review trace, moderation流水, object_id, span timeline, trace search, or webcast audit trace."
---

# bytedcli Starfish

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

- 查询某个 `object_id` 的 Starfish trace 流水
- 通过 `room_id`、`task_type`、时间范围收窄 trace 结果
- 让 agent 根据 trace span 时间线总结直播审核流水

## Do not use

- 不要把它当成通用的 `safe` 域 skill；Starfish 是独立顶层 domain
- 不要先手写 `webcast.bytedance.net` 请求；优先直接调用 `bytedcli starfish ...`
- 当前不要用它查询未接入的 Starfish 其他能力；本阶段只支持 `trace`

## 前置条件

先完成 Starfish 认证，三选一：

```bash
bytedcli starfish login
bytedcli starfish auth status
bytedcli starfish login --cookie "session=xxx"
export STARFISH_COOKIE="your_webcast_cookie"
```

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

```bash
bytedcli starfish login
bytedcli starfish auth status
bytedcli starfish trace --object-id hotsoon_live_audioslice@7634173330450402086_1777478421667
bytedcli starfish trace --object-id example_obj@1 --room-id 7634173330450402086 --task-type 203
bytedcli starfish trace --object-id example_obj@1 --start "2h ago" --end now
bytedcli --json starfish trace --object-id example_obj@1 --size 5
```

## Workflow

1. 先执行 `bytedcli starfish login`，必要时用 `bytedcli starfish auth status` 检查当前 session 是否已经授权成功。
2. 用 `starfish trace --object-id <id>` 查询指定对象的流水。
3. 需要缩小结果范围时，追加 `--room-id`、`--task-type`、`--start`、`--end`。
4. 需要 machine-readable 输出时，把 `--json` 放在 `starfish` 前面。
5. 让 agent 总结时，优先让它读取 span 时间线、标题、tag 和 show_fields 摘要，而不是直接消费长 `origin_value`。

## Natural language examples

- 查询 `hotsoon_live_audioslice@7634173330450402086_1777478421667` 的 Starfish 流水
- 用 Starfish 查这个 `object_id` 的审核 span 时间线，并总结关键节点
- 查 `object_id=example_obj@1` 最近 2 小时的 trace，按时间顺序说明发生了什么

## Notes

- 当前 Starfish CLI 首批接入的是 `trace` 查询能力，后续可以继续扩展 `task-type` 等子能力
- 认证优先级是 `--cookie` > `STARFISH_COOKIE` > `starfish login` 生成的 session > `starfish login --cookie` 保存的本地 auth
- `starfish auth status` 会同时展示当前 cookie 来源、关键 cookie 名称，以及 `portal_api/user_info` 是否已授权，可用来判断 `trace` 是否应当可用
- 文本模式会输出紧凑的 span 摘要表；`--json` 保留完整结构化结果

## References

- `references/starfish.md`
- `references/invocation.md`
- `references/troubleshooting.md`
