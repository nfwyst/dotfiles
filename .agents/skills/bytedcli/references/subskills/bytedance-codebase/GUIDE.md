---
name: bytedance-codebase
description: "Operate Codebase: repositories, merge requests, diffs, files, check runs, CI analysis, and dependency permissions."
---

# Codebase（bytedcli）

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

- 仓库查询、MR 详情/评论
- Diff 列表/内容、文件查看
- Check Runs 与 CI 失败分析
- 聚合 MR 状态与跨仓库搜索
- 创建分支
- 创建 Merge Request
- MR 关联 Meego 工作项（需求/缺陷）
- 依赖权限检查与批量申请

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 认证优先级：本地 `codebase_auth.json` JWT > `BYTEDCLI_USER_CODE_JWT` > `AIME_USER_CODE_JWT` > PAT。需要手动配置 PAT 时使用：`bytedcli codebase auth config-add-pat <pat>`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

```bash
# 仓库
bytedcli codebase repo get "example-org/example-repo"

# MR 详情/评论
bytedcli codebase mr get 821 -R "example-org/example-repo"
bytedcli codebase mr comment list 821 -R "example-org/example-repo"

# Diff 文件/内容
bytedcli codebase mr files 821 -R "example-org/example-repo"
bytedcli codebase mr diff 821 -R "example-org/example-repo" --file "path/to/file.ts"

# 文件内容
bytedcli codebase repo file "README.md" -R "example-org/example-repo"

# 创建 Branch
bytedcli codebase repo branch create feat/demo -R "example-org/example-repo" --from master

# 管理 Tag
bytedcli codebase repo tag list -R "example-org/example-repo" --query "v1." --query-mode prefix
bytedcli codebase repo tag get -R "example-org/example-repo" --name v1.0.0
bytedcli codebase repo tag create -R "example-org/example-repo" --name v1.0.1 --revision master --message "Release v1.0.1"
bytedcli codebase repo tag delete -R "example-org/example-repo" --name v1.0.1

# 管理 Release
bytedcli codebase release list -R "example-org/example-repo" --query "v1." --query-mode prefix
bytedcli codebase release get -R "example-org/example-repo" --tag v1.0.0
bytedcli codebase release create -R "example-org/example-repo" --tag v1.0.1 --description "Release v1.0.1" --revision master --tag-message "Release v1.0.1"
bytedcli codebase release update -R "example-org/example-repo" --tag v1.0.1 --description "Updated release notes"

# 创建 MR
bytedcli codebase mr create -R "example-org/example-repo" --title "feat: demo"
bytedcli codebase mr create -R "example-org/example-repo" --title "feat: demo" --meego 7074189149

# 更新 MR：关联工作项 / 切 target branch
bytedcli codebase mr update 821 -R "example-org/example-repo" --meego 7074189149
bytedcli codebase mr update 821 -R "example-org/example-repo" --base develop

# Check Runs / CI
bytedcli codebase checks mr 821 -R "example-org/example-repo"
bytedcli codebase checks list -R "example-org/example-repo"
bytedcli codebase checks list -R "example-org/example-repo" --commit <sha> --mr 821
bytedcli codebase checks mr --mr "https://code.byted.org/example-org/example-repo/merge_requests/821" -R "example-org/example-repo"
bytedcli codebase checks get -R "example-org/example-repo" --id c1
bytedcli codebase checks log 2395465271 unit_test_and_coverage --run-seq 126 --step-id 1259002466
bytedcli codebase checks log 2552744121 build_lint-step_4 --run-seq 1 --no-limit
bytedcli codebase checks log --url "https://bits.bytedance.net/p/job_runs/2395465271/step_logs/unit_test_and_coverage?runSeq=126&stepId=1259002466"
bytedcli codebase checks log -R "example-org/example-repo" --check-run-id 765416657961248
bytedcli codebase checks log -R "example-org/example-repo" --check-run-id 765416657961248 > /tmp/check.log
bytedcli codebase mr artifacts list 821 -R "example-org/example-repo" --artifact example-artifact-filename
bytedcli codebase mr artifacts download 821 -R "example-org/example-repo" --artifact example-artifact-filename --all --output-dir ./ci-artifacts
grep -n 'error\\|fail' /tmp/check.log
bytedcli codebase mr status 821 -R "example-org/example-repo"

# Issue
bytedcli codebase issue comment 24 -R "example-org/example-repo" --body "ack"
bytedcli codebase issue delete 24 -R "example-org/example-repo"
bytedcli codebase search issue --assignee @me --status todo --page-size 5

# 依赖权限
bytedcli codebase permission check -R "example-org/example-repo"
bytedcli codebase permission check -R "example-org/example-repo" --revision main
bytedcli codebase permission apply -R "example-org/example-repo" --action reporter --reason "need read access" --repos "dep-org/dep-repo"

# MR 列表 / 生命周期
bytedcli codebase mr list -R "example-org/example-repo" --state open -L 20
bytedcli codebase mr count -R "example-org/example-repo"
bytedcli codebase mr close 821 -R "example-org/example-repo"
bytedcli codebase mr status 821 -R "example-org/example-repo"

# review scope（新增）
bytedcli codebase mr review 821 -R "example-org/example-repo" --approve --body "LGTM"
bytedcli codebase mr reviewer list 821 -R "example-org/example-repo"
bytedcli codebase mr reviewer update 821 -R "example-org/example-repo" --set 123456 --set 234567
bytedcli codebase mr reviewer update 821 -R "example-org/example-repo" --set alice --add bob   # 支持 username

# merge_queue scope（新增）
bytedcli codebase mr queue status -R "example-org/example-repo"
bytedcli codebase mr queue list -R "example-org/example-repo" -L 20
bytedcli codebase mr queue enqueue 821 -R "example-org/example-repo" --merge-method rebase_merge
bytedcli codebase search mr --author @me --status open --page-size 5

# check_run scope（新增）
bytedcli codebase checks get -R "example-org/example-repo" --id c1
bytedcli codebase checks create -R "example-org/example-repo" --payload-json '{"Name":"ci/test","CommitId":"<sha>"}'
bytedcli codebase checks update -R "example-org/example-repo" --payload-json '{"Id":"c1","Status":"completed","Conclusion":"success"}'
bytedcli codebase checks operate -R "example-org/example-repo" --payload-json '{"Id":"c1","OperationId":"retry"}'
```

## Notes

### 仓库与分支推断

- 在 `code.byted.org` / `code-tx.byted.org` 的 Git 目录内，`-R/--repo` 和 `--branch`/`--commit` 可省略，CLI 自动从 `origin` 推断
- MR selector 支持 `<number> | <url> | <branch>`，未传时回落到当前 Git 分支

### 常用约定

- 结构化输出：`bytedcli --json codebase ...`（`--json` 放子命令之前）
- `mr list` 默认 open；`issue list` 默认未完成态
- 缺少必填参数会输出完整帮助

### CI 排查

- **优先用 `codebase checks log --check-run-id <id>` 看远端日志**，不要本地跑全量测试
- 日志重定向到文件后用 `grep “not ok\|fail\|error”` 定位失败点
- 排查顺序：`checks list --mr` → 找失败 check-run-id → `checks log --check-run-id` → grep
- 详见 `references/troubleshooting.md`

### MR 关联 Meego 工作项

1. 搜索：`bytedcli --json meego workitem list --project-key <key> --mql “SELECT \`work_item_id\`, \`name\` FROM \`<key>\`.\`story\` WHERE \`name\` LIKE '%关键字%' LIMIT 10”`
2. 呈现 ID + 名称列表让用户选择
3. 执行：`bytedcli codebase mr create/update --meego <work_item_id>`

### 依赖权限

```bash
bytedcli codebase permission check -R <repo>              # 查缺少权限的依赖
bytedcli codebase permission apply -R <repo> --action reporter --reason “...” --repos “dep/repo”
```

## References

- `references/codebase.md`
- `references/troubleshooting.md`
