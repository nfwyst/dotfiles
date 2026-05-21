---
name: bytedance-oceanus
description: "Operate Oceanus (DataLeap) via bytedcli. Supports `project`, `tree-node`, `node`, and `task` command groups: project lookup/search and `project local list` mapping; IDE tree browsing with `tree-node get|list|search`; node create/get/delete, draft list/update/test/explain/commit/save-dispatch, directory creation, `node region create|add|delete`, `node global-node-uid get` / `node local-task-id get`, `node local-refine-status list`, `node online-remote get`, and `node review-match list`; legacy task search/bind lookup plus `task dependency-recommendation get|apply`. Use when users mention Oceanus, DataLeap Oceanus, jobs list, task tree, folder structure, recursive tree, create node, create folder, create directory, delete node, create region, add region, delete region, convert local/global tasks, update node draft, explain node draft, commit node, save dispatch, publish node, project search, code search, local regions, node draft, review policy, legacy task lookup, dependency recommendation."
---

# bytedcli Oceanus

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

## When to use

- Oceanus / DataLeap 项目、目录树和任务节点浏览
- 查看项目详情、项目参数和 global-local project 映射
- 递归展开目录树，支持从根目录、`uri` 或 `nodeUid`（`tree-node list --node-id`）开始查看
- 按 metadata / code 关键字搜索节点，定位任务、目录和代码命中结果
- 查询节点元信息、当前 draft、legacy draft、draft 版本和线上 remote 视图
- 获取节点真实代码，查看不同 region 下的实际代码视图
- 创建节点或目录，初始化单个或多个 region，并更新草稿代码与 metadata
- 删除节点、补建 region、通过 `region add` 追加 region 任务项、移除 region
- 在 global node 和 local task 之间做转换
- 调用 `node save-dispatch` 将指定 region 的调度信息写回 Oceanus（`POST .../saveDispatch`）
- 查询各 region local task 的健康度、同步状态、线上 remote 视图和 review policy 命中结果
- 查询 legacy task、绑定关系
- 获取依赖推荐，或将推荐出的依赖回写到 Oceanus 草稿

## 认证与站点

Oceanus 常见在 TikTok SSO 站点下使用，优先先检查认证状态：

```bash
BYTEDCLI_CLOUD_SITE=i18n-tt bytedcli auth status
BYTEDCLI_CLOUD_SITE=i18n-tt bytedcli auth login
```

如果接口需要浏览器态 cookie，可临时使用环境变量注入（用于本地调试）：

```bash
export BYTEDCLI_OCEANUS_COOKIE='bd_sso_3b6da9=...; titan_passport_id=...'
```

## 操作约定

- 删除类操作需要二次确认：使用 Oceanus 命令执行删除类操作前，必须先向用户做二次确认；未获得明确确认前，不得执行。典型场景包括 `oceanus node delete` 以及其他明确会删除资源的写接口。
- 修改类操作需要留痕汇报：使用 Oceanus 命令执行远端状态修改后，必须保留操作记录，并向用户汇报执行命令或接口、目标对象标识、关键入参、执行结果，以及新产生或变更的资源标识。典型场景包括 create/update/delete、`node region create` / `node region add` / `node region delete`、`node save-dispatch`、global-local 转换 等写请求。

## 支持的命令

`bytedcli oceanus` 提供 4 个一级命令域，和编译产物 `bytedcli oceanus --help` 一致：

- `oceanus project`: 项目列表、项目详情、项目参数、`project local list` 映射、分页搜索
- `oceanus tree-node`: 树节点读取、目录 list 展开、项目内 metadata/code 搜索
- `oceanus node`: 节点 `create` / `get` / `code get` / `draft list` / `draft update` / `draft test` / `draft explain` / `commit` / `save-dispatch` / `delete`、`region create` / `region add` / `region delete`、`global-node-uid get` / `local-task-id get`、`local-refine-status list`、`online-remote get`、`review-match list`
- `oceanus task`: legacy task 搜索、`bind-node get` 查询、`dependency-recommendation get` / `dependency-recommendation apply`

### oceanus project

查看项目列表、项目详情、项目参数和按关键字搜索项目：

```bash
# 列出当前账号可访问的 Oceanus 项目
bytedcli oceanus project list
# 查看指定 project 详情
bytedcli oceanus project get --project-id 123
# 查看 project params
bytedcli oceanus project param list --project-id 123
# 按关键字分页搜索项目；--page / --page-size 必须是正整数
bytedcli oceanus project search --keyword demo --page 1 --page-size 20
# 查看 global project 到各 region local project 的映射
bytedcli oceanus project local list --project-id 123
```

### oceanus tree-node list

列出某个 `uri`（默认 `task:///`）下的子节点，也支持直接传 `--node-id`，让 CLI 先自动解析出节点对应的 `uri` 再继续查询；默认打印一层。批量查询使用 `--uri` 一个入口，可传逗号分隔值或重复传 `--uri`。显式传 `--max-depth` 时，会继续向下递归展开目录树。

```bash
# 列出项目根目录下一层子节点
bytedcli oceanus tree-node list --project-id 123
# 直接从某个 nodeUid 开始查看它下面的一层子节点
bytedcli oceanus tree-node list --project-id 123 --node-id NdemoDir
# 列出指定 uri 目录下一层子节点
bytedcli oceanus tree-node list --project-id 123 --uri task:///
# 一次查询多个目录的一层子节点（逗号分隔）
bytedcli oceanus tree-node list --project-id 123 --uri task:///,task:///NdemoDir
# 一次查询多个目录的一层子节点（重复 --uri）
bytedcli oceanus tree-node list --project-id 123 --uri task:/// --uri task:///NdemoDir
# 按指定深度递归打印目录树
bytedcli oceanus tree-node list --project-id 123 --max-depth 3
# 从某个 nodeUid 开始自动递归到全部叶子节点
bytedcli oceanus tree-node list --project-id 123 --node-id NdemoDir --all
# 自动递归到全部叶子节点
bytedcli oceanus tree-node list --project-id 123 --all
# 从指定目录开始递归打印
bytedcli oceanus tree-node list --project-id 123 --uri task:///sample-dir --max-depth 3
```

### oceanus tree-node search

按元数据或代码内容关键字搜索树节点，适合做项目内任务检索和代码命中定位；若需要走更底层的 `tree-node` 查询接口，可直接用显式字段和 `--param` / `--param-json` 组装请求体；`--param-json` 需要重复传参，不要用逗号分隔 JSON 值：

```bash
# 按关键字搜索 metadata/content 命中的节点
bytedcli oceanus tree-node search --project-id 123 --keyword demo
# 搜索 metadata 范围
bytedcli oceanus tree-node search --project-id 123 --keyword demo --search-scope metadata
# 结合 owner 和 limit 做更精确搜索
bytedcli oceanus tree-node search --project-id 123 --keyword demo --owner sample-user --limit 20
# --limit 必须是正整数
```

### oceanus tree-node get

按 `nodeUid` 读取单个树节点：

```bash
# 按 nodeUid 读取单个树节点
bytedcli oceanus tree-node get --node-id NdemoNode
```

### oceanus node

读取节点草稿内容、真实代码与草稿版本列表，也支持创建/删除节点、创建/删除 region、local/global 转换和更新节点草稿。`node code get` 会自动识别 `coalesce` / `split` 两种模式：`coalesce` 模式优先读取顶层 code，并在传入 `--region` 时按模板参数展开 `@{...}` 占位符；`split` 模式优先读取目标 region 的 `taskConf.code`，必要时回退到 `taskConf.conf.configuration.operator.parameter.code`。`node create` 支持 `name` / `parentUri` / `type` / `content` / `description` / `file` / `metadata` 等字段，并支持用 `--code-mode coalesce|split` 选择统一模板模式或分机房模式；`--region` 支持在创建时初始化目标机房，不传时有代码任务默认创建在 `US-East`，也可以指定单机房或 `US-East,Singapore,US-EastRed,EU-Compliance2,EU-TTP2,US-TTP` 一次建全；传多个 region 时会在创建节点后补建其余 region；如需创建目录，直接传 `--type dir`，通常不需要额外内容字段；`node draft update` 支持常用更新字段和结构化扩展入参：

```bash
# 创建 coalesce 模式 HSQL 节点
bytedcli oceanus node create --project-id 123 --name demo-node --parent-uri task:/// --type hsql --content 'select 1' --code-mode coalesce
# 创建 split 模式 HSQL 节点
bytedcli oceanus node create --project-id 123 --name demo-node-split --parent-uri task:/// --type hsql --content 'select 1' --code-mode split
# 创建单 region 节点（US-East）
bytedcli oceanus node create --project-id 123 --name demo-node-va --parent-uri task:/// --type hsql --content 'select 1' --region US-East
# 一次创建并初始化多个 region
bytedcli oceanus node create --project-id 123 --name demo-node-all --parent-uri task:/// --type hsql --content 'select 1' --region US-East,Singapore,US-EastRed,EU-Compliance2,EU-TTP2,US-TTP
# 创建资源类节点并附带 metadata
bytedcli oceanus node create --project-id 123 --name sample-resource --parent-uri task:/// --type resource --file sample-file --metadata-json '{"owner":"sample-user"}'
# 创建目录节点（不需要 content）
bytedcli oceanus node create --project-id 123 --name sample-dir --parent-uri task:///sample-parent --type dir
# 删除节点（执行前需二次确认）
bytedcli oceanus node delete --node-id NdemoNode
# 给已有 global node 补建 region
bytedcli oceanus node region create --node-id NdemoNode --region US-East,Singapore
# 追加 addRegions 任务项（请求体含 tasks[].taskMaping，默认 create）
bytedcli oceanus node region add --node-id NdemoNode --region US-East
# 与 select / taskId 组合（由 CLI 生成 tasks[]）
bytedcli oceanus node region add --node-id NdemoNode --region US-East --task-mapping select --task-id 109124267
# 顶层 JSON 数组作为请求体（与对象形式二选一，勿与 --region 混用）
bytedcli oceanus node region add --node-id NdemoNode --body-json '[{"region":"US-East","taskMaping":"select","taskId":109124267}]'
# 移除某个 region
bytedcli oceanus node region delete --node-id NdemoNode --region US-East
# 把 local task 转成 global node
bytedcli oceanus node global-node-uid get --local-task-id 101,102 --region US-East
# 把 global node 转回 local task
bytedcli oceanus node local-task-id get --global-node-uid Ngdemo1,Ngdemo2
# 读取当前编辑态 draft，适合看最新草稿和模板配置
bytedcli oceanus node get --node-id NdemoNode
# 读取节点真实代码；coalesce 会按目标 region 展开占位符，split 会直接返回对应 region 的 code
bytedcli oceanus node code get --node-id NdemoNode --region US-East
# 读取 legacy draft 口径，适合排查旧模型/旧编辑器兼容视图
bytedcli oceanus node get --node-id NdemoNode --legacy
# 分页列出 draft 版本
bytedcli oceanus node draft list --node-id NdemoNode --page 1 --page-size 20
# 直接更新节点代码草稿
bytedcli oceanus node draft update --node-id NdemoNode --content 'select 2'
# 从本地文件更新代码，并附带 metadata
bytedcli oceanus node draft update --node-id NdemoNode --content-file ./sample.sql --metadata-json '{"owner":"sample-user"}'
# 单 region 草稿调试；conf 里的 code 为实际要跑的 SQL
bytedcli oceanus node draft test --node-id NdemoNode --task-id 1001 --project-id 123 --body-json '[{"type":"hsql","scheduleDateTimes":["2026-05-09 00:00:00"],"cluster":"demo-cluster","queue":"root.demo_queue","dc":"demo-dc","region":"sg","hubRegion":"Singapore","taskId":"NdemoNode","conf":"{\"configuration\":{\"operator\":{\"parameter\":{\"code\":\"select 1 from sample_db.sample_table\",\"engineType\":\"spark\"},\"type\":\"hsql\"}},\"type\":\"hsql\"}"}]'
# 按 region 校验当前节点草稿 SQL
bytedcli oceanus node draft explain --node-id NdemoNode --region Singapore
# 提交（发布）节点到各 region；也可传 --project-id / --type / --region-configs-json 组合字段
bytedcli oceanus node commit --node-id NdemoNode --project-id 123 --type hsql --region-configs-json '[{"region":"US-East","commitConf":"{}","taskId":"1001","tags":[]}]'
# 用 --body-json 直传完整 commit 请求体（与 Oceanus IDE 提交接口一致）
bytedcli oceanus node commit --node-id NdemoNode --body-json '{"autoRelease":true,"createUser":"sample-user","projectId":123,"regionConfigs":[{"region":"US-East","commitConf":"{\"reviewUserNames\":[],\"reviewPolicyId\":1,\"openDefaultSystemAlarm\":true,\"customAlarmRuleIds\":[],\"baselineIds\":[],\"projectId\":124}","taskId":"1001","tags":[]},{"region":"Singapore","review":{"reviewers":[],"reviewPolicyId":-1},"commitConf":"{\"reviewUserNames\":[],\"reviewPolicyId\":-1,\"openDefaultSystemAlarm\":true,\"customAlarmRuleIds\":[10001],\"baselineIds\":[],\"projectId\":125}","taskId":"1002","tags":[]}],"baselineSetting":{},"type":"hsql","skipCodes":""}'
# 保存指定 region 的调度信息（saveDispatch）；成功时 data.result 常为含 region 与 taskId 的 JSON 字符串
bytedcli oceanus node save-dispatch --node-id NdemoNode --region US-East
bytedcli oceanus node save-dispatch --node-id NdemoNode --body-json '{"region":"US-East"}'
# 查看各 region local task 的健康度和同步状态（commit/runnable/update）
bytedcli oceanus node local-refine-status list --node-id NdemoNode
# 查看各 region 命中的 review policy
bytedcli oceanus node review-match list --node-id NdemoNode
# 查看线上 remote 视图，适合对比草稿与线上最终远端形态，不等同于当前 draft
bytedcli oceanus node online-remote get --node-id NdemoNode
```

`node draft test` 对 Oceanus 全局节点发起多 region 草稿调试，对应 `PUT /datalab/task/{nodeId}/draft/test?taskId=...&projectId=...`；`--node-id` 是路径里的 global node UID，`--task-id` 是 query 里的 regional task ID。`--body-json` 传 JSON 数组，每个元素通常包含 `type`、`scheduleDateTimes`、`cluster`、`queue`、`dc`、`region`、`hubRegion`、`taskId` 和 `conf`；其中 `conf` 是 JSON 字符串，调试 SQL 写在 `configuration.operator.parameter.code`。

`node draft explain` 对 Oceanus 全局节点草稿发起 explain 校验，对应 `POST /datalab/v1/ide/nodes/{nodeId}/explain`；默认请求体为 `{"command":"code","region":"...","tableCommitIds":[],"prodEnv":false}`，也可用 `--body-json` 直传完整请求体。

### oceanus task

读取 legacy task 查询。`task search` / `task bind-node get` 提供常用查询 option 和结构化 JSON 入参；`task dependency-recommendation get` 基于指定 region 的真实 SQL，最少提供 `--node-id`、`--project-id`、`--region` 即可：若未显式传 `--task-id`，CLI 会先从 `node local-refine-status list` 推断目标机房 taskId；SQL 优先级为 `--sql-file` > `--sql` > `bodyJson.sql` > 单条 `bodyJson.queryList` > 自动复用 `node code get` 的真实取码逻辑；依赖推荐会拒绝空 SQL，并在存在 `@{...}` 模板占位符时优先用目标 region 的 template 值展开后直接请求 task recommendations。`bodyJson.queryList` 支持单条 SQL；脚本场景优先使用 `bodyJson.sql`；`task dependency-recommendation apply` 会在同一条真实推荐链路之后，把推荐出的上游依赖写回 Oceanus 全局节点草稿，默认合并已有依赖，传 `--replace-existing` 时覆盖当前 region 的显式上游依赖：

```bash
# 按 region/keyword/taskTypes 搜索 legacy task
bytedcli oceanus task search --project-id 123 --region US-East --keyword demo --task-types hive,hsql
# 反查某个 legacy task 绑定的 global node
bytedcli oceanus task bind-node get --region US-East --task-id 456
# 提供 node/project/region，让 CLI 自动推断 taskId 和当前 draft SQL
bytedcli oceanus task dependency-recommendation get --node-id NdemoNode --project-id 123 --region US-East
# 基于显式 node/task/project/region/SQL 获取依赖推荐
bytedcli oceanus task dependency-recommendation get --node-id NdemoNode --task-id 456 --project-id 123 --region US-East --sql 'select * from sample_db.sample_table'
# 用 body-json 直传完整推荐请求
bytedcli oceanus task dependency-recommendation get --body-json '{"nodeId":"NdemoNode","taskId":456,"projectId":123,"region":"US-East","sql":"select * from sample_db.sample_table"}'
# 提供 node/project/region，让 CLI 自动推断 taskId 和当前 draft SQL 后写回依赖
bytedcli oceanus task dependency-recommendation apply --node-id NdemoNode --project-id 123 --region US-East
# 将推荐出的依赖回写到 Oceanus 草稿
bytedcli oceanus task dependency-recommendation apply --node-id NdemoNode --task-id 456 --project-id 123 --region US-East --sql 'select * from sample_db.sample_table'
# 用 body-json 直传依赖应用请求，并支持 replaceExisting
bytedcli oceanus task dependency-recommendation apply --body-json '{"nodeId":"NdemoNode","taskId":456,"projectId":123,"region":"US-East","sql":"select * from sample_db.sample_table","replaceExisting":true}'
```

## Notes

- Oceanus 站点固定为 `i18n-tt`：业务命令不跟随全局 `cloudSite` 漂移，`--site` 不影响 Oceanus 业务请求；认证命令仍使用 `BYTEDCLI_CLOUD_SITE=i18n-tt` 登录。
- Oceanus `node code get` 应自动识别 `codeMode`：`coalesce` 模式优先读取顶层 draft code，并在传入 `--region` 时按模板参数展开 `@{...}`；`split` 模式优先读取目标 region 的 `taskConf.code`，必要时再回退到 `taskConf.conf.configuration.operator.parameter.code`。
- 文本模式下，`project param list`、`task search`、`task bind-node get`、`node online-remote get`、`node draft update`、`node region create`、`node region add`、`node region delete`、global-local 转换等命令使用结构化 presenter 输出；脚本场景优先使用 `-j/--json`。
- 使用 Oceanus 命令时，凡是删除类操作（例如 `node delete`，以及其他明确会删除资源的写接口），Agent 在实际执行前必须向用户做二次确认；未获得明确确认前，不得直接执行。
- 使用 Oceanus 命令时，凡是会修改远端状态的操作（例如 create/update/delete、`node region create` / `node region add` / `node region delete`、global-local 转换 等），Agent 在执行后必须保留操作记录，并在回复里向用户汇报：执行的命令/接口、目标对象标识、关键入参、执行结果，以及新产生或变更的资源标识。
