---
name: bytedance-starling
description: "Use bytedcli Starling to manage Starling i18n businesses, projects, workflows, members, imports, spaces, tasks, task exports, and release/version workflows through the official AK/SK OpenAPI. Trigger when tasks mention Starling, i18n project setup, Starling spaces, Starling tasks, Starling release workflows, Starling text import, Starling text lookup, or Starling AK/SK configuration."
---

# bytedcli Starling

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

- 查询 Starling 业务线、项目、空间、任务、待发布文案与版本信息
- 查询 Starling 项目工作流、成员、操作记录与文案导入状态
- 创建或更新 Starling 项目、空间，以及空间/任务下的源文案与翻译文案
- 在 Starling 项目内搜索文案 key 或源文案
- 发起 Starling 发布、查询发布状态、校验版本冲突、执行回滚或重试
- 配置或检查 Starling AK/SK

## Do not use

- 不要用它处理浏览器登录态才可访问的 Starling 页面接口
- 不要用它代替 Feishu/Lark 文档协作，文档场景使用 `bytedance-feishu`

## 前置条件

- 先到 [Starling 个人中心 AK/SK 页面](https://starling.bytedance.net/personal_center#aksk) 创建 AK/SK
- 首次使用可执行 `bytedcli starling auth config --access-key <ak> --secret-key <sk>`
- 需要机器可读输出时，把 `--json` 放在 `starling` 前面

## Quick start

```bash
bytedcli starling auth status
bytedcli --json starling business list --limit 20
bytedcli --json starling project list --limit 20
bytedcli --json starling project get --project-id <project-id>
bytedcli --json starling project create --business-id <id> --name demo-project --source-locale en --target-locale zh,ja
bytedcli --json starling project search-text --project-id <project-id> --search-key welcome --limit 20
bytedcli --json starling project workflow list --project-id <project-id>
bytedcli --json starling project member list --project-id <project-id>
bytedcli --json starling project import start --project-id <project-id> --namespace-id <namespace-id> --file ./sample.xlsx --async
bytedcli --json starling task list --project-id <project-id> --limit 20
bytedcli --json starling task view --project-id <project-id> --task-id <task-id>
bytedcli --json starling task create --project-id <project-id> --name demo-task --namespace-id 101,102 --target-lang zh,ja
bytedcli --json starling task source view --project-id <project-id> --task-id <task-id> --source-id <source-id>
bytedcli --json starling task source download --project-id <project-id> --task-id <task-id> --output sample-task-source.zip
bytedcli --json starling task target delete --project-id <project-id> --task-id <task-id> --target-id <target-id>
bytedcli --json starling task text count --project-id <project-id> --task-id 101,102
bytedcli --json starling task text download --project-id <project-id> --task-id <task-id> --output sample-task-texts.zip
bytedcli --json starling task text async list
bytedcli --json starling task text async download --download-task-id <download-task-id> --output sample-task-texts.zip
bytedcli --json starling release list-pending --project-id <project-id> --namespace-id <namespace-id> --locale zh
bytedcli --json starling release publish --project-id <project-id> --namespace-id <namespace-id> --locale zh --key welcome.title
bytedcli --json starling release status --ticket-id <ticket-id>
bytedcli --json starling release version list --project-id <project-id> --namespace-id <namespace-id>
bytedcli --json starling space list --project-id <project-id> --limit 20
bytedcli --json starling space create --project-id <project-id> --name sample-space
bytedcli --json starling space update --project-id <project-id> --namespace-id <namespace-id> --description "updated by cli"
bytedcli --json starling space source view --project-id <project-id> --namespace-id <namespace-id> --source-id <source-id>
bytedcli --json starling space source multi-update --project-id <project-id> --namespace-id <namespace-id> --texts-json '[{"key":"welcome","content":"Welcome back"}]'
bytedcli --json starling space target download --project-id <project-id> --namespace-id <namespace-id> --output sample-space-target.zip --target-lang zh,ja
```

## Workflow

1. 先执行 `starling auth status`，确认当前凭据来源和 base URL。
2. 创建项目之前，先 `starling business list` 获取 `business-id`。
3. 需要管理任务本体时，优先使用 `starling task list|view|create|update`。
4. 需要定位项目内文案时，优先使用 `starling project search-text --project-id <id> --search-key <key>`。
5. 需要管理空间文案时，优先使用 `starling space source *` / `starling space target *`。
6. 需要管理任务文案时，优先使用 `starling task source *` / `starling task target *`。
7. 需要统计或批量导出任务文案时，优先使用 `starling task text count|download`。
8. 需要发布空间文案时，优先使用 `starling release list-pending|publish|status`。
9. 需要校验版本、查看版本历史或处理失败发布时，优先使用 `starling release version *`、`starling release conflict check`、`starling release rollback|retry`。
10. 需要查看项目工作流、成员或操作记录时，优先使用 `starling project workflow *`、`starling project member *`、`starling project record *`。
11. 需要批量导入项目文案时，优先使用 `starling project import start|status|cancel`。

## Notes

- 当前支持的能力都是 Starling 官方 AK/SK OpenAPI，不依赖浏览器 cookie
- 默认 base URL 是 `https://starling.bytedance.net/gateway/openapi`
- 如需 BOE，可通过 `--base-url https://starling.boe.bytedance.net/gateway/openapi` 覆盖
- `space source view` 支持 `--source-id` 或 `--key`；`space target delete` 支持 `--target-id` 或 `--key-text --locale`
- 同步下载命令需要 `--output`；`task text download --async` 会返回异步导出任务号
- `task text async list|download|delete` 用于查询、取回和删除异步导出任务
- `release publish` 返回 `ticketId` 和 `batchVersion`；可通过 `release status` 继续轮询结果
- `release publish` 支持直接传 `--locale/--key`，也支持用 `--keys-lang-maps-json|file` 与 `--ns-version-map-json|file` 进行复杂发布
- `project import start` 使用 multipart 上传文件；`--is-across` 需要同时传 `--task-id`

## References

- `references/starling.md`
