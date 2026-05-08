---
name: bytedance-bits
description: "Operate BITS DevOps platform via bytedcli: create/update dev tasks, run pipelines, manage merge requests (including host-sub MR for SDK component releases with config-driven multi-sub-repo support), trigger component upgrades, query client workflow/integration/calendar OpenAPI surfaces, generate AI test cases, update lanes, bind branches, and manage releases."
---

# bytedcli BITS

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

- 创建研发任务（支持多项目多分支）
- 查询和推进客户端 BITS MR 流程
- 创建主子仓 MR（单宿主+多子仓 SDK 组件发版，支持配置文件驱动和多子仓联合发版）
- 触发客户端组件升级、查询升级历史
- 查询客户端 workflow / integration / calendar OpenAPI 子域
- 运行自测流水线
- 更新泳道配置
- 绑定代码分支
- 查询发布工作流
- 创建发布工单

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 大部分 Bits OpenAPI 能力（例如 `bits mr` / `bits component`）依赖 Bits OpenAPI token（请求头 `Authorization: Bearer <token>`）

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

### Token 获取与设置

- 如果缺少 token，先申请 Bits OpenAPI 权限并获取 token（参考：`https://bits.bytedance.net/open/open_api/permission`）

#### Token 优先级（从高到低）

1) 命令行 `--token <token>`（仅本次请求生效，不写入缓存；若请求 `401/403`，为避免覆盖 override token，会直接报错）
2) 环境变量 `CLIENT_BITS_TOKEN`
3) 本地 token cache（通过 `bytedcli bits auth ...` 管理；按 Bits `apiUrl` 的 host 分开缓存）

#### 推荐用法

- 推荐先用环境变量注入：

```bash
export CLIENT_BITS_TOKEN="your-token"
```

- 如果还希望为当前项目提供默认的 Bits 环境或默认的 `group_name` / `project_gitlab_id`，可以额外写 `.bits/project_config.json`：

```json
{
  "apiUrl": "https://bits.bytedance.net/",
  "group_name": "demo.group",
  "project_gitlab_id": 12345
}
```

#### 通过命令管理 token cache（推荐）

当 1~2 都未提供 token 时，调用 Bits OpenAPI 的命令会自动尝试获取并缓存 token；若接口返回 `401/403`，会自动刷新一次并重试一次。

```bash
bytedcli bits auth login [--force]
bytedcli bits auth status
bytedcli bits auth logout
bytedcli bits auth config-auth --token <token>
```

> `bits auth` 会自动读取当前 Bits 配置（例如 `BITS_API_URL` / `.bits/project_config.json.apiUrl`），并按 host 维度管理缓存文件。

## Quick start

### 创建研发任务

```bash
# 方式1: 使用 --services（向后兼容，单分支）
bytedcli bits develop create \
  --title "修复登录问题" \
  --services example.service.api \
  --lane test \
  --scm-mode branch \
  --scm-branch fix/login \
  --from-dev-id 12345 \
  --qa "qa@bytedance.com" \
  --meego "https://example.com/issues/123" \
  --var "custom_var_key=自定义变量" \
  --developer "dev@bytedance.com" \
  --dry-run

# 方式2: 使用 --change（多项目多分支）
bytedcli bits develop create \
  --title "分享按钮修复" \
  --change "service=DemoOrg|demo/web-app,branch=fix/share-button" \
  --change "service=DemoOrg|demo/admin-app,branch=fix/share-align" \
  --lane test \
  --from-dev-id 12345 \
  --qa "qa@bytedance.com" \
  --meego "https://example.com/issues/123" \
  --var "custom_var_key=自定义变量" \
  --developer "dev@bytedance.com" \
  --dry-run

# 方式2b: 使用 --change 指定非主 SCM 依赖
# 适用于服务有多个 SCM 依赖，需要变更的不是主 SCM 的场景
bytedcli bits develop create \
  --title "控制台前端修复" \
  --change "service=example.node.open_web,scm=example/developer/console/frontend,branch=fix/foo" \
  --lane test \
  --from-dev-id 12345 \
  --dry-run

# 方式2c: --meego 可重复，一次性绑定多个 Meego 工作项
bytedcli bits develop create \
  --title "修复多个关联工单" \
  --services example.service.api \
  --lane test \
  --from-dev-id 12345 \
  --meego "https://example.com/issues/123" \
  --meego "https://example.com/issues/456" \
  --dry-run

# 方式2d: 使用 --change 复用 source branch 上已有的 open MR
# 等价于 Bits Web UI 上提示 "An unfinished MR already exists" 时点击 "use directly"
# 适用于已经手动创建了 MR、或上一次 develop create 已经开过 MR 的场景；
# 省略 mr= 时（默认）行为不变，由 Bits 后端自动开新 MR
bytedcli bits develop create \
  --title "复用已有 MR" \
  --change "service=DemoOrg|demo/web-app,branch=fix/share-button,mr=1780" \
  --lane test \
  --from-dev-id 12345 \
  --dry-run

# 方式3: 指定项目类型（使用 --service-type 自动解析 projectUniqueId）
bytedcli bits develop create \
  --title "Web 项目修复" \
  --services "demo/web-app,demo/admin-app" \
  --service-type PROJECT_TYPE_WEB \
  --lane test \
  --space-id 12345 \
  --dry-run
  
# 方式3: 指定 Bits space + 可选 work item / state / created-at 查询开发任务列表
bytedcli bits develop list \
  --space-id 12345 \
  --work-items "meego 123456" \
  --page 1 \
  --page-size 10
```

### 运行自测流水线

```bash
bytedcli bits develop quick-run \
  --dev-id 123456 \
  --stage DevDevelopStage \
  --task DevDevelopStageSelfTestTask \
  --control-planes CONTROL_PLANE_CN \
  --wait \
  --wait-timeout-sec 600
```

### 基于模板创建流水线

```bash
# 基于模板复制流水线
bytedcli bits pipelines create \
  --space-id 12345 \
  --name "sample pipeline" \
  --template-id 123

# 当模板里的 pipeline.varGroup 不完整时，显式补充 varGroup 字段
bytedcli bits pipelines create \
  --space-id 12345 \
  --name "sample pipeline" \
  --template-id 123 \
  --var-group '{"description":{"value":"sample var group","lang":"zh","texts":{"en":"sample var group"}}}'
```

- `bits pipelines create` 当前是模板模式，`--template-id` 必填。
- `--var-group` 必须是 JSON 对象，只会 merge 到模板里的 `pipeline.varGroup`。
- CLI 不会自动补齐 `pipeline.varGroup.description`；如果 merge 后结构仍不满足后端要求，BITS API 会直接返回错误。

### MR 相关

```bash
# 单仓 MR（使用 Bits OpenAPI，需要 CLIENT_BITS_TOKEN）
bytedcli --json bits mr create \
  --source-branch <source-branch> \
  --target-branch <target-branch> \
  --title <title> \
  --description <description> \
  --type optimize

# 单仓 MR + Meego 绑定（URL 模式，自动解析 projectKey 和 type）
bytedcli --json bits mr create \
  --source-branch feat/demo \
  --target-branch main \
  --title "feat: demo feature" \
  --type feature \
  --group-name LarkFrontend \
  --project-id 552443 \
  --meego "https://meego.larkoffice.com/larksuite/bug/detail/6841440562"

# 单仓 MR + Meego 绑定（ID 模式，需指定 type 和 project-key）
bytedcli --json bits mr create \
  --source-branch feat/demo \
  --target-branch main \
  --title "feat: demo feature" \
  --type feature \
  --group-name LarkFrontend \
  --project-id 552443 \
  --meego 6841440562 \
  --meego-type feature \
  --meego-project-key larksuite

# 多主仓 MR（使用 Optimus API + JWT 认证，适用于 KMP 跨端场景）
bytedcli --json bits mr create \
  --multi-host \
  --source-branch <source-branch> \
  --target-branch develop \
  --title <title> \
  --type feature \
  --group-name <host-group-name> \
  --host-project-id <host-repo-bits-project-id> \
  --host-source <host-source-branch> \
  --host-target develop \
  --mr-dependency '{"projectId":<sub-repo-bits-project-id>,"sourceBranch":"<branch>","targetBranch":"develop"}' \
  --component '{"hostProjectId":<host-project-id>,"componentId":<kmp-component-id>}' \
  --custom-fields '{"risk_level":"low"}' \
  --meego "https://meego.larkoffice.com/<project-key>/story/detail/<id>" \
  --app-id <bits-space-app-id> \
  --cloud-id <bits-space-cloud-id>

# 主子仓 MR（高级：直接传参模式，BITS OpenAPI）
> 不推荐作为主路径。主子仓 + 多子仓场景优先使用下文的“配置文件驱动（`bits mr create-host-sub`）”，参数更少且不易配错。
> 直接传参模式适用于需要手动拼装 payload 或临时验证接口字段的场景。

bytedcli --json bits mr create \
  --host-sub \
  # 注意：bits mr create 会校验 --source-branch（即使 host-sub 下宿主 source 通常为空）
  --source-branch <placeholder-branch> \
  --target-branch develop \
  --title "feat: SDK component upgrade" \
  --type feature \
  --group-name <host-group-name> \
  --host-project-id <host-repo-gitlab-project-id> \
  --host-source "" \
  # 多子仓：重复传多个 --sub-dependency（每个代表一个子仓）
  --sub-dependency '{"projectGitlabId":<sub-repo-gitlab-project-id>,"sourceBranch":"<branch>","targetBranch":"develop"}' \
  --sub-component '{"hostProjectId":<host-project-id>,"componentId":<component-id>,"publishType":"sem","versionBase":"1.0.0","versionSuffix":"rc","versionUpgradeType":"patch"}' \
  --sub-component '{"hostProjectId":<host-project-id>,"componentId":<component-id-2>,"versionBase":"2.1.0"}' \
  --meego "https://meego.larkoffice.com/<project-key>/story/detail/<id>" \
  --wip

# 说明：--host-target 用于 multi-host 场景覆盖宿主 target；host-sub 场景一般只需 --target-branch。

bytedcli --json bits mr search --state opened
bytedcli --json bits mr mine --author <user>
bytedcli --json bits mr status --mr-id <mr-id>
bytedcli --json bits mr diff --mr-id <mr-id>
bytedcli --json bits mr diff --mr-id <mr-id> --patch --file "src/path/to/file.ts"
bytedcli --json bits mr review-status --mr-id <mr-id>
bytedcli --json bits mr qa-status --mr-id <mr-id>
bytedcli --json bits mr approve --mr-id <mr-id>
bytedcli --json bits mr disapprove --mr-id <mr-id>
bytedcli --json bits mr remind-review --mr-id <mr-id>
bytedcli --json bits mr remind-qa --mr-id <mr-id>

# 多仓合码：查询完整 workflow / job 列表
bytedcli --json bits client workflow pipeline from-mr --mr-id <mr-id> --include-dependencies
```

`bits mr diff` 需要本地可用的 Codebase 登录态；优先复用 `bytedcli auth login` 的 SSO 会话，也支持 `bytedcli codebase auth config-add-pat <pat>`。

### 主子仓 MR — 配置文件驱动（create-host-sub）

适用于单宿主仓 + 多子仓的客户端 SDK 组件发版场景：从多个子仓收集 `.host-sub-mr.json`，自动拉取组件版本并创建主子仓 MR。

**前置条件**：`CLIENT_BITS_TOKEN` 已设置，且各仓库 source branch 已 push 到远端。

**推荐目录组织**：

- 宿主仓（例如 `commerce_demo`）根目录：`.host-sub-mr.json` 只放 `host`
- 每个子仓根目录：`.host-sub-mr.json` 只放 `sdk`

```json
// 宿主仓 .host-sub-mr.json
{
  "host": {
    "group_name": "commercial_sdk_demo",
    "project_gitlab_id": 414226,
    "target": "develop",
    "testing_group_name": "commercial_sdk_demo"
  }
}
```

```json
// 子仓 .host-sub-mr.json
{
  "sdk": {
    "display_name": "开屏 SDK",
    "sub_project_gitlab_id": 5275,
    "sub_target": "develop",
    "repo_ids": [1335, 45928, 40861],
    "publish_type": "sem",
    "version_suffix": "rc",
    "version_upgrade_type": "patch"
  }
}
```

**执行示例**：

```bash
# 多子仓联合发版：从多个子仓收集配置，合并发起一个 MR
# --sub-repo 支持 path:branch 格式为每个子仓指定独立分支
bytedcli --json bits mr create-host-sub \
  --host-config /path/to/host-repo \
  --sub-repo /path/to/splash_ad_sdk:feature/splash-v2 \
  --sub-repo /path/to/ad_base_sdk:feature/ad-base-v3 \
  --host-source release/1.0 \
  --title "feat: 联合升级" \
  --type feature

# 各子仓同分支：用 --sub-source 统一指定（此时每个 --sub-repo 不必带 :branch）
bytedcli --json bits mr create-host-sub \
  --host-config /path/to/host-repo \
  --sub-repo /path/to/splash_ad_sdk \
  --sub-repo /path/to/ad_base_sdk \
  --sub-source feature/xxx \
  --host-source release/1.0 \
  --title "feat: 联合升级"
```

**配置文件格式**（`.host-sub-mr.json`）：

- **子仓独立格式（推荐）**：`{ "sdk": {...} }`
- **宿主仓独立格式（推荐）**：`{ "host": {...} }`
- **全量格式（兼容）**：`{ "host": {...}, "sdks": { "sdk_name": {...} } }`

**关键选项**：

| 选项 | 说明 |
|------|------|
| `--host-config <path>` | 宿主仓目录或配置文件路径（必填） |
| `--sub-repo <path[:branch]>` | 子仓目录路径，可带分支 `path:branch`，可重复（必填） |
| `--sub-source <branch>` | 子仓统一分支（当不是每个 --sub-repo 都带 :branch 时必填） |
| `--host-source <branch>` | 宿主仓源分支（可选） |
| `--title <text>` | MR 标题（必填） |
| `--type <type>` | MR 类型：feature / bug / optimize（默认 feature） |
| `--meego <url>` | 绑定 Meego 工作项，可重复 |
| `--meego-type <type>` | Meego 工单类型：bug / feature（当 --meego 传纯 ID 时必填） |
| `--meego-project-key <key>` | Meego 项目标识（当 --meego 传纯 ID 时必填） |
| `--no-wip` | 不标记 WIP |
| `--no-remove-source` | 合并后保留 source 分支 |

**成功输出**：返回 `mr_link`（MR 链接），用于后续流转/通知。


### Component 相关

提供客户端组件（如 iOS/Android 模块、跨端库等）在 Bits 平台的生命周期管理、升级与查询能力。支持的核心功能包括：
- **组件库基础查询**：根据 ID、名称或搜索条件查找组件库信息。
- **组件版本与升级管理**：执行组件升级 (`upgrade-repo`)、查询组件基准版本以及自动获取下个合理语义化版本号。
- **升级历史追溯**：根据 ID 或版本号获取某次升级的详细信息及关联构建任务流。
- **标签与关联检索**：查询平台组件标签、特定组件绑定的标签，以及获取目标组件的相关依赖和关联组件信息。

详情和所有命令用例请参考专属文档：
- `references/component.md`

### Client 子域

`bits client` 提供三组客户端 OpenAPI 子域：
- `bits client workflow`
  - workflow job、pipeline template、开发任务流水线
- `bits client integration`
  - 集成区版本、合入队列、封版报告、版本群
- `bits client calendar`
  - 版本日历 workspace、event、segment、mark

详情和所有命令用例请参考专属文档：
- `references/client.md`

其中 workflow 相关 OpenAPI 已经统一收口到 `bits client workflow`，不再单独保留根级 `bits workflow` 入口。

### AI 用例生成

从飞书 PRD 文档触发 AI 测试用例生成（异步，结果 5-15 分钟后在 Bits 平台查看）。

```bash
bytedcli bits case generate \
  --devops-id <space-id> \
  --dir-id <dir-id> \
  --prd-link "https://bytedance.larkoffice.com/docx/example" \
  --case-title "example-feature"

# 关闭严格模式 + 补充文档
bytedcli bits case generate \
  --devops-id <space-id> \
  --dir-id <dir-id> \
  --prd-link "https://bytedance.larkoffice.com/docx/example" \
  --no-strict-mode \
  --supplement-links "https://bytedance.larkoffice.com/docx/tech-doc"
```

### 用例上传
使用 Markdown 内容上传测试用例，支持指定文件内容或文件地址；未传 `--case-id` 时将新建用例集。需要提供 `--model-name`（联系 lixihe.lj 获取）。
```bash
bytedcli bits case upload \
  --devops-id <space-id> \
  --dir-id <dir-id> \
  --case-id <case-id> \
  --case-title "example-feature" \
  --model-name "example-model" \
  --md-content "# Title\\n- item"
bytedcli bits case upload \
  --devops-id <space-id> \
  --dir-id <dir-id> \
  --case-title "example-feature" \
  --model-name "example-model" \
  --md-file ./example.md
```

### 更新泳道

```bash
bytedcli bits develop update-lane \
  --dev-id 123456 \
  --lane new_lane \
  --idcs lf,lq \
  --dry-run
```

### 更新 develop 任务

```bash
# 注意：传入 --change 时，会按 --change 列表重置关联项目（未包含的项目会被移除）
bytedcli bits develop update \
  --dev-id 123456 \
  --lane ppe_test \
  --name "demo develop title" \
  --change "service=example.service.api,branch=codex/demo" \
  --change "service=example.service.worker,branch=codex/worker" \
  --dry-run
```

### 绑定分支

```bash
bytedcli bits develop bind-branch \
  --dev-id 123456 \
  --branch codex/feature \
  --git-repo stone/coze-coding \
  --services example.service.api \
  --dry-run
```

### 绑定开发单到发布单
```bash
bytedcli bits develop bind-release \
  --dev-ids 2143012,2143013 \
  --release-ticket-id 1130150230274 \
  --dry-run
```


### 发布相关

```bash
# 查询发布工作流
bytedcli bits release list-workflows \
  --workspace-id 150900021762 \
  --keyword "快速发布"

# 获取发布表单 schema
bytedcli bits release form-schema \
  --workspace-id 150900021762 \
  --workflow-id 162749140482

# 创建发布工单
bytedcli bits release create-ticket \
  --workspace-id 150900021762 \
  --workflow-id 162749140482 \
  --name "v1.0.0 发布" \
  --release-approvers "demo.user,bob" \
  --projects-json '[...]'
```

## Notes

- 需要结构化输出加 `--json`
- `bits develop list` 需要显式传 `--space-id`；`--work-items` 选填
- `bits develop list --state` 支持 `opened,closed,finished`，多个值用逗号分隔
- `bits develop list --created-at` 使用时间戳区间 `startTs,endTs`
- `--change` 格式：`service=<PSM>,branch=<sourceBranch>[,target=<targetBranch>][,scm=<scmName>][,mr=<iid>]`
- `--var` 可重复，格式：`name=value`
- `--team-flow-id` 显式覆盖开发单创建时的 `teamFlowId`；当 `--dev-task-template-id` 与来源模板不一致时，CLI 不再默认继承旧模板的 `teamFlowId`
- `--env-setting-map-json` 用于覆盖创建接口的 `envSettingMap` 参数
- `--dry-run` 只打印 payload 不实际创建
- `mr create` 用于基于 source/target branch 创建客户端 BITS MR；至少需要 `source-branch`、`target-branch`、`title`
- `mr create --type` 支持 `feature | bug | optimize | merge | lab | package | patch | slardar`，默认 `optimize`
- 如果仓库上下文无法自动推断，还需要补 `--group-name` 或 `--project-id`
- `mr create --multi-host` 启用多主仓模式（Optimus API + JWT），适用于 KMP 跨端场景中 bits 宿主仓检测拦截单仓 MR 的情况
- `mr create --host-sub` 启用主子仓模式（BITS OpenAPI），适用于单宿主仓+多子仓的客户端 SDK 组件发版场景
- 主子仓模式的子仓嵌套在 hosts[0].mr_dependencies 中，组件版本嵌套在 mr_dependencies[0].components 中
- 主子仓模式必须提供 `--host-project-id`（宿主仓 GitLab project ID）和至少一个 `--sub-dependency`（子仓 JSON）
- `--sub-dependency` JSON 字段：`projectGitlabId`（必填）、`sourceBranch`（必填）、`targetBranch`（可选，默认取 --target-branch）
- `--sub-component` JSON 字段：`hostProjectId`（必填）、`componentId`（必填）、`publishType`（默认 sem）、`versionBase`、`versionSuffix`（默认 rc）、`versionUpgradeType`（默认 patch）
- `--sub-component` 可重复，所有 component 会自动挂到 sub-dependency 下
- 主子仓模式默认 `--wip` 为 true
- `mr create-host-sub` 是配置文件驱动的主子仓 MR 创建命令，自动从 `.host-sub-mr.json` 读取 host/sdk 配置并拉取组件版本
- `mr create-host-sub --sub-repo <path[:branch]>` 可重复指定多个子仓路径（支持 `path:branch` 格式指定独立分支），进入多子仓联合发版模式
- `mr create-host-sub --host-config <path>` 指定宿主仓目录或配置文件，搭配 `--sub-repo` 使用
- 配置文件支持三种格式：全量（host+sdks）、子仓独立（sdk only，key 取目录名）、宿主仓独立（host only）
- 多子仓模式下不传 `--sdk` 则默认使用所有收集到的 SDK
- 多主仓模式必须提供 `--host-project-id`（宿主仓 bits project ID）和至少一个 `--mr-dependency`（子仓依赖 JSON）
- `--mr-dependency` 和 `--component` 均可重复传入多个
- `--meego` 支持传入 Meego URL 或 ID，MR 创建后自动绑定关联信息
  - URL 模式：自动从 URL 解析 `projectKey` 和 `type`，如 `https://meego.larkoffice.com/larksuite/bug/detail/6841440562`
  - ID 模式：需配合 `--meego-type` 和 `--meego-project-key` 使用
- `--meego-type` 指定 Meego 工单类型：`bug` 或 `feature`（ID 模式必填）
- `--meego-project-key` 指定 Meego 项目标识，如 `larksuite`（ID 模式必填）
- `--app-id` 和 `--cloud-id` 用于传递 bits 空间鉴权 header（多主仓模式）；`--group-name` 在多主仓模式下是宿主仓的 host_group_name（可能与 bits 空间名不同）
- `mr status` 是客户端 BITS MR 的主入口；更稳定的程序化消费优先加 `--json`
- `mr search` 适合按状态、作者、reviewer、source/target branch、mr_type 做列表筛选；`mr mine` 是带 author 过滤的快捷入口
- `mr status` 用来看整体状态、review 摘要和 pipeline 信息；`mr review-status` 聚焦 Review；`mr qa-status` 聚焦 QA
- 对于多仓合码，想拿完整 workflow / job 列表时，优先使用 `bits client workflow pipeline from-mr --include-dependencies`
- `--include-dependencies` 会同时展开 `CUSTOM_CI_MMR_HOSTS`（多主仓，`relation_type = mmr_host`）和 `CUSTOM_CI_MR_DEPENDENCIES`（多子仓 / 依赖仓，`relation_type = dependency`）
- `mr approve` / `mr disapprove` 用于审批动作；`mr remind-review` / `mr remind-qa` 用于催办动作
- `mr review-status`、`mr approve`、`mr disapprove`、`mr remind-review`、`mr qa-status`、`mr remind-qa` 都支持两种定位方式：
  - `--mr-id`
  - `--project-id + --iid`
- 需要按客户端 Bits 维度做程序化查询时，优先使用 `bits mr ... --json`，不要自行拼装内部接口
- 如果命令报 token 缺失或鉴权失败，优先检查 `CLIENT_BITS_TOKEN` 是否已设置且权限已开通
- `component upgrade` 是客户端组件升级正式入口；payload 应符合正式 OpenAPI `req_schema`
- `bits client workflow` 适合查 workflow job / pipeline template / dev task pipeline；不会替代现有 `bits pipeline` 主域
- `bits client integration` 适合查集成区版本、封版报告、版本群、合入队列
- `bits client calendar` 适合查版本日历空间、事件和标记
- `component` 现已支持完整的组件生命周期查询，包括：`get-repo`、`search-repos`、`get-history-by-id` 等 14 个核心命令
- `--service-type` 支持：`PROJECT_TYPE_WEB`、`PROJECT_TYPE_TCE`、`PROJECT_TYPE_FAAS`、`PROJECT_TYPE_HYBRID`、`PROJECT_TYPE_CRONJOB`、`PROJECT_TYPE_CUSTOM`；传入后会按对应项目类型自动解析 `projectUniqueId`
- `--change` 支持可选的 `scm=<name>` 键，用于指定非主 SCM 依赖；省略时默认绑定主 SCM（`isMain === true`），行为与之前一致
- `--change` 支持可选的 `mr=<iid>` 键（仅 `develop create` 生效），用于复用 source branch 上已存在的 open MR——等价于 Bits Web UI 提示 "An unfinished MR already exists" 时点击 "use directly"；省略时（默认）由 Bits 后端自动开新 MR，行为与之前一致；`mr=` 必须是正整数

## References

- `references/invocation.md`
