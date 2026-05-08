---
name: bytedance-goofy-deploy
description: "Operate Goofy Deploy and Goofy Preview via bytedcli: use `goofy preview` to create quick previews from local build output. Use when tasks mention Goofy Deploy, Goofy Preview, quick preview, local web deployment, frontend deployments, or deployment failure diagnosis. Use `goofy deploy` to list projects, view deployments, deploy new versions, diagnose failures, and rollback;"
---

# bytedcli Goofy Deploy / Preview

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

- Web 应用部署
- 前端项目部署
- 本地构建目录 quick preview
- 查看部署历史
- 诊断部署失败原因
- 取消/重试/回滚部署
- 查看项目/团队/频道信息
- 查看项目构建配置
- 触发新版本部署（支持 --wait 轮询等待）
- 搜索 Goofy Deploy 项目

## 前置条件

- 使用通用调用方式：`references/invocation.md`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

### Quick Preview / 快速预览部署
把本地构建好的目录快速部署，并产生一个可访问的预览链接，可用于日常 Demo 演示，快速部署本地产物等场景。
``` bash
# 部署 `.` 目录下的文件到快速预览环境
bytedcli goofy preview deploy . --alias demo-preview
# 列出所有快速预览环境
bytedcli goofy preview list --page 1 --page-size 20
```

### Normal Project Deploy / 普通项目部署
对已有的正式 Goofy Deploy 项目进行搜索、查看、部署等。

```bash
# 列出支持的站点和相应 VRegion 信息
bytedcli goofy deploy list-sites

# 搜索
## 根据项目名搜索项目
bytedcli goofy deploy project search --mode by-name --query tiktok
## 根据 SCM 名称搜索项目
bytedcli goofy deploy project search --mode by-scm --query toutiao
## 根据 Git 仓库搜索项目
bytedcli goofy deploy project search --mode by-git --query toutiao
## 根据路由搜索项目
bytedcli goofy deploy project search --mode by-route --query deploy.bytedance.net

# 团队
## 获取团队信息
bytedcli goofy deploy get-team --team-id 4317
# 列出团队下的项目
bytedcli goofy deploy list-projects --team-id 4317

# 项目
## 查询项目信息
bytedcli goofy deploy get-project --app-id 131716
## 列出部署历史
bytedcli goofy deploy list-deployments --app-id 131716

# 部署区域
## 列出项目的部署区域
bytedcli goofy deploy list-regions --app-id 131716
## 通过标准 VRegion 查询对应部署区域的枚举值 （例如：Singapore-Central -> 3001）
bytedcli goofy deploy region-name-to-region --region-name Singapore-Central
## 通过部署区域的枚举值查询对应的标准 VRegion （例如：3001 -> Singapore-Central）
bytedcli goofy deploy region-to-region-name --region 3001

# 流量频道 / Channel
## 创建流量频道 Channel（需要 region-id）
bytedcli goofy deploy create-channel --region-id 224335 --name test2 --env-name ppe_test2 --site cn
## 通过项目 ID列出项目的流量频道 / Channel
bytedcli goofy deploy list-channels --app-id 131716


# 部署工单
## 获取部署工单列表（需要 app-id)
bytedcli --site cn goofy deploy list-deployments --app-id 21297
## 获取具体工单的信息 （需要 deploy-id)
bytedcli --site cn goofy deploy get-deployment --deploy-id 24913395
## 创建部署工单
### 通过 Git 分支和 Commit Hash 部署新版本（需要 channel-id + git-branch + commit）
bytedcli goofy deploy deploy-new --channel-id 3520795 --git-branch main --commit-hash abc123def
### 通过已有 SCM 版本部署新版本（需要 channel-id + scm-version）
bytedcli goofy deploy deploy-version --channel-id 3520795 --scm-version 1.0.0.47
## 取消部署工单（需要 deploy-id）
bytedcli --site cn goofy deploy cancel --deploy-id 24913396
## 回滚部署工单，回滚到此 Channel 上一次成功的部署（需要 channel-id）
bytedcli --site cn goofy deploy rollback --channel-id 4682611

# 诊断
## 诊断部署失败原因（聚合部署详情、项目信息和历史部署，输出诊断建议）
bytedcli --site cn goofy deploy diagnose --deploy-id 24913395
```

## Notes

- 需要结构化输出加 `--json`（全局选项，放在子命令之前，如 `bytedcli --json goofy deploy list-sites`）
- Goofy Deploy 站点选择用 `--site`（`cn|boe|i18n|i18n-tt|us-ttp|eu-ttp`），默认 `cn`
- `us-ttp` 请求走 `cloud.tiktok-us.net`，JWT 获取走 `cloud-ttp-us.bytedance.net`
- 主入口：`goofy deploy *` / `goofy preview *`
- 可用别名：`goofy-deploy *`、`gd *`
- `goofy preview *` 只有一个环境，无需区分 `cn` / `boe`
- `goofy preview *` 适合本地目录直传；会自动识别 `dist` / `build` / `out`、静态站点目录、静态 Next.js 输出和带 `deploy.yml` 的目录
- 创建 channel 需要 region-id：先用 `list-regions --app-id <app_id>` 获取 Region ID
- 版本部署流程：先获取 channel-id，再使用 `deploy-new` 或 `deploy-version`

## Deployment Workflow

### Quick Preview / 快速预览部署

1. 本地完成构建（如 `npm run build`）
2. 直接部署构建目录或项目根目录：
   - `goofy preview deploy . --alias <alias>`
   - `goofy preview deploy dist --alias <alias> --override`
3. 查看 / 删除 preview：
   - `goofy preview list`
   - `goofy preview remove --preview-id <id>`

### Normal Project Deploy / 普通项目部署

1. 获取项目 ID（已知或通过 `project search`、`list-projects` 查询）
2. 列出区域：`list-regions --app-id <app_id>`
3. 按需创建通道：`create-channel --region-id <region_id> --name <name> --env-name <env_name>`
4. 列出通道：`list-channels --app-id <app_id>`
5. 选择通道 ID
6. 部署：
   - 通过 Git 分支和 Commit Hash 部署新版本（需要 branch + commit）：`deploy-new --channel-id <id> --git-branch <branch> --commit-hash <hash>`
   - 通过已有 SCM 版本部署新版本：`deploy-version --channel-id <id> --scm-version <version>`

## References

- `references/goofy-deploy.md`
