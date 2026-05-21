---
name: bytedance-gecko
description: "Use bytedcli gecko commands to query Gecko CN read-only resources, including apps, projects, deployments, channels, offline rule trees, offline packages, package files, logs, and patches."
---

# bytedcli Gecko CN

## Invocation

```bash
bytedcli --site cn gecko <resource> <action> [options]
```

## Quick start

```bash
bytedcli --site cn gecko app list --query demo-app
bytedcli --site cn gecko project list --query demo-project
bytedcli --site cn gecko channel list --query demo-channel
bytedcli --site cn gecko channel get --channel-id sample-channel-id
bytedcli --site cn gecko deployment get --access-key redacted-access-key
bytedcli --site cn gecko offline tree --channel-id sample-channel-id --include-packages
bytedcli --site cn gecko offline package list --channel-id sample-channel-id --page 1 --page-size 10
bytedcli --site cn gecko offline package list --channel-id sample-channel-id --status 6
bytedcli --site cn gecko offline package get --package-id sample-package-id
bytedcli --site cn gecko offline package files --package-id sample-package-id
bytedcli --site cn gecko offline package logs --package-id sample-package-id
bytedcli --site cn gecko offline package patches --package-id sample-package-id
```

## Notes

- This command set is read-only.
- Auth uses ByteCloud JWT with `x-jwt-token`; run `bytedcli --site cn auth login` if auth is missing or expired.
- Offline package `--status` accepts comma-separated numeric codes or Chinese labels: `1=处理中`, `2=处理失败`, `3=待发布`, `4=实验中`, `5=灰度中`, `6=全量`, `7=已关闭`, `8=部分清理`, `9=全量清理`.
- Text output avoids access keys, TOS URLs, package schemas, and patch download URLs by default. Use `--json` when raw fields are required for automation.
