# bytedcli Command Surface

用这个文件把用户任务映射到顶层命令域。它不是完整子命令手册；需要精确参数或最新子命令时，继续执行：

```bash
bytedcli <domain> --help
```

## 目录

- General utilities
- Code, release, and configuration
- Collaboration, docs, and AI knowledge
- Data, storage, and analytics
- Runtime, logs, and observability
- Quick routing by artifact

## General utilities

- `auth`: SSO 登录、登出、状态、用户信息、ByteCloud JWT、Codebase JWT。
- `mcp`: 用同一套 Commander 命令树启动 stdio MCP server。
- `self`: bytedcli 自管理能力；当前包含 `self update`（升级全局 npm / pnpm 安装）和 `self tracking`（匿名 CLI/agent 使用追踪管理）。`self tracking enable` 支持 `--agent all|claude|codex|coco`（默认 `all`）、`--mode global|project`（默认 `global`）、`--sink noop|byteio`（默认 `byteio`）；hook 上报前会移除参数值、prompt、文件内容和真实路径，只保留命令结构、flag 名、状态、耗时和匿名 session / cwd。

## Code, release, and configuration

- `codebase`: 仓库、MR、Review、Issue、评论、文件、Check Runs、CI、Merge Queue、创建分支。
- `bam`: PSM 列表/搜索、方法列表/详情、代码生成规则与生成任务、版本列表、IDL 更新。子组：`psm`/`method`/`codegen`/`version`/`idl`；旧的平铺命令保留为隐藏别名。
- `agw`: AGW 产品列表/搜索/详情、服务搜索、环境注册、IDL 更新与发布。子组：`product`/`service`/`env`/`idl`；旧的平铺命令保留为隐藏别名。
- `bits`: develop 任务、lane、流水线、release workflow、RPC 调用。
- `bpm`: BPM 工单查询、日志、评论、可执行操作、状态推进与取消。子组：`ticket`。
- `test-plan`: Bits 测试计划用例获取，脑图解析并导出 Markdown。
- `bitsai`: 研发知识、研发资产、TCE/TCC/FaaS/Goofy 等工程问答。
- `scm`: 仓库列表/搜索/创建/构建/构建日志、版本列表。子组：`repo`（含 `repo version`）；旧的平铺命令保留为隐藏别名。
- `luban`: Luban npm 包查询；当前覆盖 `search`，支持按 `--npm` 查询 Bytedance 或 TTP Luban 里的 bnpm 包记录，并可选传 `-v/--package-version` 做版本前缀过滤；传 `--site us-ttp` 时切到 TTP 环境。
- `lynx`: Lynx 工具；当前覆盖 `example get`（解析 LynxExample tag/platform/commitHash/downloadUrl 元信息）和 `example download`（下载 LynxExample 产物到本地目录，支持 `--force` 覆盖）。
- `manta`: Manta 数据探查、表监控规则查询与两表对比平台；当前覆盖 `auth login`（浏览器登录 DataLeap Manta）、`yarn-queues`（列出用户可用的 YARN 队列）、`monitor list`（按表/项目/状态/类型查询监控规则）、`profile rule create`（创建数据探查任务）、`comparison job create`（创建两表数据对比任务）和 `comparison sql create`（基于 SQL 的数据比对，自动处理 map/array 字段）；支持 `--region`（cn/sg/va/eu/mycis，默认 cn）；监控查询参数：`--table-name-query`、`--project-id`（可重复）、`--mine`、`--triggered-only`、`--monitor-state`、`--monitor-type`（可重复）、`--limit`、`--offset`；探查参数：`--db-name`、`--tb-name`、`--partitions`、`--columns`（省略自动探查全部字段），YARN 队列自动选取；对比参数：`--db-name-old/new`、`--tb-name-old/new`、`--partition-old/new`、`--primary-keys`（JOIN 匹配行，`;` 分隔）、`--comparison-columns`（对比字段，`;` 分隔），YARN 队列自动选取；SQL 比对参数：`--source-table`/`--target-table`（`db.table` 格式）、`--source-filter`/`--target-filter`、`--join-keys`（逗号分隔）、`--map-keys`（map 字段展开 key）、`--dry-run`（仅预览 SQL），YARN 队列自动选取；鉴权使用 DataLeap session cookie（需先 `npm install -g puppeteer-core` 再 `bytedcli manta auth login --region <region>`）；cn 走 `prod` 站点 SSO，sg/va/eu 走 `i18n-tt` 站点 SSO，mycis 走 `i18n-bd` 站点 SSO。
- `coral`: Coral 元数据平台；覆盖 `ai-generate`（触发 AI 生成资产使用说明文档，`--table-name`、`--operator` 必填，资产全限定名根据表名与区域 cid 自动拼接，`--region` 支持 cn/sg/gcp/va/mycis、默认 sg，`--generate-type` 默认 ASSET_INSTRUCTION）、Hive 元数据查询、实体搜索，以及 `permission apply` / `permission answer` / `permission create` / `permission withdraw` 申请、补充问卷、提交或撤回 Hive 表/列权限；申请权限使用 `--db-name`、`--table-name`、`--auth-object`，列级权限用可重复/逗号分隔的 `--column` 指定，并用枚举参数限制 `--permission`（read/write）、`--auth-type`（person/psm）、`--requirement-type`（data-analysis/index-calculation）和 `--region`（cn/sg/gcp/va）；若 apply 返回 draft/questions，用 `permission answer --draft-file ... --question-id ... --answer ...` 填写，再用 `permission create --draft-file ...` 提交；撤回权限使用 `--id` 和 `--region`；鉴权优先使用 Session Cookie，也支持 JWT 自动 fallback。
- `overpass`: IDL 同步、代码生成、生成分支、项目维度管理（repo 搜索、分支查询、订阅管理）。
- `goofy`: 站点、项目、部署、region、quick preview、回滚、channel。
- `nexde`: NexDE 部署平台；当前覆盖 `project list`，支持 `--region sg` 列出当前用户可见项目，鉴权复用 Titan Passport session。
- `tcc`: namespace、配置查询、创建、更新、发布、deployment detail、审批。子组：`namespace`/`config`/`deployment`/`env`/`site`；旧的平铺命令保留为隐藏别名。
- `bytestable`: Bytestable 平台命令组；
  - `bytestable wcc`: 用于 WCC 的 service、namespace、env、配置查询、新建、元信息更新、结构定义更新、配置值更新，以及相关 deployment、codegen、发布工单。
- `tce`: 服务列表/搜索/详情、集群列表、实例列表/搜索、发布工单列表/详情/取消、env cascader、lane 部署。子组：`service`/`cluster`/`instance`/`deployment`；旧的平铺命令保留为隐藏别名。
- `spark-platform`: Spark OpenAPI 资源能力，覆盖：`space list`；`link list`（`--bid` 走 `/api/openapi/v1/links`，`--space-id` 走 `/api/openapi/v1/spaces/:space_id/links`，二选一）；`link create`（CreateShortLink，支持 `--dry-run`）；`link get`（完整 raw 数据，包含所有 version 与原始 deployConfig，无派生字段）；`link summary`（取最新已发布 version，并把 deployConfig 解析成 `schema.pageConfigs[]`，字段含 `schemaUrl`/`bundle`/`bundlePath`/`abParams`/`dynamicParams` 等）；`link env list` / `set` / `delete`（`--app-id` 可选，默认 `22`；`set` 与 `delete` 支持 `--dry-run` 打印最终 payload 不实际发请求）。注意：`--bid` 是业务线 ID，不是 space 的 `id`，两者不互通。
- `kross`: 创建多平台（Linux、macOS、Windows）容器环境（workload），支持 workspace 列表、workspace 维度的 container template 查询、workload 列表、workload 创建/删除，通过 webshell 在 workload 容器内执行命令，以及基于临时 capability URL 的 workload 文件上传/下载。子组：`workspace`/`template`/`workload`。
- `env`: 环境搜索、标准环境、创建、设备、审计、TCE 服务升级/部署。子组：`site`/`service`/`device`/`ticket`；旧的平铺命令保留为隐藏别名。
- `faas`: FaaS 服务全生命周期管理（子组：`function`/`cluster`/`trigger`/`revision`/`template`/`release`/`log`/`invoke`/`remove`）；查询服务、集群、触发器、代码版本、模板；查看日志；调用函数（HTTP/Timer/Kafka/RocketMQ/EventBus/TOS）；创建/中止发布；创建/更新/删除触发器；删除服务和集群。
- `tae`: TAE / AI PaaS 命令；当前覆盖平台原生 `tae agent search/list/get`、`tae sandbox search/list/get`、`tae mcp server search/list/get/create/update/release`、`tae mcp tool list/get/create/update/delete`、`tae mcp schema generate/update`，以及已确认路径的 `tae api get/post/update/delete` 原生透传。
- `bytedance-tae`: TAE / AI PaaS 内部 API 工作流；重点覆盖 Agent/Sandbox list/get、`/tae/mcp_server/...` 页面下 MCP Server 新建/list/detail/update、tools 的 create/update/delete、从 Thrift IDL 生成 `tool_input_schema`、release 发布与验证；也记录 Memory、Skill、A2A Registry、Security、Keys 等已发现页面/操作名。CLI 未覆盖能力时使用该 skill 指南。
- `volcano`: Volcano Engine；支持两种鉴权：SSO session（`volcano auth login`）和 AK/SK（`volcano auth config`）。覆盖 veFaaS 函数、实例、release、沙箱函数、sandbox、sandbox image，CR 镜像仓库资源，TLS topic/log，VKE 集群/节点池，以及 VPC、NAT 网关、子网、安全组等资源查询。`volcano auth accounts` 可列出当前用户有权限的火山账号。
- `bytecloud` / `cloud`: 站点、vregion、VDC 等字节云基础信息。
- `bytetree`: 服务树节点搜索、详情查询、子节点遍历、父链查询。
- `netlink`: 域名、路径、topology、servername、域名配置。
- `neptune`: dispatch、stability、rate limit、security 治理配置。
- `settings`: Settings 配置全流程能力（`item`/`draft`/`review`/`deploy`/`whitelist`/`ut`/`var`/`biz`）。
- `cloud-ticket`: 工单查询、审批、按创建者/待审批/全部筛选。
- `kani`: Kani 权限审批工单列表；当前覆盖 `kani approval list`，默认读取 request 页语义，并支持 applicant / reviewer、running / finished、urgent bucket 等筛选。文本输出会尽量贴近 Kani 页面卡片字段，同时保留完整工单 ID 和 workflow_id。
- `dkms`: data key 查询、权限检查、权限列表、授权。
- `kmsv2`: keyring、customer key、ACL 权限管理。
- `iam`: 员工信息查询。
- `byteio`: ByteIO 埋点元数据、参数校验、需求、BTM 点位、测试用例、点位映射与广告 tag/label 查询。子组：`event`/`requirement`/`btm point`/`test-case`/`map`/`ad`；鉴权通过 `BYTEDCLI_BYTEIO_AUTHORIZATION` 提供 OpenAPI authorization。

## Collaboration, docs, and AI knowledge

- `insearch`: 跨源搜索字节内部知识、文档、服务与工具。当前覆盖 `query`（多源并行搜索）、`get`（按 URL 或 ID 获取内容）、`login`（一键登录所有搜索服务）、`status`（检查各源认证状态）。支持的数据源：feishu.cn、ask.feishu.cn、cloud.bytedance.net、bytedance.net、bitsai.bytedance.net、bytetech.info。
- `feishu`: 文档、Wiki、评论、Drive 媒体、日历、会议、任务、Sheet、Bitable、消息、聊天。
- `fundeye`: fundeye 资金安全，对账平台，fullink / tcheck核对规则详情、差异、告警详情和列表。
- `starling`: Starling 文案平台 OpenAPI；当前覆盖业务线、项目、空间/任务文案，以及项目内文案搜索。
- `cloud-docs`: 云文档搜索、业务列表、文档列表、Markdown 正文获取。
- `meego`: OAuth 登录后的资源命令域，优先使用 URL 或资源化子命令，不要手拆 MCP tool 名；常用入口有 `workitem`、`view`、`comment`、`chart`、`team`、`node`、`state`，URL 优先如 `comment list --url <workitem-url>`、`chart list --url <view-url>`、`view get --url <view-url>`、`workitem get --url <workitem-url>`，流转前置检查用 `state transition required get`，`array<string>` 类型原生参数除 JSON 外也支持单值、逗号或竖线分隔（如 `--user-keys foo,bar` 或 `--user-keys foo|bar`），非 JSON 模式优先输出表格，查评论、图表、团队、成员、排期时默认看文本模式即可。需要富文本详情（Quill Delta 转 Markdown、图片/附件下载 URL、linked_story 展开）时加 `--rich`，如 `meego workitem get --rich --url <issue-url>`；执行前先跑 `bytedcli auth login --session --feishu`，CLI 会复用保存下来的 Feishu Web session，通过纯 HTTP 链路换出 Meego goapi 所需 cookie。附件下载走 `meego workitem download-attachment --url <attachment-url> --output <dir>`，URL 从 `--rich` 输出的 description Markdown 里提取。
- `fornax`: prompt workspace、prompt 查询、创建、更新、发布，以及 experiment 创建、详情、results、aggr-results；experiment 额外支持 `fornax auth config/status` 配置 JWT 或 AK/SK。
- `aime`: AIME space 列表/详情、session 创建/获取/列表/发送(附件上传，支持 `--site i18n-tt` 切 TikTok ROW 域名)、chat、interactive、DeepWiki。子组：`space`/`session`；旧的平铺命令保留为隐藏别名。
- `tika`: Tika AI 对话、conversation、model、space。

## Data, storage, and analytics

- `rds`: 收藏数据库、库详情、表、schema、SQL 查询、BPM 工单（含 `bpm permission apply`、`bpm update --sql`）。子组：`db`/`slow`/`alert`/`ops`/`bpm`（含 `bpm permission`）；旧的平铺命令保留为隐藏别名。
- `bytehouse`: 在 ByteHouse 集群上执行 SQL；`cluster search` 支持按 keyword / region / dc / product 搜索 ByteHouse 集群，`query run` 支持通过 `--cluster-id` 或 `--cluster-name` 在对应集群执行 SQL，SQL 可来自 `--sql` 或 `--file`，支持 `--dry-run` 与 `--rows`。
- `bytedoc`: ByteDoc 数据库搜索、关注列表、详情、集合、文档 CRUD、慢查询、Mongo shell 风格数据查询。
- `dataq`: 海外 DataQ RDS 查询，主要覆盖 `i18n-tt` 站点。
- `hive`: DataLeap 资产搜索、schema、lineage、partition、rows，以及 Hive 表创建与字段修改。
- `oneservice`: OneService query 元信息、query version detail，以及按 queryId 自动解析当前 ONLINE version 后提取 SQL；当前覆盖 `meta get --id <queryId>`、`detail get --id <versionId>`、`sql get --id <queryId>`；鉴权依赖所选站点的浏览器 session cookie，默认 `cn` 使用国内 OneService 端点，`--site i18n-tt` 使用 i18n-tt OneService 端点，需先对目标站点执行 `auth login --session`。
- `byterec-indexservice`: Byterec 索引服务查询；当前覆盖 `byterec indexservice product get --psm <psm>`、`byterec indexservice config get --psm <psm>`，以及同组件在 Holmes 平台下的 `holmes indexservice proto list/create/get`、`holmes indexservice record get`。前两者按 PSM 返回索引服务产品信息、拓扑、授权、配置常量与变量信息；后者提供 proto 管理与 record 调试读取。record / group info 查询默认直接走 Holmes proto / record 链路；只有明确要求平台产品或配置上下文时才查 Byterec product/config。Byterec 控制面会跟随全局 `--site` / `BYTEDCLI_CLOUD_SITE` 自动路由：`i18n*` -> VA/SG，`us-ttp*` -> US，`eu-ttp` -> EU，`cn` -> CN；默认建议使用 `--site i18n-tt` 或 `BYTEDCLI_CLOUD_SITE=i18n-tt`，首次使用前按目标站点先执行 `bytedcli auth login --session --site <site>`。Holmes 侧首次使用前先 `bytedcli auth login --session`。若 Holmes record 查询阶段出现多个 `pb` / `pb-class` 候选，必须先用 `AskUserQuestion` 让用户明确选择，不能由 Agent 自行决定；若用户选择新建 proto，必须先向用户索取 proto 定义。
- `clickhouse`: DataLeap CoralNG ClickHouse 建表（`create`：结构化字段 + 引擎参数，支持 HaMergeTree / HaUniqueMergeTree / CnchMergeTree 等，`--cluster-name` 不传时按 `--database` 自动反查）、改字段（`field update`：按 GUID 整表替换列 / 分区键 / 主键，默认非主键列自动包 `Nullable(...)`，可用 `--no-auto-nullable` 关闭）、改表级属性（`attr update`：按 GUID 修改 TTL / 描述 / owner / 业务联系人 / 权限管理员 / 安全等级 / 核心资产标记，未传的 option 保留原值）与库元信息查询（`db get`：返回 cluster / virtualWarehouse / owners / env）。
- `aeolus`: dashboard/dataset 搜索、字段详情、SQL 查询、权限申请。
- `life`: 生活服务生财有数平台的工具集；当前覆盖直播数据工作台的工具集 `life live-screen`，其中 `summary --room-id <room-id>` 用于获取核心指标、指标元数据与诊断文案，`user-info` 支持按主播 ID、主播抖音号、直播间 ID 或主播昵称获取用户信息。认证复用 `auth login --session --auto` 保存的 Data portal 浏览器会话。
- `merlin`: Merlin job 按 job id 或完整 job URL 提取 submit-ready YAML、从本地 YAML 再次提交 job，支持 `merlin job list` 查看当前用户的 job runs、`merlin job trials` 优先按 Arnold `custom_id = job_run_id` 枚举所有 trials、`merlin trial diagnose` / `merlin trial local-log` 处理 trial 级问题；`merlin logs get` 查询 Merlin job/trial 的 stdout/stderr 日志；Merlin tracking 的 project/run/metric/job-link 只读查询；`merlin quota` 下的 group/cluster 只读查询。`--site` 控制鉴权拿 JWT，`--vregion` 选择 Merlin 环境，默认 `cn`，支持 `cn`、`i18n-bd`、`i18n-tt`、`eu-ttp`、`us-ttp-bdee`、`us-ttp-usts`，其中 `cn` 和 `i18n-bd` 支持 `--vregion seed`；支持 `merlin job list-sites`、`merlin tracking list-sites` 与 `merlin quota list-sites` 查看映射，其中 `merlin job list-sites` 会额外展示 job core / job trials 的 route 字段。
- `dorado`: project、task、folder、instance、query diff、ad-hoc SQL 执行与结果查询、MySQL->Hive binlog 状态检查与接入，以及节点草稿上的 Spark-jar operator 配置。子组：`project`/`task`/`folder`/`instance`/`adhoc`/`spark-jar`/`task binlog`；旧的平铺命令保留为隐藏别名。
- `tqs`: Table Query Service SQL 执行。
- `forge`: Forge 任务日志（`forge logs`）。
- `byteio`: ByteIO 埋点 OpenAPI；覆盖 `event get`（单个埋点元数据详情）、`event check-params`（埋点参数校验）、`event list`（按邮箱前缀查埋点）、`requirement list/get/locations`、`btm point get`、`test-case list/get`、`map locations/events`、`ad tags/labels`。支持 `--region cn|sg`（默认 cn），POST 类命令支持 `--body-json` 合并请求体。
- `es`: Elasticsearch DSL 查询、mapping 查询与更新。
- `cache`: Redis 服务搜索、慢日志、大 key、工单、命令执行。
- `bmq`: Kafka topic 列表/详情、cluster 列表、consumer 列表、mirror 列表。子组：`topic`/`cluster`/`consumer`/`mirror`；旧的平铺命令保留为隐藏别名。
- `tos`: bucket、用户信息（`get-user-info`）、用户记录、站点与 vregion。`user-info` 已重命名为 `get-user-info`，旧名保留为隐藏别名。
- `dolphin`: 动态决策平台（事件、规则组、规则）查询与测试用例检查。子组：`event`（含 `event group`/`event var`/`event param`）/`group`（含 `group factor`/`group feature-env`/`group testcase`）/`rule`；旧的平铺命令保留为隐藏别名。
- `safe`: 内容治理平台。认证（SSO 或 cookie 登录）、配置管理（tenant/business）、Puzzle 特征/实体/数据源/租户/包/集合、样本查询、Hawkpro trace、SafeMind model/graph/trace（含 test-node），以及 Digital Employee agent、图实例校验/更新、run-agent 试运行、仿真结果和批量仿真任务。子组：`puzzle`、`sample`、`hawkpro`、`safemind`、`de` / `digital-employee`；`ds` 是 `datasource` 别名，`pkg` 是 `package` 别名。相关子命令支持 `--tenant` 选项，优先级：`--tenant` > `SAFE_TENANT` env > config > 默认 `ecology`。

## Runtime, logs, and observability

- `cronjob`: 挂载、可用 zone、任务、执行记录、实例详情、重跑、debug。
- `log`: PSM 日志、LogID 查询、按接口维度做 BytedTrace 总体性能分析（`analysis performance`）、按 `logId` 查看 BytedTrace 调用树（`trace-tree`）、实例日志、日志聚类。
- `archer`: 链路级覆盖率查询（按 PSM + traceId 查询流量级函数调用链路与覆盖行明细）。
- `apm`: service preview、QPS、下游、Redis 监控。子组：`service`/`redis`；旧的平铺命令保留为隐藏别名。
- `slardar`: Slardar Web / App / OS 统一命令组。
  - `slardar web`: query assistant、告警 URL 分析、`alarm-rule-list`、`alarm-history`、JS Error、SOP 与 Investigation。
  - `slardar app`: Slardar App 工具集；`issue log` 支持从 Slardar App issue URL 拉日志，`issue log --symbolicate` 支持 Slardar retrace 与 native 栈符号化 fallback，`symbol url` 支持 `--build-id`、`--so-file` 或 `--uuid` 生成 native symbol uuid / symbol URL。
  - `slardar os`: Slardar OS 工具集；`issue log` 支持从 Slardar OS issue URL 拉取事件 summary，`issue log --symbolicate` 支持复用 Slardar App native symbol 能力解析主线程 native 栈。

## Quick routing by artifact

- `code.byted.org/.../merge_requests/...`、`issues/...`、仓库路径：走 `codebase`
- `bytedance.larkoffice.com/...`、`larksuite.com/...`、sheet / bitable / doc / wiki 链接：优先 `feishu`
- `starling.bytedance.net/...`、Starling 项目 / 空间 / OpenAPI 文档：优先 `starling`
- Cloud Docs 文档搜索/正文：`cloud-docs`
- 字节内部搜索（飞书/ByteCloud/内网/ByteTech/BitsAI 多源）：`insearch`
- `cloud.bytedance.net/tcc/.../publish-details/...`：`tcc deployment get` / `tcc deployment approve`
- `cloud.bytedance.net/bytedoc/...`：`bytedoc`
- `fornax.bytedance.net/space/...`：`fornax`
- `ml.bytedance.net/development/instance/jobs/...` 或 `seed.bytedance.net/development/instance/jobs/...`：`merlin job extract` / `merlin logs get`
- `ml.bytedance.net/experiment/tracking/...` 或 `seed.bytedance.net/experiment/tracking/...`：`merlin tracking`
- `reckon-*.tiktok-row.net/forge2/jobs/...`（Forge job/logs 页面 URL）：`forge logs --url <url>`
- TCE deployment / service / cluster 页面或 deployment id：`tce`
- `cloud.tiktok-row.net/tae/...`、`/ai/mcp_server`、TAE MCP Server/Agent/Sandbox/Memory/Skill 页面：`bytedance-tae`
- 字节云服务树页面、节点 id、目录层级：`bytetree`
- Goofy deploy / preview 页面、静态站点目录：`goofy`
- Redis、slow log、big key：`cache`
- ES index、mapping、DSL：`es`
- Hive 表、Dorado task id、报表 dataset：在 `hive` / `dorado` / `aeolus` 间选
- OneService queryId、versionId、invoker_server SQL：`oneservice`
- Byterec PSM、indexservice product/config 查询：`byterec indexservice`
- Slardar 告警页 URL：`slardar web analyze-alarm-url`
- Android `.so` BuildID / native symbol：`slardar app symbol url`；Slardar App issue retrace/native 栈：`slardar app issue log --symbolicate`
- Slardar OS issue URL / APK embedded native stack：`slardar os issue log --symbolicate`
- `safe.bytedance.net/...` 特征/实体/数据源/租户/包/集合、SafeMind、Digital Employee 页面或标识：`safe`

## Quick routing by user intent

- “帮我登录 / 看当前账号 / 拿 token”：`auth`
- “看 MR / 发 review / 查 CI / 回评论”：`codebase`
- “查某个 TTP-US npm 包在 Luban 里是否存在 / 看某个版本前缀”：`luban`
- “下载 LynxExample / 查 LynxExample tag、commitHash、downloadUrl”：`lynx`
- “更新配置 / 发配置 / 审批发布单”：`tcc`
- “查 WCC 服务 / namespace / env / 配置 / 新建配置 / 更新配置 / 发布工单”：`bytestable wcc`
- “列 Spark space / 创建 Spark link / 列某个 bid 或某个 space 下的 link_key / 看 link 的 env / 给 link 设置或删除某个 PPE env”：`spark-platform`
- “部署服务 / 看实例 / 查 cluster”：`tce` 或 `env`
- “查某个 workspace 可用模板 / 看这个 workspace 下有哪些 workload / 创建临时 job workload / 在 workload 容器里执行命令或传文件”：`kross`
- “查服务树 / 搜节点 / 看父子层级”：`bytetree`
- “看 FaaS 服务 / cluster / trigger / 日志 / 调用函数 / 发布 / 中止发布 / 代码版本 / 模板 / 删除服务”：`faas`
- “按 MCP 名称查 TAE server_id / 查询 TAE Agent/Sandbox / 录入 TAE MCP tools / 修复 MCP Input Schema / 发布 MCP server revision / 调研 TAE Memory Skill API”：`bytedance-tae`
- “看火山引擎函数 / 实例 / 实例日志 / 发布状态 / 发布记录 / 发起发布 / sandbox / sandbox image / CR / TLS topic / TLS 日志 / VKE / VPC / NAT 网关 / 子网 / 安全组 / 火山账号列表 / SSO 登录火山引擎”：`volcano`
- “查 Starling 项目 / 创建 Starling space / 搜索文案 key / 配置 Starling AKSK”：`starling`
- “查 Fornax workspace / prompt / prompt 发布 / experiment 结果 / 配置 Fornax experiment JWT 或 AKSK”：`fornax`
- “查文档 / 改文档 / 发飞书消息 / 约会议”：`feishu`
- “查技术文章 / 内部知识 / AI 问答”：`insearch`、`bitsai`、`tika`、`aime`
- “搜索内部文档 / 查字节内部知识 / 搜飞书文档 / 搜 ByteCloud 文档”：`insearch`
- “提取这个 Merlin job 的 YAML / 把这份 `trial.yaml` 重提到 `seed-cn` / 拉这个 Merlin trial 的 stdout/stderr / 看这个 tracking run 的 config 和 summary / 列出某个 project 下的 runs / 根据 Merlin job id 找 tracking 链接 / 查某个 trial 为什么还在排队”：`merlin`
- “查 ByteDoc 数据库 / 看慢查询 / 查集合 / 查改文档 / 看关注列表”：`bytedoc`
- “跑 SQL / 查 schema / 看 lineage / 查报表字段”：`rds`、`hive`、`dorado`、`aeolus`、`dataq`、`tqs`
- “查 ByteIO 埋点是否存在 / 校验埋点参数 / 查 ByteIO 需求、点位、BTM、测试用例、广告 tag/label”：`byteio`
- “查 OneService 元信息 / 看 query version detail / 按 queryId 取 SQL”：`oneservice`
- "查 Safe 特征 / 实体 / 数据源 / 租户 / 包 / 集合 / 内容治理平台 / SafeMind / Digital Employee"：`safe`
- “根据直播间 ID 看直播数据工作台 / GMV / 订单 / CTR / CVR / GPM”：`life live-screen summary`
- “按主播昵称 / 主播 ID / 抖音号 / 直播间 ID 获取直播数据工作台用户信息”：`life live-screen user-info`
- “查日志 / 指标 / 告警 / native symbol / Redis / Kafka”：`log`、`apm`、`slardar`、`cache`、`bmq`

## Notes

- 当多个域都可能成立时，优先选更贴近原始对象的域。
- 当任务目标是"把 bytedcli 暴露给宿主作为工具"，直接用 `mcp`，不要再手工包一层自定义 server。
- Global verb renames: `view` -> `get`, `edit` -> `update`, `find` -> `search`, `detail` -> `get`, `patch` -> `update`. Old names still work as hidden aliases.
- Global flag renames: `--page-num` -> `--page`, `--begin` -> `--start`, `--dbname` -> `--db-name`. Old names still work as hidden options.
