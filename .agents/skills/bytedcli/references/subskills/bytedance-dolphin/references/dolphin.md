# Dolphin CLI Reference

## Commands

### event

- `bytedcli dolphin event get --event-id <id> [--env prod|boe]`
- `bytedcli dolphin event groups --event-id <id> [--pattern <kw>] [--page N] [--page-size N] [--with-rules] [--env prod|boe]`
- `bytedcli dolphin event vars --event-id <id> [--need-ref-info] [--env prod|boe]`
- `bytedcli dolphin event params --event-id <id> [--need-ref-info] [--env prod|boe]`
- `bytedcli dolphin event testcases list --event-id <id> --bizline-id <id> [--scope 0|1] [--env-name <name>] [--draft-user <prefix>] [--env prod|boe]`
- `bytedcli dolphin event testcases check [--body <json>|--body-file <path>] [--env prod|boe]`

### group

- `bytedcli dolphin group get --group-id <id> [--with-rules] [--with-template] [--with-testcases] [--env prod|boe]`
- `bytedcli dolphin group testcases --group-id <id> [--env-name <name>] [--user-draft <prefix>] [--env prod|boe]`
- `bytedcli dolphin group factors --group-id <id> [--need-ref-info] [--env prod|boe]`
- `bytedcli dolphin group feature-env --group-id <id> --env-name <name> [--env prod|boe]`
- `bytedcli dolphin group history get --group-id <id> --version <n> [--env prod|boe]`
- `bytedcli dolphin group history list --group-id <id> [--page N] [--page-size N] [--env prod|boe]`

### rule

- `bytedcli dolphin rule get --rule-id <id> [--env prod|boe]`

## Output

- 默认文本模式输出表格。
- 全局 `--json` 时输出结构化 JSON（注意必须放在 `dolphin` 前面）。

## Invocation

统一使用：

```bash
bytedcli <command> [options]
```

示例：

```bash
bytedcli dolphin event get --event-id 12345
```
