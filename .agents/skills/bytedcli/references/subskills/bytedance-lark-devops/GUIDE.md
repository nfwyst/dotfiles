---
name: bytedance-lark-devops
description: "Operate Lark Devops via bytedcli — read queries against the release platform (release processes, spaces, apps, linked Bits pipelines on lark-devops.bytedance.net), the guarded simple-release write workflow (create / audit add-app / apply-stage / set-window / submit), the guarded dev-flow (BOE-only release) write workflow (create --flow dev / dev add-app / integrate / execute-pipeline / finish, strictly isolated from PRE/GRAY/ONLINE), and the FG (Feature Gate) OpenAPI (meta/rule get, grayscale rule CRUD, release tickets). All writes default to dry-run and require --execute + --yes-i-know-this-is-live. Use when tasks mention Lark Devops release orders, release spaces, release processes, process/pipeline drill-down, creating a release (simple or dev), dev flow / BOE test environment publish, integration pipeline, advancing audit stages, setting publish windows, submitting audits, feature gates, feature flags, grayscale rules, FG keys, or FG release tickets."
---

# bytedcli Lark Devops

`bytedcli lark-devops` covers four capabilities against `lark-devops.bytedance.net`:

1. **Release platform — read** (`process`, `space`, `app` subtrees) — release processes, spaces, apps, and their linked Bits pipeline runs.
2. **Release platform — guarded simple-release writes** (`release` subtree, `--flow simple`) — create / audit add-app / apply-stage / set-window / submit; targets PRE_RELEASE / GRAY_RELEASE / ONLINE for production release.
3. **Release platform — guarded dev-flow writes** (`release dev` subtree, `--flow dev`) — create / dev add-app / integrate / execute-pipeline / finish; targets DEV + INTEGRATION only, **strictly isolated** from production stages. Use for BOE feature-branch verification.
4. **FG (Feature Gate) OpenAPI** — meta / rule / ticket queries and grayscale rule CRUD (`fg` subtree).

Both write flows default to dry-run; real writes require `--execute --yes-i-know-this-is-live`.

Choose the subtree by capability:
- Release data (process/space/app) ⇒ `bytedcli lark-devops process|space|app …`
- Production release writes (simple flow) ⇒ `bytedcli lark-devops release create --flow simple …` + `audit …`
- Dev/BOE release writes ⇒ `bytedcli lark-devops release create --flow dev …` + `dev …`
- Feature gates ⇒ `bytedcli lark-devops fg …`

## 如何调用 bytedcli

```bash
# 方式 1：npx 直跑最新版
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest <command> [options]

# 方式 2：全局安装
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npm install -g @bytedance-dev/bytedcli@latest
bytedcli <command> [options]
```

所有子命令加 `-j` / `--json` 即输出结构化 JSON，供 Agent 下游消费。

---

## 1. Release platform (read-only)

### 1.1 When to use

- The user asks about a release process / 发布工单 / 发布单（已知 `process_id`）
- The user wants a summary of a release space（已知 `space_id`）
- The user wants to find all release processes in a space that reference an app name or a PSM entity
- The user wants to jump from a release process to its linked Bits pipeline runs, optionally by phase (pre / gray / online / audit / dev / integration) or unit (CN / SG_LARK / US / …)

### 1.2 Prerequisites

`lark-devops process|space|app` 子命令需要 `.lark-devops.bytedance.net` 的 `beops_session` cookie。按如下优先级获取：

1. **Chrome 本地 cookie**（首选）：只要用户在本机 Chrome 登录过 `https://lark-devops.bytedance.net`，CLI 会自动从 Chromium cookie 库抽出 `beops_session` 使用
2. **SSO session 兜底**：如果 Chrome 里没有，再尝试用 `bytedcli auth login --session` 缓存的 SSO session 去换

最可靠的做法是让用户在本机 Chrome 浏览器里登录一次 `https://lark-devops.bytedance.net`，然后再用 CLI。结果缓存在本地（TTL 6h）。清缓存：

```bash
bytedcli lark-devops auth logout
```

如果两种来源都失败，会抛 `LARK_DEVOPS_AUTH_REQUIRED`，并在 error message 里提示用户怎么办。

### 1.3 Commands

**Space 不是全局通用的，必须由用户显式提供 `--space-id`（数字）。**

```bash
# Release process（已知 process_id）
bytedcli lark-devops process summary --process-id 76093 -j

# 从 process 反查关联的 Bits pipeline runs（可选按 phase/unit 过滤）
bytedcli lark-devops process pipelines --process-id 76093 -j
bytedcli lark-devops process pipelines --process-id 76093 --phase gray -j
bytedcli lark-devops process pipelines --process-id 76093 --phase online --unit CN -j

# Space 内最近发布
bytedcli lark-devops space summary --space-id 45 --limit 3 -j

# 空间内按 app name 查工单
bytedcli lark-devops process search --mode app --space-id 45 --app-name example.app -j

# 空间内按 PSM entity 查工单
bytedcli lark-devops process search --mode psm --space-id 45 --psm-entity example.app_pre_release -j

# 应用搜索
bytedcli lark-devops app search --keyword example.app -j
bytedcli lark-devops app search --psm example.app.service --page-size 10 -j
```

### 1.4 Phase / Unit enums

- `--phase`：`dev | integration | pre | gray | online | audit`
  - 归一到 `DEV / INTEGRATION / PRE_RELEASE / GRAY_RELEASE / ONLINE / AUDIT`
- `--unit`：`CN | US | SG_LARK | SG_EA | JP | BOE | MY | OTHER | US_TTP3 | Undefined`
  - 支持别名 `cn/sg/sg-ea/us_ttp3/…`，也可传数字 `1..9`

### 1.5 Pipeline run 详情

`bytedcli lark-devops process pipelines` 只返回流水线元信息（`run_id`、`bind_build_url`、`psm`、`unit`、`phase`）。查询流水线细节：

- 直接访问 `bind_build_url`（bits UI）查看完整 stage/job/log
- 或用现有 bits 子命令进一步下钻：`bytedcli bits pipeline --pipeline-id <pipelineId>`、`bytedcli bits job-run <job_run_id>`、`bytedcli bits step-logs <job_run_id> <step_name>`

### 1.6 Typical fields

从 `process summary` / `process pipelines` 结果里读取以下字段足以覆盖 90% 场景：

- `process_id`, `process_name`, `status`, `current_phase_index`
- `space_id`, `space_name`, `creator`, `operator`
- `phases[].phase_name` (`PRE_RELEASE / GRAY_RELEASE / ONLINE / …`), `phase_status`
- `phases[].apps[].app_name`, `env_items[].entity` (PSM), `env_items[].repos[].scm_branch / scm_version`
- `phases[].triggers[].task_executions[].bind_build_id` → run id，可送入 `bytedcli bits pipeline --pipeline-id <id>` 下钻
- `phases[].triggers[].task_executions[].bind_build_url` → 直接跳转 bits UI 看完整 stage/job/log

### 1.7 Fallback strategy for Agents

- User gives `process_id` → `process summary`
- User gives `space_id` → `space summary`
- User gives `space_id` + `app_name` → `process search --mode app`
- User gives `space_id` + `psm` → `process search --mode psm`
- User wants pipelines from a process → `process pipelines` (optionally `--phase` / `--unit`)
- User already has a `run_id` + `bind_build_url` → 直接访问 URL 或 `bytedcli bits pipeline --pipeline-id <pipelineId>`（按 pipeline 维度）

### 1.8 Constraints

- 读接口，不支持创建发布单、触发流水线、改状态
- `--space-id` 必传；不提供全局 seed
- `process search --mode app|psm` 扫描 `--limit` 条最近工单（默认 10），命中数受 `limit` 影响，可增大至 20~50 以提升召回
- 本地 session cookie 缓存 TTL 6h；取到旧值时执行 `bytedcli lark-devops auth logout` 后重试
- 认证失败会抛 `LARK_DEVOPS_AUTH_REQUIRED`，提示用户在本机 Chrome 登录 `https://lark-devops.bytedance.net`，或跑 `bytedcli auth login --session` 补一份 SSO session 兜底

---

## 2. Release write workflow (guarded)

### 2.1 When to use

- The user wants to **create** a new release process (currently only `--flow simple` is supported)
- The user wants to **advance a release audit** (add app → apply stage plans → set publish window → submit)
- The user wants to **inspect** audit-derived ids, unit/cluster/version candidates, or run pre-submit validation
- The user wants to **dry-run** any of the above to preview the exact HTTP payload without side effects

### 2.2 Prerequisites

Same auth model as Section 1 (Chrome `beops_session` primary, SSO fallback). **Writes additionally need a `_csrf_token` cookie from the same Chrome session** — CLI reads it automatically when present. If a write ever fails with a CSRF error, re-sign in to the site in Chrome and rerun.

### 2.3 Live-write guard (critical)

Every write subcommand follows the same pattern:

| Flags | Behavior |
|---|---|
| no `--execute` | **Dry-run**: returns `{mode:"dry_run", endpoint, payload}` — safe preview, no HTTP write |
| `--execute` only | **Rejected** with `LARK_DEVOPS_LIVE_WRITE_UNCONFIRMED` |
| `--execute --yes-i-know-this-is-live` | **Live write** — actually sends the request |

Always preview with dry-run, inspect the payload, **then** add both flags.

### 2.4 Strict sequence for `--flow simple`

```
1. release create
2. release audit add-app
3. release audit apply-stage --stage pre
4. release audit apply-stage --stage gray
5. release audit apply-stage --stage online
6. release audit set-window
7. release audit submit --process-id --app-id          # submit 自动 confirm + 校验
```

`submit --process-id --app-id` 在 execute 时会：

1. 校验 `PRE_RELEASE` 和 `ONLINE` 两阶段所有 `is_deploy=true` unit 都有 `version_iterms`；缺失则 `submit_blocked_by_stage_validation`
2. 自动调 `/deploy/cd/audit/user/update/v2` confirm=true
3. 调 `/deploy/cd/audit/process/update/id` 正式提审

### 2.5 Commands

**Step 0 — 资源发现（必做，不能跳）**

```bash
# user 只给了 space 名 / app PSM？先解析 id（dev flow 也用同一套）
bytedcli lark-devops space search --name-like <keyword> -j    # → space_id
bytedcli lark-devops app search --psm <dot-form-psm> -j       # → app_id, app_name
```

**规则：** `--space-id` 和 `--app-id` 必须由 user 显式给数字、或 agent 通过上面两个只读接口解析。CLI 不提供全局默认。

```bash
# 1. Create (dry-run preview)
bytedcli lark-devops release create --space-id 70 --name "example release" --flow simple -j

# 1'. Create (live write)
bytedcli lark-devops release create --space-id 70 --name "example release" --flow simple \
  --execute --yes-i-know-this-is-live -j

# 2. Add app to audit scope
bytedcli lark-devops release audit add-app \
  --process-id 76117 --space-id 70 --app-id 1451 --app-name example.app \
  --execute --yes-i-know-this-is-live -j

# 2a. Discover unit names (need this to write plan.units section in step 3-5)
#     读 data.unit_drafts[].unit_name（字符串枚举：CN/US/SG_LARK/...）
bytedcli lark-devops release audit build-stage \
  --process-id 76117 --app-id 1451 --stage pre -j

# 3-5. Apply per-stage plan (PRE / GRAY / ONLINE)
bytedcli lark-devops release audit apply-stage \
  --process-id 76117 --space-id 70 --app-id 1451 --app-name example.app \
  --stage pre --file ./audit-stage-plan.json \
  --execute --yes-i-know-this-is-live -j

bytedcli lark-devops release audit apply-stage \
  --process-id 76117 --space-id 70 --app-id 1451 --app-name example.app \
  --stage online --file ./audit-stage-plan.json \
  --execute --yes-i-know-this-is-live -j

# 6. Publish window — 发布窗口是 space 级规范时间，由 /deploy/cd/audit/publish/get 权威返回
#    默认直接用平台返回的窗口重写回去（`--from-platform`），Agent 不应自行编造时间。
bytedcli lark-devops release audit set-window \
  --process-id 76117 --from-platform \
  --execute --yes-i-know-this-is-live -j

# 仅当 space 管理员显式要求覆盖时，才使用 `--file ./publish-window.json`

# 7. Submit (auto-validates + auto-confirms)
bytedcli lark-devops release audit submit \
  --process-id 76117 --app-id 1451 \
  --execute --yes-i-know-this-is-live -j
```

### 2.6 Supporting inspect/debug commands

```bash
bytedcli lark-devops release audit inspect --process-id 76117 -j
bytedcli lark-devops release audit inspect-unit \
  --process-id 76117 --app-id 1451 --stage pre --unit SG_LARK -j
bytedcli lark-devops release audit build-stage \
  --process-id 76117 --app-id 1451 --stage pre -j
bytedcli lark-devops release audit materialize-stage \
  --process-id 76117 --app-id 1451 --stage pre --file plan.json -j
bytedcli lark-devops release audit get-window --process-id 76117 -j
bytedcli lark-devops release audit confirm-apps --process-id 76117 --confirm true \
  --execute --yes-i-know-this-is-live -j
bytedcli lark-devops space search --name-like vc -j   # 按名字查 space_id
bytedcli lark-devops release get --process-id 76117 -j
```

### 2.7 Plan-file formats

#### 键名与 PSM 命名约定（必须严格遵守）

- `repo_versions` 的 **键永远是 slash-form** —— 例如 `box/facade/streamapi`、`toutiao/load`、`ee/ccm/box_preview_sdk`。不要自行把 `/` 换成 `.` 或 `_`。
- `app_name` / PSM **永远是三段式 dot-form** —— 例如 `box.facade.streamapi`。create/add-app/apply-stage 命令的 `--app-name` 传这个值。
- 用户通常会一次性给一张 repo → 版本号的映射（slash-form 键）。Agent 可以直接把它复制进 `plan.repo_versions`，不需要再做键名归一化。

#### 版本预校验（dry-run 就能看到）

`apply-stage` 的结果里 **顶层 `preflight` 块** 是 Agent 判断安全写入与否的唯一信号：

```json
{
  "mode": "dry_run",
  "preflight": {
    "ok": false,
    "unknown_repo_versions": [
      { "unit": "CN", "repo_name": "toutiao/load", "requested_version": "1.0.2.618",
        "available_versions": ["1.0.2.619", "1.0.2.620"] }
    ],
    "missing_repo_versions": [],
    "selected_units": ["CN"],
    "skipped_units": [],
    "hint": "plan.repo_versions references versions the platform does not list. ..."
  },
  "materialized": { "..." : "..." }
}
```

- `preflight.ok=false` → 必须先修 `plan.repo_versions`（通常是版本号不在候选列表里），再重跑 dry-run，直到 `ok=true` 再 `--execute`。
- `preflight.ok=true` → 可以安全 `--execute`。
- 即便不看 `preflight`，`apply-stage --execute` 仍会在 `unknown_repo_versions` 非空时抛 `LARK_DEVOPS_PLAN_VERSION_NOT_FOUND` 强制拒绝写入，不会静默掉 repo。

**`preflight.ok=false` 时的 Agent 交互协议**：Agent 不应自行猜一个"接近的"版本号替换。正确流程是：

1. 从 `preflight.unknown_repo_versions[]` 取每一项的 `unit` / `repo_name` / `requested_version` / `available_versions`
2. 把失败原因和候选列表**原样回显给用户**，例如：

   > `toutiao/load` 在 unit `CN` 的候选版本里没有 `1.0.2.618`。平台最近可用的版本：`1.0.2.619, 1.0.2.620, …`（共 N 个）。请指定一个新版本，或跳过这个 repo。

3. 等用户明确回复后再更新 `plan.repo_versions`，重跑 dry-run。
4. **不要批量自动改版本、不要去跑 inspect-unit 挑一个最新版自作主张。** 这类决策必须用户拍板。

查看完整候选版本列表时（`available_versions` 默认只返回前 10 条）：

```bash
bytedcli lark-devops release audit inspect-unit \
  --process-id <id> --app-id <id> --stage pre --unit CN --repo-limit 50 -j
# look at data.repo_candidates[].candidates[].version
```

#### 一份 plan 文件能否跨 PRE / GRAY / ONLINE 三阶段复用？

**默认推荐做法：复用同一份 plan**，把它依次传给 `--stage pre | gray | online`。行为：

- 平台对某个 stage 开放的 unit 才会走 `set-apps` 真正写入。
- 某 stage 在平台侧没有任何 `unit_iterms`（典型：关闭了灰度的 app 在 GRAY_RELEASE 阶段），`apply-stage` 会返回 `materialized.stage_auto_skipped=true`、`endpoints: []`、`results: []`。**视作成功不重试。**
- `repo_versions` 通常三阶段一致 —— 同一发布窗口里部署的是同一个 artifact 版本。

**分阶段拆 plan 的情况**（较少见）：

- PRE 只灰一小批 cluster，ONLINE 才对所有 cluster 放量 —— 按 stage 拆 `units` 字段。
- PRE 用 hotfix 版，ONLINE 用正式版 —— 按 stage 拆 `repo_versions`。

拆分时，为每个 stage 起单独文件：`plan-pre.json` / `plan-gray.json` / `plan-online.json`。

#### 默认部署策略：deploy-all，不做 unit 局部开关

极简流程 (`--flow simple`) 下，**Agent 只能走"全部 unit 都部署"这条路径**，不支持：

- 关掉某些 unit（`is_deploy: false`）
- 覆盖 `cluster_ids` / `grayscale_on` / `online_deploy_type`
- 为特定 unit 定制 plan

标准做法：

1. 先跑一次 `bytedcli lark-devops release audit build-stage --process-id <id> --app-id <id> --stage pre -j` 拿 unit 枚举。
   - 响应路径：`data.unit_drafts[].unit_name`（如 `"CN"` / `"US"` / `"SG_LARK"` 等）
   - 也可以看 `data.unit_drafts[].unit`（数字枚举，1=CN / 2=US / 3=SG_LARK / ...）
2. 把每个 unit 写成 `{ "is_deploy": true }`，**不加任何其他字段**。
3. `repo_versions` 按用户提供的 slash-form 键 + 版本号填入。

如果用户明确要求"只发某个 unit、或别发 X"，回复"当前 skill 不支持 unit 级局部开关，需要走 `set-apps` 逃生口（非推荐路径）"，不要自行在 plan 里填 `is_deploy: false`。

#### Plan 文件示例

参考文件在 `references/release-plans/`。Copy one, edit, pass via `--file`。

**audit-stage-plan.example.json**（`apply-stage` / `materialize-stage` 共用，deploy-all 标准形态）：

```json
{
  "repo_versions": {
    "box/facade/streamapi": "1.0.0.6617",
    "toutiao/load": "1.0.2.618",
    "ee/ccm/box_preview_sdk": "1.0.0.693"
  },
  "units": {
    "CN":      { "is_deploy": true },
    "US":      { "is_deploy": true },
    "SG_LARK": { "is_deploy": true }
  }
}
```

**publish-window.example.json**（仅当你需要覆盖 space 规范窗口时使用）：

```json
{
  "pre_time":    { "start": 1776506082, "end": 1776507882 },
  "gray_time":   { "start": 1776507882, "end": 1776637482 },
  "online_time": { "start": 1776637482, "end": 1776642882 },
  "desc": "",
  "status": "Done",
  "window_type": 1
}
```

> 正常流程用 `set-window --from-platform` 就够了 —— 平台会返回 space 级规范窗口，CLI 直接回写。**Agent 不应自行编造 start / end 时间戳**。

**dev-add-app-env-items.example.json**（array）与 **dev-update-app-env-item.example.json**（single object）覆盖 DEV-phase 路径。

### 2.8 Entity selection for Agents

- User says "create release" or "起一个发布单" → `release create` (dry-run first)
- User says "add app to release" → `release audit add-app`
- User says "set PRE / GRAY / ONLINE" → `release audit apply-stage --stage {pre|gray|online}`
- User says "set time window" → `release audit set-window --from-platform`（默认路径，不要问用户时间）
- User says "submit" / "提审" → `release audit submit --process-id --app-id` (auto-validates, auto-confirms)
- User wants to inspect before writing → `release audit inspect` / `inspect-unit`
- User asks for the exact payload → any write subcommand without `--execute`

**Agent 决策默认值（未明确输入时）：**

- **Release 名称**：用户未提供时，默认按 `"<psm> simple release <YYYY-MM-DD>"` 生成（例如 `"box.facade.streamapi simple release 2026-04-19"`），在创建前向用户**一行确认**即可；用户沉默视为同意。
- **发布窗口**：永远用 `set-window --from-platform`，不问用户、不自行编造时间戳。
- **Units**：永远 deploy-all（见 2.7 "默认部署策略"）。用户要求局部开关时拒绝并指向 `set-apps`。
- **Repo 版本**：**simple flow 必须用户显式给版本清单**（SKILL 跟 dev flow 不对称，dev flow 可 default 最新，simple flow 不行）。用户没给时先问："要发的 repo 清单和版本号？"，拿到后才能写 plan.repo_versions。`preflight.ok=false` 时按 §2.7 "交互协议" 回显候选列表给用户，不自作主张换版本。

### 2.9 Behaviors to rely on

- **stage_auto_skipped** — if the platform exposes 0 `unit_iterms` for a stage (typical for GRAY_RELEASE on apps that disable gray), `apply-stage` returns `{materialized.stage_auto_skipped: true, auto_skip_reason, endpoints: [], results: []}` instead of attempting a no-op write. Treat this as **success without side effect** — do NOT retry.
- **preflight (dry-run)** — every `apply-stage` result carries a top-level `preflight` block with `ok`, `unknown_repo_versions`, `missing_repo_versions`, `selected_units`, `skipped_units`. Check `preflight.ok` before `--execute`. If `false`, fix `plan.repo_versions` using `available_versions` hints and re-dry-run.
- **unknown_repo_versions refusal** — live `apply-stage --execute` throws `LARK_DEVOPS_PLAN_VERSION_NOT_FOUND` (with `details.unknown_repo_versions` and available-candidate hint) if `preflight.ok=false`. Fix the plan first, then retry.
- **set-window --from-platform** — `set-window` adopts the space's canonical publish window by calling `/deploy/cd/audit/publish/get` and re-posting the same shape. Prefer this over `--file`; only supply `--file` when a space admin explicitly wants to override the canonical window.
- **submit post-verify** — after calling the submit endpoint, `submit` re-queries `audit/process/list` and checks `status=PENDING` + non-empty `detail_url`. If either fails, the result carries `error: "submit_did_not_start: …"` and `verification.verified=false`. The feishu approval URL is in `verification.detail_url` on success.
- **submit auto-confirm** — `submit --process-id --app-id --execute` runs `audit/user/update/v2` (confirm) first, then `audit/process/update/id`. No need to call `confirm-apps` separately in the main path.

### 2.10 Constraints

- Only `--flow simple` is supported (dev / full flows explicitly disabled)
- **Deploy-all units only**：极简流程下 Agent 不支持 unit 级局部开关、不覆盖 `cluster_ids` / `grayscale_on` / `online_deploy_type`；用户要求精细控制时走 `set-apps` 逃生口
- **Window is space-level canonical**：始终 `set-window --from-platform`；不问用户、不自行编造时间戳
- **Version mismatch requires user confirmation**：`preflight.ok=false` 时按 2.7 交互协议回显候选给用户，Agent 不自选版本
- `submit` rejects if `PRE_RELEASE` or `ONLINE` validation fails (use `release audit inspect` to debug)
- Space search is read-only; it does NOT auto-resolve `--space-id` in `release create` — always pass numeric `--space-id` explicitly
- `release audit set-apps` is a lower-level escape hatch; prefer `apply-stage` for normal flow
- Real writes are logged on the platform — avoid running live writes against production processes that are already mid-audit

---

## 3. Dev flow (process_type=4, 开发流程发布)

### 3.1 When to use (dev flow vs simple flow 决策)

**选 dev flow（§3）当：**

- 用户明确说 "在 BOE 环境跑/发/测试 feature 分支" / "BOE feature" / "开发流程"
- 用户只想在 BOE 环境验证，**不需要上线** PRE_RELEASE / GRAY_RELEASE / ONLINE
- 用户提供了 BOE feature env tag 名（如 `boe_xxx_test`）

**选 simple flow（§2）当：**

- 用户说 "上线" / "灰度" / "提审" / "发布到生产" / "全量上线"
- 用户提到 `PRE_RELEASE` / `GRAY_RELEASE` / `ONLINE` 任一阶段
- 用户提到审批（audit submit / 提审）、发布窗口（set-window）

**拿不准时询问用户**（常见模糊词）：

| 用户说 | 问用户确认 |
|---|---|
| "测试环境" | 是 BOE feature 测试（dev）还是 PRE_RELEASE 预发（simple）？ |
| "跑 feature 分支" | 是只在 BOE 验证（dev）还是走完整上线流程（simple）？ |
| "先发一下" | 目的地是 BOE（dev）还是生产环境（simple）？ |

两者 `release create` 参数只有 `--flow` 不同，但后续命令完全不共享（`release dev *` vs `release audit *`）。

### 3.2 ⚠️ 环境隔离强约束（必须牢记）

**dev flow 与线上发布流完全隔离。** 这是 dev flow 的第一性原则：

- `deploy_phases` 永远只是 `[1, 2]` = `[DEV, INTEGRATION]`
- CLI 组装 env_items 时，**只允许读取 `app_detail.stage_envs["1"]`（DEV）和 `stage_envs["2"]`（INTEGRATION）**；key `"3"`、`"4"`、`"5"` 对应的 PRE/GRAY/ONLINE 环境绝对不能被读取或写入
- service 层 `assertDevFlowIsolation` 守卫会在任何写路径前检查 payload，出现 `deploy_stage >= 3` / `phase_type >= 3` 的字段立刻抛 `LARK_DEVOPS_DEV_FLOW_LINE_CONTAMINATION` 拒绝写入
- 如果你（Agent）看到这个错误码，**不要重试**，告诉用户 CLI 内部出了一个 bug，不是用户的输入问题

### 3.3 Prerequisites

- **认证**：跟 2.2 一样，Chrome `beops_session` cookie 为主、SSO session 兜底；写操作还需要 `_csrf_token`
- **`--space-id` 必传**：dev flow 跟 simple flow 一样，space 不提供全局默认。User 只给空间名时 agent 通过 `space search --name-like` 解析；没给就问
- **`--app-id` 必传**：同理，通过 `app search --psm` 解析
- **`--boe-feature` 必须是已注册 tag**：先跑 `release dev list-boe-features --psm <psm>`（见 §3.5 step 0）；首次用一个新 tag 让用户去 UI 注册

### 3.4 Strict sequence for `--flow dev`

**六步顺序，不可颠倒**（顺序错 agent 会踩 TCE 锁 / 空 pipeline 等陷阱）：

```
1. release create --flow dev
2. release dev add-app                           # 单 app 走 flag，多 app 走 --file
3. release dev execute-pipeline --phase dev      # 部署 BOE feature 服务（必须先于 integrate）
4. release dev integrate                         # 建 MR，BOE feature → BOE prod
5. release dev execute-pipeline --phase integration  # 跑合并后的 pipeline
6. release dev finish                            # 手动收尾（平台不会自动 finish）
```

**关键顺序语义：**

- **Step 3（`--phase dev`）必须在 Step 4（integrate）之前**：DEV pipeline 负责把 feature 分支代码部署到 BOE feature 环境；没跑它直接 integrate 会基于未部署的代码建 MR，后续 integration pipeline 会失败
- **Step 5（`--phase integration`）必须在 Step 4（integrate）之后**：INTEGRATION phase 的 env_items 是 integrate 创建出来的；integrate 之前该 phase 没东西跑
- `execute-pipeline` 两次调用**必须显式指定 `--phase`**（CLI 不给默认值，避免歧义）

### 3.5 Commands

**Step 0 — 资源发现**

```bash
# user 只给空间名 / PSM？先解析 id
bytedcli lark-devops space search --name-like <keyword> -j   # → space_id
bytedcli lark-devops app search --psm <psm> -j               # → app_id

# 查这个 PSM 下已经在平台注册的 BOE feature tag 列表
bytedcli lark-devops release dev list-boe-features --psm <psm> -j
# 返回 data.features[]: [{env: "boe_xxx", service_id: N}]
# 用户给的 --boe-feature 必须在这个列表里；不在就让用户去 UI 注册
```

```bash
# 1. Create
bytedcli lark-devops release create --space-id 69 --name "demo-dev" --flow dev -j
bytedcli lark-devops release create --space-id 69 --name "demo-dev" --flow dev \
  --execute --yes-i-know-this-is-live -j

# 2a. Add app — single-app shortcut（最常用），--boe-feature 必填
bytedcli lark-devops release dev add-app \
  --process-id 76200 --app-id 1452 --branch feat/demo \
  --boe-feature boe_my_test_env -j

# 2b. Add app — declarative batch form（多 app）
bytedcli lark-devops release dev add-app --process-id 76200 --file apps.json -j

# 2c. Add app — live
bytedcli lark-devops release dev add-app \
  --process-id 76200 --app-id 1452 --branch feat/demo \
  --boe-feature boe_my_test_env \
  --execute --yes-i-know-this-is-live -j

# 3. DEV pipeline — 部署 BOE feature（必须先于 integrate）
bytedcli lark-devops release dev execute-pipeline \
  --process-id 76200 --phase dev --wait --timeout-ms 1800000 \
  --execute --yes-i-know-this-is-live -j

# 4. Integrate — 建 MR（BOE feature → BOE prod）
bytedcli lark-devops release dev integrate --process-id 76200 \
  --execute --yes-i-know-this-is-live -j

# 5. INTEGRATION pipeline — 跑合并后的代码（必须在 integrate 之后）
bytedcli lark-devops release dev execute-pipeline \
  --process-id 76200 --phase integration --wait --timeout-ms 1800000 \
  --execute --yes-i-know-this-is-live -j

# 6. Finish — 平台不会自动 close，必须手动调
bytedcli lark-devops release dev finish --process-id 76200 \
  --execute --yes-i-know-this-is-live -j
```

### 3.6 add-app 的两种入参形态

**形态 A：单 app flag 快捷形式**

```bash
--process-id <id> --app-id <id> --branch <feat/xxx> --boe-feature <tag> [--repo-versions-file file.json]
```

**形态 B：声明式批量 file（Agent 编程最友好）**

`apps.json`:

```json
{
  "apps": [
    { "app_id": 1452, "branch": "feat/foo", "boe_feature": "boe_my_test_env" },
    { "app_id": 1789, "branch": "feat/bar", "boe_feature": "boe_my_test_env",
      "repo_versions": { "ee/example/dep": "1.0.0.123" } }
  ]
}
```

**规则：**

- 两种形态**互斥**（类似 `set-window --file` vs `--from-platform`）
- `app_id` / `branch` / `boe_feature` 三者都是**必填**；`repo_versions` 可选
- `boe_feature` 必须在平台对这个 PSM 注册过（见 3.10）；Agent 不要自行编名字
- `repo_versions` 未指定的依赖库自动取平台最新版本；键用 **slash-form**（`ee/example/dep`）
- 主仓库由 `--branch` 指定分支，不需要在 `repo_versions` 里列它

### 3.7 add-app 的 preflight

dry-run 返回的 `preflight` 块是 Agent 写前判断的唯一信号：

```json
{
  "mode": "dry_run",
  "process_id": 76200,
  "phase_id": 555,
  "preflight": {
    "ok": true,
    "resolved_apps": [ ... ],
    "unknown_branches": [],
    "unknown_repo_versions": [],
    "unknown_boe_features": [],
    "line_contamination_check": "pass"
  }
}
```

- `preflight.ok=true` → 可安全 `--execute`
- `preflight.ok=false` → 看以下三个 blocker 字段定位问题，**向用户回显** 候选信息让用户确认，**不要自行挑版本/挑 feature**
- 即便不看 preflight，`--execute` 会在 preflight 失败时直接抛 `LARK_DEVOPS_DEV_ADD_APP_PREFLIGHT_FAILED` 强制拒写

**三个 hard-blocker：**

1. **`unknown_repo_versions`** — 用户 `--repo-versions-file` pin 的版本不在 `scm/versions` 候选里。回显 `available_versions` 给用户选
2. **`unknown_boe_features`** — 用户的 `--boe-feature` 标签没在平台预注册。**必须让用户先去 `lark-devops.bytedance.net` 上给这个 PSM 注册该 BOE feature**（UI 一次性动作），然后 CLI 才能触发。已注册列表在 `unknown_boe_features[*].registered_features`。CLI 通过 `/deploy/cd/publish/v1/get_boe_tag_list?psm=<psm>` 拉取
3. **`line_contamination_check: fail`** — payload 出现 `deploy_stage >= 3`（严重 bug，不是用户错）

**soft warning（不 block execute）：**

- `unknown_branches` — `search_branch` 探测失败，通常是误判，平台自己会在 execute 时验证

### 3.8 Agent 决策默认值

- **Release 名称**：未提供时默认 `"<psm> dev release <YYYY-MM-DD>"`（如 `"example.app.entity dev release 2026-04-19"`），提前向用户一行确认
- **主仓库分支**：必须用户指定，CLI 不自动挑。分支在 SCM 不存在时 preflight 失败
- **依赖库版本**：未指定 → 平台最新版；用户在 `repo_versions` 显式指定 → 锁定并校验
- **Units**：dev flow 无 unit 概念（固定 BOE），无需配置
- **发布窗口**：不适用（dev flow 无发布窗口）
- **finish 时机**：pipeline 跑完（`execute-pipeline --wait` 返回 `SUCCESS` 之类）后才调 `dev finish`

### 3.9 错误码

- `LARK_DEVOPS_DEV_FLOW_LINE_CONTAMINATION` — 线上环境污染（严重 bug，不是用户错）
- `LARK_DEVOPS_DEV_ADD_APP_PREFLIGHT_FAILED` — preflight 失败后仍 `--execute`（未注册 boe_feature / unknown_repo_versions）
- `LARK_DEVOPS_INPUT_ERROR` — 普通参数校验失败（缺 `--branch`、`--file` 结构错等）

### 3.10 BOE feature 必须预注册

- **Dev flow 的 boe_feature 标签必须已经在 lark-devops 平台上给该 PSM 注册过**。CLI 通过 `/deploy/cd/publish/v1/get_boe_tag_list?psm=<psm>` 取到已注册列表
- 首次用一个新 BOE feature：**让用户去 `lark-devops.bytedance.net` 对应 PSM 页面注册一次**（UI 一次性动作），CLI 无法替代
- 为什么：CLI 触发的 DEV pipeline 在 CN-TCE 创建 service 的代码路径无法"现注册"一个从未见过的 feature，会失败；UI 有单独的注册步骤
- preflight 里 `unknown_boe_features[*].registered_features` 会列出当前可用的 feature，Agent 应该直接回显给用户挑

### 3.11 Constraints

- `--flow dev` 与 `--flow simple` 共享大部分 `release create` 参数；只有 `process_type` / `deploy_phases` 不同
- **不支持** dev flow 进阶到 AUDIT/PRE/GRAY/ONLINE —— 那是 simple flow 的链路；需要线上发布请另起一单 simple flow
- `release dev update-app` 是低层逃生口（传 raw JSON env_item），标准流程请用 `dev add-app`
- `dev finish` 必须手动调 —— pipeline 完成后工单不会自动 close
- `scm_type` 每个 repo 版本不同（主仓 `offline`；依赖从 `scm/versions.results[].type` 拿，通常 `online`，偶尔 `test`）。CLI 自动从平台取，不要硬编码。极端情况下平台响应没有 `type` 字段（历史数据），CLI fallback 为 `"online"` —— 如果 pipeline 因此在 i18n 挂，让用户改用 `--repo-versions-file` 精确 pin 一个新版本
- `boe_feature` 必须是已注册列表（见 3.10）里的值；首次使用必须先 UI 注册

---

## 4. FG (Feature Gate)

### 2.1 When to use

- 查询 FG meta / rule 版本信息（需要 FG 数字 ID）
- 新增 / 删除 FG 灰度规则（用户 ID、租户 ID、会话 ID、部门 ID、自定义规则等）
- 查询 FG 发布工单

### 2.2 Prerequisites

FG Open API 需要 app_id + app_secret 鉴权（与 1.2 的 SSO session 无关）：

```bash
bytedcli lark-devops fg auth config --app-id <your-app-id> --app-secret <your-app-secret>
```

或环境变量：`BYTEDCLI_LARK_DEVOPS_FG_APP_ID`、`BYTEDCLI_LARK_DEVOPS_FG_APP_SECRET`。

### 2.3 Quick start

```bash
bytedcli lark-devops fg auth config --app-id example-app --app-secret example-secret
bytedcli lark-devops fg auth status

bytedcli lark-devops fg meta get --id 6910 --unit cn
bytedcli lark-devops fg meta get --id 6910 --unit boecn --versions 2

bytedcli lark-devops fg rule get --id 6910 --unit cn

bytedcli lark-devops fg rule create --feature-key example.key --app Feishu --unit cn \
  --user-id uid1 uid2 --comment 'Add test users'

bytedcli lark-devops fg rule create --feature-key example.key --app Feishu --unit cn \
  --entity-ids id1 id2 --comment 'Add custom entities'

bytedcli lark-devops fg rule delete --feature-key example.key --app Feishu --unit cn \
  --user-id uid1 --comment 'Remove test user'

bytedcli lark-devops fg ticket list --id 6910 --unit cn
```

### 2.4 FG Notes

- **查询命令** (meta get, rule get, ticket list) 使用 FG 的数字 `--id`（不是 feature_key）+ `--unit`
- **写命令** (rule create/delete) 使用 `--feature-key` + `--app` + `--unit`
- **app** 枚举值：Feishu, Lark, Docs, Smartable, Lark_Meetings, Meego, Miigo, EA, People（大小写敏感）
- **unit** 枚举值：cn, va, larksgaws, larkjpaws, larkmy, ueeast15a（线上）; boecn, boeva（BOE）
- **env** 可选，不传时按 unit 自动映射：boecn/boeva → staging，其他 → online
- 条件规则与自定义规则互斥，每次请求只能传一类
- FG 发布工单串行：如有工单未到终态，写操作会被阻塞
- `--comment` 强烈建议填写变更原因
- 接口统一走 `https://lark-devops.bytedance.net`（含 BOE 数据）

---

## References

- [Invocation](references/invocation.md)
- [Troubleshooting](references/troubleshooting.md)
- [Release plan examples](references/release-plans/)
  - `audit-stage-plan.example.json`
  - `audit-set-apps.example.json`
  - `publish-window.example.json`
  - `dev-add-app-env-items.example.json`
  - `dev-update-app-env-item.example.json`
