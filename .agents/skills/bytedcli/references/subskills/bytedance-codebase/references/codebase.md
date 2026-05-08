# Codebase (bytedcli)

```bash
# 在 code.byted.org 或 code-tx.byted.org 的 Git 仓库目录内，支持仓库选择器的命令可省略 -R/--repo 或 --repo-name

# Auth
bytedcli codebase auth config-add-pat <pat>
bytedcli codebase auth config-auth --jwt-token <token>

# Repo
bytedcli codebase repo get "byteapi/bytedcli"
bytedcli codebase repo list --query "bytedcli"
bytedcli codebase repo branch create feat/demo -R "byteapi/bytedcli" --from master
bytedcli codebase repo file "README.md" -R "byteapi/bytedcli"
bytedcli codebase commit list -R "byteapi/bytedcli" --revision master
bytedcli codebase commit get -R "byteapi/bytedcli" --revision <sha>

# Issue
bytedcli codebase issue list -R "byteapi/bytedcli" # 默认只看 open
bytedcli codebase issue list -R "byteapi/bytedcli" --status todo --limit 20
bytedcli codebase issue get "https://code.byted.org/byteapi/bytedcli/issues/52"
bytedcli codebase issue comment 24 -R "byteapi/bytedcli" --body "ack"
bytedcli codebase issue delete 24 -R "byteapi/bytedcli"

# MR 基础查询
bytedcli codebase mr get 821 -R "byteapi/bytedcli"
bytedcli codebase mr get
bytedcli codebase mr get "https://code.byted.org/byteapi/bytedcli/merge_requests/821"
bytedcli codebase mr comment list 821 -R "byteapi/bytedcli"
bytedcli codebase mr files 821 -R "byteapi/bytedcli"
bytedcli codebase mr diff 821 -R "byteapi/bytedcli" --file "path/to/file.ts"
bytedcli codebase repo tag list -R "byteapi/bytedcli" --query "v1." --query-mode prefix
bytedcli codebase repo tag create -R "byteapi/bytedcli" --name v1.0.1 --revision master --message "Release v1.0.1"
bytedcli codebase release list -R "byteapi/bytedcli" --query "v1." --query-mode prefix
bytedcli codebase release get -R "byteapi/bytedcli" --tag v1.0.0
bytedcli codebase release create -R "byteapi/bytedcli" --tag v1.0.1 --description "Release v1.0.1" --revision master --tag-message "Release v1.0.1"
bytedcli codebase release update -R "byteapi/bytedcli" --tag v1.0.1 --description "Updated release notes"

# CI / Check Runs
bytedcli codebase checks mr 821 -R "byteapi/bytedcli"
bytedcli codebase checks list -R "byteapi/bytedcli"
bytedcli codebase checks list -R "byteapi/bytedcli" --commit <sha> --mr 821
bytedcli codebase checks mr --commit <sha> -R "byteapi/bytedcli"
bytedcli codebase checks get -R "byteapi/bytedcli" --id <check_run_id>
bytedcli codebase checks log 2395465271 unit_test_and_coverage --run-seq 126 --step-id 1259002466
bytedcli codebase checks log 2552744121 build_lint-step_4 --run-seq 1 --no-limit
bytedcli codebase checks log --url "https://bits.bytedance.net/p/job_runs/2395465271/step_logs/unit_test_and_coverage?runSeq=126&stepId=1259002466"
bytedcli codebase checks log -R "byteapi/bytedcli" --check-run-id 765416657961248
bytedcli codebase mr artifacts list 821 -R "example-org/example-repo" --artifact example-artifact-filename
bytedcli codebase mr artifacts download 821 -R "example-org/example-repo" --artifact example-artifact-filename --all --output-dir ./ci-artifacts
# Logs can be large; prefer redirecting to a file and searching locally.
bytedcli codebase checks log -R "byteapi/bytedcli" --check-run-id 765416657961248 > /tmp/check.log
grep -n 'error\\|fail' /tmp/check.log
bytedcli codebase mr status 821 -R "byteapi/bytedcli"

# Comment
bytedcli codebase mr comment draft 821 -R "byteapi/bytedcli" --body "draft comment"
bytedcli codebase mr comment publish 821 -R "byteapi/bytedcli" --body "LGTM"
bytedcli codebase mr comment reply 821 -R "byteapi/bytedcli" --thread-id <thread_id> --body "fixed"
bytedcli codebase mr comment resolve -R "byteapi/bytedcli" --id <thread_id>

# 创建 / 更新 PR
bytedcli codebase mr create -R "byteapi/bytedcli" \
  --title "feat: demo"
bytedcli codebase mr create -R "byteapi/bytedcli" \
  --title "feat: demo" --meego 7074189149
bytedcli codebase mr update 821 -R "byteapi/bytedcli" --body "first line\nsecond line"
bytedcli codebase mr update 821 -R "byteapi/bytedcli" --meego 7074189149
bytedcli codebase mr update 821 -R "byteapi/bytedcli" --base develop   # 切 MR 的 target branch 到另一条 release/集成分支

# 搜索 Meego 工作项（获取 work_item_id 后填入 MR）
bytedcli --json meego workitem list --project-key <project_key> \
  --mql "SELECT \`work_item_id\`, \`name\` FROM \`<project_key>\`.\`story\` WHERE \`name\` LIKE '%关键字%' LIMIT 10"

# PR 列表 / 生命周期
bytedcli codebase mr list -R "byteapi/bytedcli" # 默认只看 open
bytedcli codebase mr list -R "byteapi/bytedcli" --state open -H feature/foo -B master -L 20
bytedcli codebase search mr --author @me --status open --page-size 5
bytedcli codebase mr count -R "byteapi/bytedcli"
bytedcli codebase mr close 821 -R "byteapi/bytedcli"
bytedcli codebase mr reopen 821 -R "byteapi/bytedcli"
bytedcli codebase mr merge 821 -R "byteapi/bytedcli" --merge-method rebase_merge

# PR Review / Queue
bytedcli codebase mr review 821 -R "byteapi/bytedcli" --approve --body "LGTM" # 自动附带当前 MR 最新 source commit
bytedcli codebase mr review --comment --body-file ./review.txt
bytedcli codebase mr reviewer list 821 -R "byteapi/bytedcli"
bytedcli codebase mr reviewer update 821 -R "byteapi/bytedcli" --add 123456 --add 234567
bytedcli codebase mr reviewer update 821 -R "byteapi/bytedcli" --add alice --remove bob   # 支持 username
bytedcli codebase mr bypass list 821 -R "byteapi/bytedcli"
bytedcli codebase mr bypass create 821 -R "byteapi/bytedcli" --inputs-json '[{"kind":"check_run","target":"check_name"}]'
bytedcli codebase mr queue status -R "byteapi/bytedcli"
bytedcli codebase mr queue list -R "byteapi/bytedcli" -L 20
bytedcli codebase mr queue entries 821 -R "byteapi/bytedcli"
bytedcli codebase mr queue enqueue 821 -R "byteapi/bytedcli" --merge-method rebase_merge
bytedcli codebase mr queue dequeue 821 -R "byteapi/bytedcli"

# Check Run 读写
bytedcli codebase checks get -R "byteapi/bytedcli" --id c1
bytedcli codebase checks create -R "byteapi/bytedcli" --payload-json '{"Name":"ci/test","CommitId":"<sha>"}'
bytedcli codebase checks update -R "byteapi/bytedcli" --payload-json '{"Id":"c1","Status":"completed","Conclusion":"success"}'
bytedcli codebase checks operate -R "byteapi/bytedcli" --payload-json '{"Id":"c1","OperationId":"retry"}'
bytedcli codebase search issue --assignee @me --status todo --page-size 5

# Permission（依赖权限）
bytedcli codebase permission check -R "byteapi/bytedcli"
bytedcli codebase permission check -R "byteapi/bytedcli" --revision main
bytedcli --json codebase permission check -R "byteapi/bytedcli"
bytedcli codebase permission apply -R "byteapi/bytedcli" --action reporter --reason "need read access" --repos "dep-org/dep-repo"
bytedcli codebase permission apply -R "byteapi/bytedcli" --action developer --reason "need write access" --repos "dep-org/repo1,dep-org/repo2"
```

## 迁移说明

- 公开命令树已切换为 `codebase auth|repo|commit|mr|issue|checks|search` 的资源分组形式；MR 评论统一走 `codebase mr comment`，reviewer/bypass/queue 相关操作分别走 `codebase mr reviewer|bypass|queue`，跨仓库搜索走 `codebase search mr|issue`，master 上已有的平铺命令仍保留为兼容入口。
- 当前 Git 仓库 `origin` 可用于自动推断仓库；如果推断失败，CLI 会说明是非 Git 仓库、缺少 `origin`、host 不支持，还是 remote 无法解析。
- 主仓库选择器统一推荐 `-R, --repo`；PR / issue 编号默认使用位置参数；正文统一用 `--body`，PR 创建改用 `--head/--base`。
- `codebase commit list|get` 使用 `--revision` 指定 branch/tag/commit SHA；未显式传入时会优先使用当前 Git 分支，失败后回落到仓库默认分支。
- `codebase release list|get|create|update` 用于查询和维护挂在 tag 上的 release 描述；`release list` 会按 tag 扫描并解析 release，tag 很多时会更慢。
- `codebase checks list` 会保留 branch / commit 级 check runs，并在能解析出对应 MR 或显式传入 `--mr` / `--mr-id` 时，额外分组展示 `MR Check Runs`。
- `codebase mr artifacts list|download` 会解析 MR check run 正文里的 BITS artifact 链接；下载多个匹配项时需要 `--all`，文件默认按 check run id 分目录保存。
- 旧的扁平命令如 `get-merge-request`、`create-mr`、`create-branch`、`list-check-runs` 仍保留为隐藏兼容别名，建议新流程切到新命令树。

## CI 排障顺序

1. 先用 `codebase checks mr <mr>` 看 MR 级 checks，总结失败项和运行中项。
2. 再用 `codebase checks get --id <check_run_id>` 看失败 job、step 和 step 链接。
3. 默认用 `codebase checks log --check-run-id <id>` 批量展开整条 check run 的日志。
4. 若 check run 暴露 artifacts，用 `codebase mr artifacts list` 先确认可下载项，再用 `download --artifact <name>` 拉取完整包。
5. 日志优先重定向到文件，再用 `rg` / `grep` / `less` 搜索，不要直接把全文贴进上下文。
6. 看到失败后，先判断是业务代码失败、CLI 自己回归，还是外部平台问题，再决定修复方向。
