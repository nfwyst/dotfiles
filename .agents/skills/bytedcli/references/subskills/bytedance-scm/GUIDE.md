---
name: bytedance-scm
description: "Operate SCM via bytedcli: list starred repos, search repos, create repos, list versions, trigger builds, and fetch build logs. Use when tasks mention SCM repositories."
---

# bytedcli SCM

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

- 仓库检索、创建、版本列表、触发构建
- 拉取构建日志

## 前置条件

- 使用通用调用方式：`references/invocation.md`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

Commands are grouped under `scm repo`. Old flat names (e.g. `scm list-starred-repo`, `scm search-repo`, `scm build-repo`, `scm get-build-log`, `scm list-repo-version`) still work as hidden aliases.

```bash
# Repo list — favor (default) / all + 服务端 search / create-user / language 过滤
bytedcli scm repo list --page 1 --page-size 10                          # 我的收藏列表
bytedcli scm repo list --all                                            # 全部仓库列表
bytedcli scm repo list --all --search sort                              # 按名称搜索（all tab）
bytedcli scm repo list --create-user <username>                         # 按 creator 过滤（favor tab）
bytedcli scm repo list --all --create-user <username> --language Go     # all tab + 多过滤组合

bytedcli scm repo search "example-org/example-repo"                     # 等价 list --all --search
bytedcli scm repo create --name "example-org/example-repo"
bytedcli scm repo version list "example-org/example-repo" --branch master --type online --status build_ok
bytedcli scm repo build "example-org/example-repo" --branch master --type test -e '{"DEMO_KEY":"VALUE"}' -m "trigger build reason"
# 指定编译架构（仅允许 x86_64 / aarch64 / x86_64,aarch64）
bytedcli scm repo build "example-org/example-repo" --branch master --type test --arch x86_64,aarch64
# 通过 commit hash 直接打包（--commit 和 --branch 互斥，不需要指定分支）
bytedcli scm repo build "example-org/example-repo" --commit abc123def456 --type offline

# Build log — 三种入口（任选其一）
bytedcli scm repo build-log "example-org/example-repo" "1.0.0.1686" --step building
bytedcli scm repo build-log --repo-id 533180 "1.0.0.1686" --step building
bytedcli scm repo build-log --record-id 9056070 --step building          # 直接按 ByteBuild record id 取
```

## 构建模式与海外 region 同步

`scm repo build` 有两种模式，直接影响构建产物能否推到 VA / SG CDN：

- **Branch 模式**（`--branch <name>`）：`pub_base=branch_base`，SCM 走分支发布流水线，如果仓库配置开启了 `sync_aws` / `sync_oss`，就会自动跑 `uploading-va-source` / `uploading-sg-source` stage，把产物推到海外 CDN。海外业务部署的构建**必须用这个模式**。
- **Commit 模式**（`--commit <hash>`）：`pub_base=commit_base`，只在国内 CDN 落地。适合一次性 hotfix 验证，不适合交付给海外环境。

区域同步开关默认继承仓库配置，可用 `--sync-aws` / `--sync-oss` / `--sync-bvc` 显式覆盖（也支持 `--no-sync-aws` 等反向开关）。

```bash
# 显式只同步 SG，不同步 VA
bytedcli scm repo build "example-org/example-repo" --branch master --type test --no-sync-aws --sync-oss

# 仓库配置没开但本次想走 BVC 多 region 发布
bytedcli scm repo build "example-org/example-repo" --branch master --type test --sync-bvc
```

查看某个版本实际跑没跑海外 stage：`bytedcli scm repo build-log <repo> <version>` 里看有没有 `uploading-va-source` / `uploading-sg-source`。

## Notes

- 需要结构化输出加 `--json`（全局选项，放在子命令之前，如 `bytedcli --json scm repo list ...`）
- 构建后的 JSON 结果里有 `pub_base` 字段，branch 模式应为 `branch_base`。若本该走海外却是 `commit_base`，先确认用的是 `--branch` 而非 `--commit`

## References

- `references/scm.md`
