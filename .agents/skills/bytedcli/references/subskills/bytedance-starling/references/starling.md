# Starling via bytedcli

优先用 `bytedcli --json starling ...` 调用 Starling 能力。

## 推荐命令

- 凭据配置：`starling auth config|status`
- 业务：`starling business list`
- 项目：`starling project list|view|create|update|search-text|workflow *|member *|record *|text-record *|import *`
- 任务：`starling task list|view|create|update`
- 空间：`starling space list|view|create|update`
- 空间文案：`starling space source view|list|add|update|multi-update|delete|download`、`starling space target list|update|delete|download`
- 任务文案：`starling task source view|list|add|update|delete|download`、`starling task target list|update|delete|download`
- 任务统计/导出：`starling task text count|download|async *`
- 发布与版本：`starling release list-pending|publish|status|version *|conflict check|rollback|retry`

## 常见流程

1. `starling auth status`
2. `starling business list`
3. `starling project create ...`
4. `starling task create ...`
5. `starling space create ...`
6. `starling project search-text ...`
7. `starling project workflow list ...`
8. `starling project import start ...`
9. `starling space source view ...`
10. `starling task text count ...`
11. `starling task text async list`
12. `starling release list-pending ...`
13. `starling release publish ...`
