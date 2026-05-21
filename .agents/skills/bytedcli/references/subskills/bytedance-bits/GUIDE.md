---
name: bytedance-bits
description: "Operate BITS DevOps platform via bytedcli: create/update dev tasks, import TCC configs, run pipelines, manage merge requests (including host-sub MR for SDK component releases with config-driven multi-sub-repo support), trigger component upgrades, query client workflow/integration/calendar OpenAPI surfaces, generate AI test cases, update lanes, bind branches, manage releases, and upgrade existing TCE clusters in PPE/BOE envs."
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
- 将 TCC 配置导入研发任务
- 更新泳道配置
- 绑定代码分支
- 升级 PPE/BOE 环境内已有 TCE 集群
- 查询发布工作流
- 查询发布工单详情
- 创建发布工单
- 监控设备的 Anywheredoor 抓包记录（`bits anywhere`），把单条抓包转成可执行 curl

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 大部分 Bits OpenAPI 能力（例如 `bits mr` / `bits component`）依赖 Bits OpenAPI token（请求头 `Authorization: Bearer <token>`）

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

### Token 获取与设置

- 如果缺少 token，先申请 Bits OpenAPI 权限并获取 token（参考：`https://bits.bytedance.net/open/open_api/permission`）

#### Token 优先级（从高到低）

1. 命令行 `--token <token>`（仅本次请求生效，不写入缓存；若请求 `401/403`，为避免覆盖 override token，会直接报错）
2. 环境变量 `CLIENT_BITS_TOKEN`
3. 本地 token cache（通过 `bytedcli bits auth ...` 管理；按 Bits `apiUrl` 的 host 分开缓存）

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

### 升级 PPE/BOE 环境里的已有 TCE 集群

`bits env deploy-upgrade` 新增支持升级已有 PPE/BOE 环境内的 TCE 集群，核心参数为：`env + psm + cluster-id + branch/version`。它只用于升级已有集群；新建环境、新增服务或新增集群仍应使用 ENV 创建链路。

```bash
# 指定 SCM 版本升级。若同时传 --version 和 --branch，--version 优先生效。
bytedcli bits env deploy-upgrade \
  --env ppe_demo \
  --standard-env online_cn \
  --psm example.service.api \
  --cluster-id 12345 \
  --version 1.0.0.370

# 部署 Git 分支
bytedcli bits env deploy-upgrade \
  --env ppe_demo \
  --standard-env online_cn \
  --psm example.service.api \
  --cluster-id 12345 \
  --branch feat/demo
```

可先用 `bytedcli env service list --env <env> --standard-env <standard-env> --search <psm>` 或 ENV 页面确认目标 cluster id；提交后返回的 `Ticket ID` 用于继续查部署进度。

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

### 强制跳过 Pipeline jobRun

`bits job-run force-skip` 面向 BITS Pipeline 的 `jobRunId`，不是 legacy workflow 的 `jobId`。适合在 Pipeline 页面拿到 `jobRunId` / `pipelineRunId` 后跳过 FTF、TeslaX 等阻塞任务。

```bash
bytedcli bits job-run force-skip \
  --job-run-id 123456789 \
  --pipeline-run-id 987654321 \
  --space-id 12345 \
  --reason "TeslaX skipped for this launch"
```

### 导入 TCC 配置到研发任务

```bash
# 先预览自动发现的 region / dir / config 列表
bytedcli bits develop import-tcc-configs \
  --dev-id 123456 \
  --psm example.service.api \
  --control-planes 2,3,4 \
  --dry-run

# 只导入指定配置名
bytedcli bits develop import-tcc-configs \
  --dev-id 123456 \
  --psm example.service.api \
  --config-names flow_config,ab_token
```

- 默认按 Dev Task workflow 导入，内部使用 BITS 的 `workflowType=2`。
- 默认控制面是 `2,3,4`，会按任务已配置的 region / dir 自动发现可导入配置。
- `--dry-run` 只输出导入计划，不会写入 BITS。

### 查看 Pipeline / Job Run 状态

#### 1) 用 `pipeline` 快速定位当前 run 状态和节点状态

```bash
# 最新一次 run
bytedcli bits pipeline <pipeline-id>

# 指定 run（可选）
bytedcli bits pipeline <pipeline-id> --run-seq <run-seq>

# 默认会折叠 hidden jobs（ignored / 尚未执行），并输出 hidden 摘要计数
# 如需展开 hidden jobs 并查看隐藏原因，显式打开
bytedcli bits pipeline <pipeline-id> --run-seq <run-seq> --show-ignored
```

看输出里的两部分即可：

- `Bits Pipeline Latest Run`：整条 pipeline 的当前状态（如 `running (2)` / `failed (9)`）
- `Jobs`：每个 job 的状态与 `Job Run ID`，可快速定位当前卡在哪个 job

隐藏节点分类约定：

- `skipped`：run 中有记录，但状态是 `ignored (1)`（被跳过）
- `not_executed`：pipeline DSL 里定义了 job，但当前 run 还没创建该 job
  - 展开后状态会显示为 `not_started`（run 未结束）或 `not_created`（run 已结束）

#### 2) 用 `job-run` 查看单个节点的详细状态

```bash
bytedcli bits job-run <job-run-id> --pipeline-run-id <pipeline-run-id>
```

重点看：

- `Status`、`Fail Reason`
- `Steps / Atoms`（该 job 内部各 step 的状态）

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

### 更新流水线 DSL（`bits pipelines set`）

`bits pipelines set` 用来把一份完整 pipeline DSL 整体 PUT 回去，常见用法是 "拉下来 → 局部改 → 写回去"：

```bash
# 1. 拉当前 DSL（注意是 -j；data.pipeline 即可写回的 DSL）
bytedcli bits pipelines get <pipeline_id> -j > /tmp/pipeline.json

# 2. 编辑 /tmp/pipeline.json 里 data.pipeline 的字段，例如改某个 stage 下所有 job 的 runEnv

# 3. 把 data.pipeline 写回（也接受完整 PUT body {note, editorType, pipeline}）
bytedcli bits pipelines set --pipeline-id <pipeline_id> --file /tmp/pipeline.json --note "调整 stage runEnv"
```

输出（`-j` 模式 `data` 字段）会带：

- `fromVersion` / `toVersion`：本次编辑前后的 `pipelineVersion.version`，可用于校验是否成功 bump
- `diffUrl`：`https://bits.bytedance.net/devops/<spaceId>/pipeline/edit_record/diff?pipelineId=<id>&fromVersion=X&toVersion=Y`，给用户在浏览器里 review 改动
- `backupPath`：PUT 之前的当前 DSL 本地备份（`os.tmpdir()/bytedcli/bits-pipeline-backup/<id>-<ts>.json`），出错时可回滚
- `sanitizedI18nPaths`：被自动剥成 `null` 的空 i18n 字段路径列表（见下方 Notes）
- `response`：服务端 PUT 响应原文，含完整 echoed pipeline DSL，可用于二次校验

**注意**：

- PUT 是整体替换。`--file` 里没出现的字段会被服务端清掉，所以必须基于 `bits pipelines get` 的最新 DSL 改，不要自己拼一份小子集。
- 文本模式（不带 `-j`）只渲染 KV 表，不打印 `response`；要看服务端回显请用 `-j`。

### MR 相关

```bash
# 单仓 MR（使用 Bits OpenAPI，需要 CLIENT_BITS_TOKEN）
bytedcli --json bits mr create \
  --source-branch <source-branch> \
  --target-branch <target-branch> \
  --title <title> \
  --description <description> \
  --type optimize \
  --wip false \
  --remove-source true

# 查询空间 MR 创建表单字段和默认 custom_fields
bytedcli --json bits mr get-custom-fields \
  --group-name LarkFrontend

# 查询空间 MR 创建表单字段和默认 custom_fields
bytedcli --json bits mr get-custom-fields \
  --group-name LarkFrontend

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

# 平台 MR（单仓客户端 MR，走 Optimus API + JWT 认证，不要求子仓依赖）
# 与默认单仓 MR 的区别：默认单仓 MR 走 BITS OpenAPI；平台 MR 走客户端空间的平台评审流程
# group_name / host project id 在仓库存在 .bits/project_config.json 时自动读取，可省略
bytedcli --json bits mr create \
  --platform \
  --source-branch <source-branch> \
  --target-branch develop \
  --title <title> \
  --type optimize \
  --app-id <bits-space-app-id> \
  --cloud-id <bits-space-cloud-id>

# 发起平台 MR 的代码评审（reviewer 手动指定）
# --mr-id 用创建平台 MR 返回的 optimus_mr_id；group_name / project_id 同样可从 .bits/project_config.json 读取
bytedcli --json bits mr code-review start \
  --mr-id <optimus-mr-id> \
  --reviewer <reviewer-username> \
  --rule develop \
  --app-id <bits-space-app-id> \
  --cloud-id <bits-space-cloud-id>

# 通过平台 MR 的代码评审
# --mr-id 用 bits code/detail/<id> 页面 URL 里的 code review MR id
bytedcli --json bits mr code-review approve \
  --mr-id <code-review-mr-id> \
  --app-id <bits-space-app-id> \
  --cloud-id <bits-space-cloud-id>

# 多主仓 MR（使用 Optimus API + JWT 认证，适用于 KMP 跨端场景）
# 兼容旧的单 host 输入：--host-* + --mr-dependency
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

# 高级多 host 输入：重复传 --host，每个 host 自带私有 mrDependencies；顶层 --mr-dependency 继续作为公共子仓依赖保留
bytedcli --json bits mr create \
  --multi-host \
  --source-branch <source-branch> \
  --target-branch develop \
  --title <title> \
  --type feature \
  --group-name <host-group-name> \
  --mr-dependency '{"projectId":300,"sourceBranch":"feature/public-sub","targetBranch":"develop"}' \
  --host '{"projectId":100,"sourceBranch":"feature/host-a","targetBranch":"develop","mrDependencies":[{"projectId":200,"sourceBranch":"feature/sub-a","targetBranch":"develop"}]}' \
  --host '{"projectId":101,"sourceBranch":"feature/host-b","targetBranch":"develop","mrDependencies":[{"projectId":201,"sourceBranch":"feature/sub-b","targetBranch":"develop"}]}' \
  --custom-fields '{"risk_level":"low"}'

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

# 更新已有 MR：标题 / 描述 / WIP 状态 / 自定义字段
bytedcli --json bits mr update \
  --mr-id <mr-id> \
  --title "<new title>" \
  --description "<new description>" \
  --custom-fields '{"CASE_STUDY":"https://example.com/cs/123"}'

# 给已有 MR 追加绑定 Meego 工作项（URL 模式，自动解析 projectKey 和 type）
# 与 `mr create --meego` 等价，但作用在已经创建好的 MR 上
bytedcli --json bits mr update \
  --mr-id <mr-id> \
  --meego "https://meego.larkoffice.com/larksuite/issue/detail/7310890683"

# 给已有 MR 追加绑定 Meego 工作项（ID 模式，需指定 type 和 project-key）
bytedcli --json bits mr update \
  --mr-id <mr-id> \
  --meego 7310890683 \
  --meego-type bug \
  --meego-project-key larksuite

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

| 选项                         | 说明                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| `--host-config <path>`       | 宿主仓目录或配置文件路径（必填）                                                            |
| `--sub-repo <path[:branch]>` | 子仓目录路径，可带分支 `path:branch`，可重复（必填）                                        |
| `--sub-source <branch>`      | 子仓统一分支（当不是每个 --sub-repo 都带 :branch 时必填）                                   |
| `--host-source <branch>`     | 宿主仓源分支（可选）                                                                        |
| `--title <text>`             | MR 标题（必填）                                                                             |
| `--type <type>`              | MR 类型：feature / bug / optimize / merge / lab / package / patch / slardar（默认 feature） |
| `--meego <url>`              | 绑定 Meego 工作项，可重复                                                                   |
| `--meego-type <type>`        | Meego 工单类型：bug / feature（当 --meego 传纯 ID 时必填）                                  |
| `--meego-project-key <key>`  | Meego 项目标识（当 --meego 传纯 ID 时必填）                                                 |
| `--no-wip`                   | 不标记 WIP                                                                                  |
| `--no-remove-source`         | 合并后保留 source 分支                                                                      |

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
# 查询发布工单详情
bytedcli bits release get --ticket-id <release-ticket-id>

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

### Anywheredoor — 设备抓包监控与 curl 转换

`bits anywhere` 用于在已授权设备上启动/停止流量抓包，并近实时输出 capture 列表，支持把单条 capture 转换成可直接执行的 `curl` 命令。

实现要点：

- `watch` 默认走 HTTP 轮询模式（`--mode poll`），每 1.5s 拉一次 `/web-apis/proxy/v1/history` 的滑动窗口（默认 30s），按 capture id 去重，仅打印新增。
- `--url-path` 在客户端做 substring 匹配，同时把过滤值的最长 path segment 作为 backend hint 收窄响应（backend `path=` 是 per-segment 子串，多 segment 切片不识别）。
- backend 默认 10 分钟无续期会自动停止抓包；watch 超时后会拉不到新数据，需要重跑 `bits anywhere listen` 续期。
- `--mode ws` 仅作为 WebSocket 协议研究 escape hatch；实测 server 对非浏览器指纹连接 silently 拒推送，**不要在生产场景使用**。

```bash
# 启动抓包（10 分钟自动停止）
bytedcli bits anywhere listen \
  --app-id 1234 --did 1234567890123456

# 查询当前抓包状态
bytedcli bits anywhere status \
  --app-id 1234 --did 1234567890123456

# 实时监控某个 path 的 capture 并打印 curl（Ctrl+C 停止）
bytedcli bits anywhere watch \
  --app-id 1234 --did 1234567890123456 \
  --url-path /v1/execute_strategy \
  --show-curl

# 把最近 30 分钟内 path 含 execute_strategy 的 capture 全部 dump 出来
bytedcli bits anywhere watch \
  --app-id 1234 --did 1234567890123456 \
  --window-sec 1800 --include-snapshot \
  --url-path /v1/execute_strategy

# 单条 capture 转 curl（已知 history_id + env，envcode 来自 list 中的 env 字段）
bytedcli bits anywhere get \
  --app-id 1234 --did 1234567890123456 \
  --history-id 1447858190 --env 8 --curl

# 立即释放代理资源（不等 10 分钟自动停）
bytedcli bits anywhere stop \
  --app-id 1234 --did 1234567890123456
```

`watch` 输出列：`id`、`path`、`log_id`、`env`，可作为 `get --history-id <id> --env <env>` 的输入。
配合 `--show-curl` 可以直接拷贝得到的 `curl` 在本地复现请求（已自动剥离 `Host` / `Content-Length` / `Accept-Encoding` 等 curl 自管头，并把 cookies 合并成 `-b`）。

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
- `mr create --wip [true|false]` 可设置是否 WIP；只传 `--wip` 等价于 `--wip true`
- `mr create --remove-source <true|false>` 可设置合并后是否移除 source branch，默认 true；也支持 `--no-remove-source`
- 如果仓库上下文无法自动推断，还需要补 `--group-name` 或 `--project-id`
- `mr get-custom-fields` 会读取 Bits 空间 `create_mr` 表单字段，并输出可传给 `mr create --custom-fields` 的默认 custom fields；`mr create` 不会自动补默认字段
- `mr create --platform` 启用平台 MR 模式（Optimus API + JWT），用于在客户端空间创建单仓 MR 并走平台评审流程；与默认单仓模式（BITS OpenAPI）走不同链路，且不要求子仓依赖
- 平台 MR 的 `--group-name` 与 `--host-project-id`（GitLab project ID）在仓库存在 `.bits/project_config.json`（含 `group_name` / `project_gitlab_id`）时自动读取、可省略；建议带 `--app-id` / `--cloud-id`（对应 `x-bits-auth-appid` / `x-bits-auth-appcloudid`）；认证只依赖 SSO 登录态，不需要 `CLIENT_BITS_TOKEN`
- `mr code-review start` 对平台 MR 发起代码评审（Optimus API）；`--mr-id` 是创建平台 MR 返回的 `optimus_mr_id`，不是 `mr_id`
- `mr code-review start` 的 reviewer：简单场景用可重复的 `--reviewer` + `--rule`（`BRANCH_REVIEWER` 时 `--rule` 为分支名），多 scope 或复杂规则用可重复的 `--review-info` JSON；`--group-name` / `--project-id` 缺省时回退 `.bits/project_config.json`，`--operator` 缺省时取当前 SSO 用户
- `mr code-review approve` 通过平台 MR 的代码评审；`--mr-id` 是 bits `code/detail/<id>` 页面 URL 里的 code review MR id（与 `start` 的 `optimus_mr_id` 不是同一个 ID）；存在待处理评审变更时需显式加 `--always-approve` 才会强制通过
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
- 多主仓模式支持两种输入：
  - 兼容单 host 输入：提供 `--host-project-id`，并至少传一个 `--mr-dependency`
  - 高级多 host 输入：重复传 `--host '<json>'`，每个 host JSON 自带私有 `mrDependencies`
- 顶层 `--mr-dependency` 表示公共子仓依赖，会保留在顶层 `mr_dependencies`
- `--host` JSON 里的 `mrDependencies` 表示该 host 的私有依赖，会进入对应 `hosts[*].mr_dependencies`
- 使用 `--host` 时不要混用顶层 `--component`；公共 `--mr-dependency` 仍可与 `--host` 并存
- `--host` JSON 字段：`projectId`（必填）、`sourceBranch`（可选，默认取 `--host-source`/`--source-branch`）、`targetBranch`（可选，默认取 `--host-target`/`--target-branch`）、`mrDependencies`（数组）、`components`（数组，可选）
- `--mr-dependency` 和 `--component` 均可重复传入多个；
- `--meego` 支持传入 Meego URL 或 ID，MR 创建后自动绑定关联信息
  - URL 模式：自动从 URL 解析 `projectKey` 和 `type`，如 `https://meego.larkoffice.com/larksuite/bug/detail/6841440562`
  - ID 模式：需配合 `--meego-type` 和 `--meego-project-key` 使用
- `--meego-type` 指定 Meego 工单类型：`bug` 或 `feature`（ID 模式必填）
- `--meego-project-key` 指定 Meego 项目标识，如 `larksuite`（ID 模式必填）
- `mr update` 同样支持 `--meego` / `--meego-type` / `--meego-project-key`，用于给已经存在的 MR 追加绑定 Meego 工作项（解析规则与 `mr create` 一致），返回结果会带 `meego_bindings` 数组指明每条绑定的成功 / 失败原因；可重复传 `--meego` 一次绑多个
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
- `pipelines set` 是整体替换（PUT 语义），调用方必须基于 `pipelines get` 拿到的最新 DSL 改后再写回；命令 PUT 之前会自动把当前 DSL 备份到 `os.tmpdir()/bytedcli/bits-pipeline-backup/<id>-<ts>.json`
- `pipelines set` 会在 PUT 前把所有空 i18n 字段（`{value: "", lang?, texts?}` 的 `StringInMultiLang`）置为 `null`，因为 BITS 校验器会拒绝 `value` 为空字符串但 GET 接口又会返回这种 sentinel 值；被剥的路径列在 `data.sanitizedI18nPaths`，最常见的是 `varGroup.description`
- `pipelines set` 的版本字段是 `pipelineVersion.version`（一个 wrapper 对象），不是裸数字；CLI 已经做了 unwrap，正常情况下 `data.fromVersion / data.toVersion` 应该连续递增

## References

- `references/invocation.md`
