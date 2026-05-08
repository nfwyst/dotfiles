---
name: bytedance-dorado
description: "Operate Dorado (DataLeap) via bytedcli: list projects/tasks/instances, get task details, create tasks, update SQL, diff versions, view history, execute adhoc Hive SQL, manage task drafts (update/test/explain), validate HSQL/DTS drafts, manage python/notebook nodes, fetch notebook run result JSON, resolve nodeUid from taskId, browse folders, manage backfills, query DECC endpoints/datas, list project UDFs, update resources, and diagnose failures with Megatron/Spark History/logs. Use when users mention Dorado, DataLeap, batch tasks, HSQL/DTS drafts, notebook results, resource/explain, taskId URLs, instance failures, slow runs, backfill, spark-jar config, or DECC."

---

# bytedcli Dorado

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

- Dorado/DataLeap 批处理任务管理
- Dorado 实例失败根因定位（Megatron diagnostics / Spark History / 实例日志）
- Dorado/TQS/Hive 权限失败定位（`NoPrivilegeException`）以及转 Coral 权限申请
- Dorado 慢任务性能分析（Stages/SQL、shuffle/spill/skew、小文件、资源等待）
- 查看项目、任务、实例列表
- 获取任务详情（包括源/目标数据库信息、SQL 代码、依赖任务 ID）
- 检查补数据 (Backfill) 进展和触发器详情 (`dorado backfill triggers`) 
- 下载 Dorado 实例日志（页面态 cookie，`dorado download-instance-log`）
- 获取 notebook 实例“运行结果”JSON（`dorado instance notebook-result`，默认读取 `{taskId}_{instanceId}.ipynb`）
- 创建任务（指定 `--type`）
- 更新 SQL 任务（hsql/fsql/stream_sql）的查询（`task update --query`/`--type`）
- MySQL->Hive binlog 状态检查与接入（`task binlog status` / `task binlog connect`）
- 通过 ad-hoc query API 执行临时查询（Hive SQL）
- 对比 SQL 版本差异（草稿 vs 发布版本、任意两个版本）
- 查看任务版本历史
- 浏览项目文件夹结构、查看文件夹下的任务和子文件夹
- 创建子目录（`folder create --parent-uri --name`）
- 查看项目可用的 Yarn 队列（支持按 `--task-type` 过滤）
- 更新任务草稿配置（队列、集群、调度时间等）
- 测试运行任务草稿（debug run）
- 校验 HSQL 任务草稿 / 线上版本语法（`task-draft explain`）
- 校验 DTS 任务 reader SQL 语法（`dts-draft explain`）
- 根据任务 SQL 获取依赖推荐（推荐可依赖的上游任务）
- 创建 python/notebook/spark(pyspark) 任务节点，支持创建时指定 Docker 镜像（`node create --type python/notebook/spark --image-name/--image-id`）
- 获取 python/notebook/spark 节点草稿内容（`node get`）
- 保存 python/notebook/spark 节点草稿（`node save`）
- 提交 python/notebook/spark 节点上线（`node submit` / `node submit-approval`）
- 查看节点生产版本历史（`node history`）
- 恢复草稿到指定生产版本（`node rollback --commit-id`）
- 快捷恢复到最新生产版本（`node rollback --latest`）
- 管理 Spark-jar 任务的 Operator 配置（`spark-jar create/get/update`，例如读取/更新 `mainClass`、`params`、`sparkConf`）
- 在仅有 taskId、缺少 nodeUid 时解析 IDE nodeUid（`node resolve-uid`，通过 tree-nodes 的 name+type filter 单路径下钻 + node-relations 校验）
- 查询项目可用镜像列表（`image list`），返回镜像 id + name，用于配置 node 的运行镜像
- **注意**：`node` 子命令仅适用于 python 和 notebook 类型任务；SQL 类任务（hsql/fsql/stream_sql 等）请使用 `task-draft` 相关命令；Spark jar 任务的 Operator 配置（如 `mainClass`、`sparkConf`）推荐使用 `dorado spark-jar` 子命令更新草稿
- 查询 DECC endpoint ID 和注册的 table data ID（`decc endpoints` / `decc datas`）
- 列出项目 UDF（用户自定义函数），包括 Hive 函数和目录（`tree-nodes udf list`）
- 获取 UDF 详情，包括 HDFS 路径、绑定名称和版本（`tree-nodes udf get`）
- 通过 UDF nodeUid 或资源 nodeUid 获取 ID，该 ID 可用于创建函数、更新资源等操作（`tree-nodes id get`）
- 列出所有项目资源，包括文件、jar 包、zip、scm、image、thrift 和目录（`tree-nodes resource list`）
- 更新资源详情，包括 scmVersion（`tree-nodes resource update`）
- 创建并保存新的函数（`tree-nodes function create`）
- 当目标机房不在内置 region 列表里时，可先通过 `.dorado.env` 配置自定义 region，再继续调用 Dorado 命令
- 内置 region 里 `mycis` 和 `gp-us` 固定走页面态 session；其余 built-in region 默认走 JWT。自定义 region 可通过 `.dorado.env` 中的 `DORADO_REGION_<NAME>_AUTH=session` 显式声明页面态授权。未显式声明时，先按正常请求处理，只有命中明确的页面态鉴权迹象时，再执行 `bytedcli auth login --session`
- 对 Dorado / DataLeap 的 `MY-BD` 环境，请特别使用 `bytedcli --site i18n-bd auth login --session`（或 `BYTEDCLI_CLOUD_SITE=i18n-bd bytedcli auth login --session`）先准备浏览器态 session；该环境的页面能力依赖 session/cookie，单独做普通 `auth login` 往往不够。
## Agent Guidance

- Dorado web URL 常见格式：
  - 任务开发页：`<host>/dorado/development/node/<taskId>?groupName=<region>&project=<region>_<projectId>`
  - 临时查询页：`<host>/dorado/development/query/<taskId>?groupName=<region>&project=<region>_<projectId>`
  - 从这两类 URL 中解析 CLI 参数时，路径里的 `<taskId>` 对应 task ID，`groupName` 对应 `--region`，`project` 去掉 `<region>_` 前缀后对应 `--project-id`
- 当用户已经明确给出一个不在内置列表里的 Dorado region 名称时，不要遍历或试探 `cn/sg/va/mycis/gcp/boe/boei18n`
- 先检查是否已存在对应的 `.dorado.env` 配置；若不存在，优先引导用户配置 `DORADO_REGION_<NAME>_API_BASE_URL`
- 若该机房已知依赖页面态 cookie，再补充 `DORADO_REGION_<NAME>_AUTH=session`
- 只有用户没有提供 region 名称时，才允许在内置 region 中选择或追问
- Dorado 审批提交类命令（如 `dorado task commit-approval`、`dorado node submit-approval`）中的 `--review-policy-id`、`--review-users` 必须由用户按当前项目显式提供；不要从项目默认配置、历史记录或页面上下文自动推断后代填
- 对于页面提交类写操作，如果页面 payload 对字段顺序、字段缺省或附加字段敏感，优先使用与页面一致的专用命令和参数语义，不要复用“相近但不完全一致”的旧命令再额外拼接页面未发送字段
- 排查 Dorado 权限失败时，先确认用户给的是 task ID 还是 instance ID；通过 `task get`、`instance record/list` 定位失败 instance，再下载实例日志解析 `NoPrivilegeException`。后续使用 Coral 权限申请流程，详见 `references/dorado.md` 的 “Debug permission failures and apply via Coral” 以及 `bytedance-coral` skill。
- 不要用 `bytedcli hive` 或 `bytedcli iam` 处理 Dorado 任务执行时的 Hive/TQS 权限缺失；`hive` 只适合查元数据，`iam` 只适合查员工身份。权限申请应走 `bytedcli coral permission apply`。

## 故障诊断与性能分析

优先路径：

```bash
# 1) 先拿 Spark History / Megatron diagnostics（instanceId 或 applicationId 任一）
bytedcli --json dorado get-spark-history --instance-id <instanceId> --region <region>
bytedcli --json dorado get-spark-history --application-id <applicationId> --region <region>
```

当 `get-spark-history` 返回 `MEGATRON_APP_ID_NOT_FOUND`（通常表示没有产生 YARN application）时，优先下载实例日志定位 SQL 编译/权限/参数问题：

```bash
bytedcli auth login --session
bytedcli dorado download-instance-log --instance-id <instanceId> --project-id <projectId> --region <region> -o temp/instance_<instanceId>.log
grep -nE 'NoPrivilegeException|permission|privilege|CalciteContextException|SemanticException|ParseException|AnalysisException|Number of INSERT target columns|TQS 查询失败|FAILED|ERROR' temp/instance_<instanceId>.log | head -n 200
```

更完整的失败诊断与慢任务性能分析方法见：`references/troubleshooting.md`



- 使用通用调用方式：`references/invocation.md`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

Commands are grouped under `dorado project`, `dorado task`, `dorado folder`, `dorado instance`, `dorado adhoc`, `dorado backfill`, `dorado spark-jar`, and `dorado decc`. Old flat names (e.g. `dorado list-projects`, `dorado get-task`, `dorado adhoc-exec`, `dorado folder-structure`, `dorado folder-children`, `dorado task diff-query`, `dorado task list-versions`, `dorado task update-query`) still work as hidden aliases.

```bash
# 创建 Spark-jar 配置（写入到 node draft）
# 说明：--spark-conf 为 k=v，可重复；--jars/--files/--py-files/--archives 接受 JSON 数组字符串
bytedcli dorado spark-jar create --node-id demo-node-id \
  --main-class com.example.Main \
  --main-file-path /path/to/app.jar \
  --main-resource-id 100001234 \
  --spark-conf spark.executor.memory=2g \
  --spark-conf spark.sql.shuffle.partitions=200

# 读取单个字段（示例输出：com.example.Main）
bytedcli dorado spark-jar get --node-id demo-node-id --field mainClass

# 更新 sparkConf（k=v，可重复；handler 会做 merge，不会清空未提及的 key）
bytedcli dorado spark-jar update --node-id demo-node-id \
  --spark-conf spark.sql.adaptive.maxNumPostShufflePartitions=6000 \
  --spark-conf spark.executor.cores=4
```

```bash
# 项目列表
bytedcli dorado project list --region boei18n --page 1 --size 20

# 任务列表
bytedcli dorado task list --region boei18n --project-id 458 --page 1 --size 20

# 搜索任务（通过名称、状态等基本信息过滤）
bytedcli dorado task search --region boei18n --project-id 458 --folder-id 123456 --status "init" --keyword "test_task"

# 高级搜索（支持同时搜索任务基本信息和代码内容，并支持按负责人或返回行数过滤）
bytedcli dorado task advanced-search --region boei18n --project-id 458 --keyword "SELECT * FROM" --search-scope "metadata,content" --owner username --limit 10

# 获取任务详情（包括源/目标信息、SQL 代码、依赖任务 ID）
bytedcli dorado task get 100274211 --region boei18n

# 创建任务
bytedcli dorado task create --type hsql --project-id 458 --name "demo_task" --region boei18n

# 创建 DTS 批处理任务（common-dts-batch）
bytedcli dorado task create --type common-dts-batch --project-id 300002016 --folder-id 300370052 --name "demo_dts_task" --region sg

# 更新 SQL 任务（hsql/fsql/stream_sql）的查询
bytedcli dorado task update 100274211 --query "SELECT * FROM table" --region boei18n
bytedcli dorado task update 100274211 --type hsql --region boei18n

# 更新 MySQL 到 Hive 任务配置（支持设置 split keys）
bytedcli dorado task update 123456 --type mysql-hive --split-keys id,name --region boei18n
bytedcli dorado task update 123456 --type mysql-hive --source-db source_db --source-table source_table --target-db target_db --target-table target_table --split-keys id,name --region boei18n

# MySQL 到 Hive Binlog 任务
bytedcli dorado task binlog status --task-id 67890 --dorado-region-name demo-region --region cn
bytedcli dorado task binlog status --src-database demo-db --src-storage-region demo-region --subscribe-type incremental --task-type mysql->hive --dorado-region-name demo-region --region cn
bytedcli dorado task binlog connect --tree-node-id 123456 --task-id 67890 --dorado-region-name demo-region --region cn
bytedcli dorado task binlog connect --tree-node-id 123456 --src-database demo-db --src-storage-region demo-region --owner demo-owner --task-type mysql->hive --dorado-region-name demo-region --region cn --wait

# 对比 SQL 版本差异（默认：最新发布版本 vs 草稿）
bytedcli dorado task diff 100274211 --region boei18n
bytedcli dorado task diff 100274211 --from 5 --to 6 --region boei18n  # 版本 5 vs 版本 6
bytedcli dorado task diff 100274211 --from 5 --region boei18n          # 版本 5 vs 草稿

# 检查任务是否在线
bytedcli dorado task check-online 100274211 --project-id 458 --region boei18n

# 重跑任务（默认仅回溯，不部署）
bytedcli dorado task rerun 100274211 --project-id 458 --biz-date 2026-03-12 --region boei18n

# 切换队列重跑任务（默认仅回溯，不部署）
bytedcli dorado task rerun 100274211 --project-id 458 --biz-date 2026-03-12 --region boei18n --clusters "cluster1,cluster2" --queues "queue1,queue2"

# 区间回溯
bytedcli dorado task rerun <task-id> --project-id <project-id> --start-biz-date 2026-03-01 --end-biz-date 2026-03-31 --region sg

# 指定回溯范围类型（single_task_rerun / single_task_backfill / multi_task_rerun / multi_task_backfill / link_backfill）
bytedcli dorado task rerun <task-id> --project-id <project-id> --biz-date 2026-03-31 --scope single_task_backfill --region sg

# 重跑并提交部署（需显式加 --deploy）
bytedcli dorado task rerun 100274211 --project-id 458 --biz-date 2026-03-12 --deploy --message "rerun reason" --region boei18n

# 传入自定义输入参数（覆盖任务默认参数）
# --input-params 接受 JSON 数组，每个元素包含 name/paramValue/type 字段
# 注意：包含特殊字符（如单引号）的参数值，推荐通过环境变量传入，避免 shell 转义问题
DEMO_PARAM="{ 'key': 'demo-value' }"
INPUT_PARAMS=$(DEMO_PARAM="$DEMO_PARAM" node -e "
const params = [
  {name:'demo_param_a', paramValue:'demo-value-a', type:'task_custom'},
  {name:'demo_param_b', paramValue:'demo-value-b', type:'task_custom'},
  {name:'demo_param_c', paramValue:process.env.DEMO_PARAM, type:'task_custom'},
];
process.stdout.write(JSON.stringify(params));
")
bytedcli --json dorado task rerun <task-id> --project-id <project-id> --biz-date 2026-03-31 \
  --input-params "$INPUT_PARAMS" --region sg

# 指定具体实例（trigger-nodes）和时间区间参数
bytedcli dorado task rerun <task-id> --project-id <project-id> --region sg \
  --interval-start-time "2026-03-30 15:00:00" --interval-end-time "2026-03-30 16:00:00" \
  --trigger-nodes '[{"taskId":<task-id>,"projectId":<project-id>,"taskTime":"2026-03-30 00:00:00"}]'

# 上线任务（提交草稿并部署上线）
bytedcli dorado task online 100274211 --project-id 458 --region boei18n
bytedcli dorado task online 100274211 --project-id 458 --message "deploy v2" --skip-codes "-1005" --region boei18n

# 提交审批（页面同款 commitAndDeploy payload）
# 对应 payload 字段：reviewPolicyId / reviewUserNames / customAlarmRuleIds / agentConfig / projectId / skipCodes
# review-policy-id / review-users 必须由用户按当前项目显式提供
bytedcli dorado task commit-approval <task-id> --project-id <project-id> \
  --review-policy-id 24 \
  --review-users "demo-user-a,demo-user-b" \
  --custom-alarm-rule-ids 11870,14696 \
  --agent-config '{"sessionId":"demo-session"}' \
  --region mycis

# 批量提交审批（deploy/v2/create，同一个 deploy package 可包含多个 commit）
bytedcli dorado task commit-batch-approval --project-id <project-id> \
  --name demo_pkg_20260507 \
  --message "batch approval" \
  --review-policy-id 24 \
  --review-users "demo-user-a,demo-user-b" \
  --commit-ids "108103,108111,108110" \
  --region mycis

# 仅提交（commit 草稿，不部署上线）
bytedcli dorado task commit <task-id> --project-id <project-id> --region mycis
bytedcli dorado task commit <task-id> --project-id <project-id> \
  --message "commit draft" \
  --review-policy-id 33 \
  --custom-alarm-rule-ids 14032 \
  --agent-config '{"sessionId":"demo-session"}' \
  --region mycis

# 获取实例对应的 Spark History 链接
bytedcli dorado get-spark-history --instance-id 1088059891 --region sg

# 查看版本历史
bytedcli dorado task version list 100274211 --region boei18n

# 实例列表
bytedcli dorado instance list --region boei18n --project-id 458 --task-id 100274211

# 获取实例详情
bytedcli dorado instance get 258345284 --region boei18n

# 创建完整的回溯计划（批量多任务执行）
bytedcli dorado backfill create --project-id <project-id> --task-ids <task-id1,task-id2> --start-date 2026-03-01 --end-date 2026-03-10 --region sg

# 检查回溯状态（进度和实例数量）
bytedcli dorado backfill get --backfill-id 3614569 --region boei18n

# 查看回溯计划内的具体任务触发器详情
bytedcli dorado backfill triggers --region boei18n --backfill-id 3614569
bytedcli dorado backfill triggers --region sg --backfill-id 123456 -j

# 下载实例日志（纯文本，页面态 cookie）
bytedcli auth login --session
bytedcli dorado download-instance-log --instance-id 1102084977 --project-id 150000021 --region sg -o instance_1102084977.log

# 获取队列资源使用情况
bytedcli dorado task get-queue-resource --clusters snake,badge --queues root.snake_eprivacy_eng,root.badge_privacy_eng --region boei18n

# 查看项目可用的 Yarn 队列
bytedcli dorado project yarn-queues --project-id 458 --region boei18n
bytedcli dorado project yarn-queues --project-id 458 --task-type global_hsql --region us-ttp  # 按任务类型过滤
bytedcli dorado project yarn-queues --project-id 300003392 --task-type notebook --region sg --restricted  # 仅看合规队列（仅 i18n / 非 cn region 有此概念）

# 查看项目文件夹结构
bytedcli dorado folder structure --project-id 458 --region boei18n
bytedcli dorado folder structure --project-id 458 --root-id -2 --region boei18n  # 查看临时查询目录

# 查看文件夹下的子项（子文件夹和任务）
bytedcli dorado folder children --folder-id 268736 --project-id 458 --region boei18n

# 创建子目录
bytedcli dorado folder create --project-id 12345 --parent-uri "task:///HrdNGPWr" --name "demo-folder" --region cn
bytedcli dorado folder create --project-id 12345 --parent-uri "task:///HrdNGPWr" --name "demo-folder" --description "a demo subfolder" --region sg

# 更新任务草稿配置
bytedcli dorado task-draft update 100274211 --queue root.pns_data_infra_core --cluster model01 --region boei18n
bytedcli dorado task-draft update 100274211 --sql "SELECT * FROM table" --region boei18n  # 更新 SQL 代码
bytedcli dorado task-draft update 1204210031 --frequency hourly --schedule-time 5 --schedule-day 16 --region mycis  # 小时调度，直接传页面调度值
bytedcli dorado task-draft update 100274211 --dependencies "100274200:0:set,100274201:0:set" --region boei18n  # 更新同机房任务依赖
bytedcli dorado task-draft update 100274211 --outer-dependencies "306220763@sg" --region va  # 更新跨机房依赖（va 任务依赖 sg 任务）
bytedcli dorado task-draft update 100274211 --outer-dependencies "100@sg:0:set,200@va:1:set" --region cn  # 多个跨机房依赖

# 更新跨区域查询配置（queryType + sourceRegionInfos）
bytedcli dorado task-draft update 306215786 -r sg --sql "select 1" --query-type FLEXIBLE_UNION \
  --source-region-infos '[{"geo":"SG","yarnQueue":{"region":"sg","dc":"my","clusterName":"badge","queue":"root.badge_example"}},{"geo":"EU_TTP","deccDataId":"7491149792614072631","deccEndpointId":"7252920295022035206","yarnQueue":{"region":"i18n_gcp","dc":"useast2a","clusterName":"coati","queue":"root.coati_example"},"owner":"demo.user"}]'

# 更新 DTS 任务配置（common-dts-batch 类型）
# sourceType=sql: 通过 SQL 查询读取数据
bytedcli dorado task-draft update <task-id> -r sg \
  --dts-read-type hive --dts-read-idc sg --dts-read-source-type sql \
  --dts-read-query "select col1, col2 from example_db.example_table where date = '\${date}'" \
  --dts-read-connector-type hive \
  --dts-read-columns '[{"type":"string","name":"col1"},{"type":"bigint","name":"col2"}]' \
  --dts-writer-type clickhouse --dts-writer-idc sg \
  --dts-writer-cluster cnch_example_cluster \
  --dts-writer-database-name example_db --dts-writer-table-name example_table \
  --dts-writer-partitions '[{"name":"date","type":"TIME","value":"${date}"}]' \
  --dts-writer-shard-column col1 --dts-writer-shard-num 1200 --dts-writer-append-mode 2 \
  --dts-writer-columns '[{"type":"string","name":"col1"},{"type":"int64","name":"col2"}]' \
  --dts-writer-connector-type clickhouse

# sourceType=table: 通过指定库表名读取数据
bytedcli dorado task-draft update <task-id> -r sg \
  --dts-read-type hive --dts-read-idc sg --dts-read-source-type table \
  --dts-read-database-name example_db --dts-read-table-name example_table \
  --dts-read-connector-type hive \
  --dts-read-columns '[{"type":"string","name":"col1","description":"desc1"}]' \
  --dts-read-partitions '[{"name":"date","type":"string","value":"${date}"}]' \
  --dts-writer-type clickhouse --dts-writer-idc sg \
  --dts-writer-cluster cnch_example_cluster \
  --dts-writer-database-name example_target_db --dts-writer-table-name example_target_table \
  --dts-writer-partitions '[{"name":"date","type":"TIME","value":"${date}"}]' \
  --dts-writer-shard-column col1 --dts-writer-shard-num 1200 --dts-writer-append-mode 2 \
  --dts-writer-columns '[{"type":"string","name":"col1"},{"type":"int64","name":"col2"}]' \
  --dts-writer-connector-type clickhouse

# 局部更新（只修改部分字段，其余保留原值）
bytedcli dorado task-draft update <task-id> -r sg --dts-writer-append-mode 3
bytedcli dorado task-draft update <task-id> -r sg --dts-read-query "select col1 from example_db.example_table"

# 测试运行任务草稿（debug run）
bytedcli dorado task-draft test 100274211 --project-id 458 --region boei18n

# 校验 HSQL 任务草稿语法（Dorado resource/explain）
bytedcli dorado task-draft explain 100274211 --project-id 458 --region boei18n
bytedcli dorado task-draft explain 100274211 --project-id 458 --date 2025-04-20 --region mycis
bytedcli dorado task-draft explain 100274211 --project-id 458 --template-var hrbi_corehr_global=hrbi_corehr_global --region mycis
bytedcli dorado task-draft explain 100274211 --project-id 458 --online --region mycis
bytedcli dorado task-draft explain 100274211 --project-id 458 --version 6 --region mycis

# 校验 DTS 草稿 reader SQL 语法（resource/explain）
bytedcli dorado dts-draft explain 1204196358 --project-id 1200002135 --region mycis --date 2025-04-20
bytedcli dorado dts-draft explain 1204196358 --project-id 1200002135 --template-var hrbi_atsx_global=hrbi_atsx_global --region mycis
bytedcli dorado dts-draft explain 1204196358 --project-id 1200002135 --online --region mycis

# 获取依赖推荐（根据任务 SQL 推荐可依赖的上游任务）
bytedcli dorado task dep-recommendations 100274211 --region boei18n

# 获取目录树子节点（返回 UID-based uri，用于 node create 的 --parent-uri）
bytedcli dorado tree-nodes children --project-id {project-id} --region boei18n          # 查询根目录
bytedcli dorado tree-nodes children --project-id {project-id} --uri "task:///f{numericId}" --region boei18n   # 查询指定 uri 的子节点
bytedcli dorado tree-nodes children --project-id {project-id} --uris "task:///,task:///f{numericId}" --region boei18n  # 批量查询
# 返回每个子节点的 uid/name/type/uri/isLeaf；dir 类型子节点的 uri 即可作为创建任务时的 --parent-uri

# 列出项目 UDF（用户自定义函数），包括 Hive 函数和目录
bytedcli dorado tree-nodes udf list --project-id {project-id} --region {region}

# 列出所有项目资源（file, jar, zip, scm, image, thrift, dir），递归遍历目录
bytedcli dorado tree-nodes resource list --project-id {project-id} --region {region}

# 获取 UDF 详情，包括 HDFS 路径、绑定名称和版本
bytedcli dorado tree-nodes udf get --project-id {project-id} --bind-id {bind-id} --region {region}

# 通过 UDF nodeUid 或资源 nodeUid 获取资源 ID（bindId），该 ID 可用于创建函数、更新资源等操作
bytedcli dorado tree-nodes id get --node-ids {node-id-1},{node-id-2} --region {region}

# 更新资源详情，包括 scmVersion
# 注意：
# 1. 正确的参数名是 --owner-user-name（不是 --owner-ownerUserName）
# 2. --de-compression 需要明确传入布尔值：true 或 false
# 3. jar 资源的 --sub-type 应为 jar（不是 scm）
bytedcli dorado tree-nodes resource update --project-id {project-id} --resource-id {resource-id} --name {name} --description {description} --owner-user-name {owner-user-name} --sub-type {sub-type} --type {type} --engine-id {engine-id} --hdfs-path {hdfs-path} --download-url {download-url} --file-name {file-name} --hash {hash} --source-type {source-type} --scm-id {scm-id} --scm-name {scm-name} --scm-version {scm-version} --scm-source-file-path {scm-source-file-path} --de-compression {de-compression} --region {region}

# 创建函数
bytedcli dorado tree-nodes function create --project-id {project-id} --name {name} --description {description} --type {type} --sub-type {sub-type} --engine-id {engine-id} --folder-id {folder-id} --bind-resource-id {bind-resource-id} --udf-type {udf-type} --class-name {class-name} --region {region}

# 查询项目可用镜像（返回 id + name，用于 node create/save 的镜像配置）
bytedcli dorado image list --project-id {project-id} --region cn
bytedcli dorado image list --project-id {project-id} --region cn -k demo_image   # 按名称关键词过滤

# 仅有 taskId、解析 IDE nodeUid（tree-nodes name+type filter 单路径下钻）
bytedcli dorado node resolve-uid --project-id {project-id} --task-id 100274211 --region boei18n -j

# Python/Notebook/Spark 任务节点（非 SQL 类任务；SQL 任务请用 task-draft）
# 创建节点（返回 nodeId，后续操作均通过 nodeId 进行）
bytedcli dorado node create --project-id {project-id} --name demo-python-task --type python --region cn
bytedcli dorado node create --project-id {project-id} --name demo-notebook --type notebook --region cn
bytedcli dorado node create --project-id {project-id} --name demo-spark-task --type spark --region cn

# 创建时指定 Docker 镜像（先用 image list 查询可用镜像的 id 和 name）
bytedcli dorado node create --project-id {project-id} --name demo-python-task --type python --image-name demo-image --image-id 400012345 --region cn
bytedcli dorado node create --project-id {project-id} --name demo-notebook --type notebook --image-name demo-image --image-id 400012345 --region cn
bytedcli dorado node create --project-id {project-id} --name demo-spark-task --type spark --image-name demo-image --image-id 400012345 --region cn

# Spark (PySpark) 任务可额外指定语言和 Spark 版本（默认 language=python, spark-version=3.2）
bytedcli dorado node create --project-id {project-id} --name demo-pyspark --type spark --language python --spark-version 3.2 --image-name demo-image --image-id 400012345 --region cn

# 在子目录下创建
bytedcli dorado node create --project-id {project-id} --name demo-notebook --type notebook --parent-uri "task:///f{numericId}" --description "示例notebook" --region cn
# 创建时直接传入代码（inline）
bytedcli dorado node create --project-id {project-id} --name demo-python-task --type python --content "print('hello')" --region cn
# 创建时从文件读取代码
bytedcli dorado node create --project-id {project-id} --name demo-python-task --type python --content-file ./my_script.py --region cn

# 获取节点草稿内容
bytedcli dorado node get --node-id NxyzABC --region boei18n

# 提取完整 notebook JSON（可直接保存为 .ipynb 文件）
bytedcli dorado node get --node-id NxyzABC --region boei18n --notebook-only > my_notebook.ipynb

# 获取当前草稿（用于查看现有配置，包括 dataOutputs 等，再按需修改后回写）
bytedcli dorado node get --node-id NxyzABC --region boei18n --json

# 保存节点草稿（更新代码）
bytedcli dorado node save --node-id NxyzABC --content "print('hello')" --region boei18n
bytedcli dorado node save --node-id NxyzABC --content-file ./my_script.py --region boei18n

# 保存草稿同时登记任务产出（通过 metadata 中的 dataOutputs 字段）
# 登记 HDFS 产出
bytedcli dorado node save --node-id NxyzABC \
  --metadata '{"configuration":{"dataOutputs":[{"type":"hdfs","path":"/example/output/path"}]},"name":"demo-task","type":"python"}' \
  --region boei18n

# 登记 Hive 分区表产出
bytedcli dorado node save --node-id NxyzABC \
  --metadata '{"configuration":{"dataOutputs":[{"type":"partition","databaseName":"example_db","tableName":"example_table","partitions":[{"key":"date","value":"${date}"}],"namespace":"default"}]},"name":"demo-task","type":"python"}' \
  --region boei18n

# 登记其他类型产出
bytedcli dorado node save --node-id NxyzABC \
  --metadata '{"configuration":{"dataOutputs":[{"type":"other"}]},"name":"demo-task","type":"python"}' \
  --region boei18n

# 同时更新代码和产出登记
bytedcli dorado node save --node-id NxyzABC --content-file ./my_script.py \
  --metadata '{"configuration":{"dataOutputs":[{"type":"partition","databaseName":"example_db","tableName":"example_table","partitions":[{"key":"date","value":"${date}"}],"namespace":"default"}]},"name":"demo-task","type":"python"}' \
  --region boei18n

# notebook 草稿保存（含产出登记）
bytedcli dorado node save --node-id NxyzABC --content-file ./notebook.ipynb \
  --metadata '{"configuration":{"dataOutputs":[{"type":"hdfs","path":"/example/output/path"}]},"name":"demo-notebook","type":"notebook"}' \
  --region boei18n

# 更新任务镜像（支持 python/notebook/spark 三种类型，自动检测任务类型）
bytedcli dorado node save --node-id NxyzABC --image-name demo-image --image-id 400012345 --region cn
# spark 任务可额外指定语言和 Spark 版本
bytedcli dorado node save --node-id NxyzABC --image-name demo-image --image-id 400012345 --language python --spark-version 3.2 --region cn

# 查询 nodeId → taskId 映射（需要用 task 相关 API 时使用，如 get-task、list-instances 等）
bytedcli dorado node relation --node-id NxyzABC --region boei18n
# 批量查询（逗号分隔）
bytedcli dorado node relation --node-id NxyzABC,NxyzDEF --region boei18n

# 提交节点上线
# 普通提交上线（不带审批字段）
bytedcli dorado node submit --node-id NxyzABC --project-id {project-id} --region boei18n
bytedcli dorado node submit --node-id NxyzABC --project-id {project-id} --message "deploy via bytedcli" --region boei18n

# 带审批的提交上线
bytedcli dorado node submit-approval --node-id NxyzABC --project-id {project-id} --message "deploy with approval" \
  --review-policy-id 33 --review-users "demo.user1,demo.user2" --custom-alarm-rule-ids 17587 \
  --agent-config '{"sessionId":"demo-session"}' --region mycis

# 查看节点生产版本历史
bytedcli dorado node history --node-id NxyzABC --region cn
bytedcli dorado node history --node-id NxyzABC --page 1 --size 10 --region cn

# 恢复草稿到指定生产版本
bytedcli dorado node rollback --node-id NxyzABC --commit-id C61P1ztyn0R6dknxP --region cn

# 快捷恢复到最新生产版本
bytedcli dorado node rollback --node-id NxyzABC --latest --region cn

# 临时查询（exec）
# 前置条件：需要先在 Dorado 平台创建一个专用的临时查询任务作为执行载体
#   操作路径：Dorado 项目 > 临时查询 > 新建查询
#   创建后建议在临时查询页面将执行引擎切换为 Spark，再配置 dc/cluster/queue 并点击保存
#   保存后可直接从页面 URL 获取 task-id：`/query/<id>` 中的 `<id>` 就是 task-id，例如 `.../query/123456789?project=cn_123` 中的 `123456789`
#   只需创建一次，后续 exec 会自动继承该任务的 dc/cluster/queue 配置
#   ⚠️ --task-id 必须是临时查询任务；若传入已在线的生产任务，命令会拒绝执行以避免修改生产任务状态（--force 可绕过）
#   支持自动读取 ~/.local/share/bytedcli/data/.dorado.env 与当前目录 ./.dorado.env 中的 DORADO_EXEC_TASK_ID；当前目录配置会覆盖全局配置，适合按项目保存不同 task-id

# 简单 SQL（默认同步等待结果）
bytedcli dorado adhoc exec "SELECT count(*) FROM db.table" --task-id 100274211                     # 等待完成并展示结果
bytedcli dorado adhoc exec "SELECT * FROM db.table LIMIT 10" --task-id 100274211 -o result.csv     # 等待完成并下载 CSV

# 临时查询 — 复杂 SQL（异步提交，稍后查询）
bytedcli dorado adhoc exec "复杂SQL" --task-id 100274211 --no-wait                                 # 异步提交，返回 debugId
bytedcli dorado adhoc status --debug-id 12977673 --task-id 100274211                               # 查询状态
bytedcli dorado adhoc result --debug-id 12977673 --task-id 100274211                               # 展示结果
bytedcli dorado adhoc result --debug-id 12977673 --task-id 100274211 -o result.csv                 # 下载 CSV

# 查看临时查询执行历史
bytedcli dorado adhoc history --task-id 100274211                                                  # 查看临时查询执行历史
bytedcli dorado adhoc history --task-id 100274211 --only-mine                                      # 仅查看自己的执行记录

# 解析 Hive SQL 的输出列 schema
bytedcli dorado task sql-schema --sql "select col1, count(*) as cnt from example_db.example_table group by col1" --region sg

# 拉取 Hive 表列信息
bytedcli dorado task fetch-columns --data-source-type hive --idc sg --database-name example_db --table-name example_table --region sg

# 拉取 ClickHouse 表列信息（需指定 --schema-name 为集群名）
bytedcli dorado task fetch-columns --data-source-type clickhouse --idc sg --schema-name cnch_example_cluster --database-name example_db --table-name example_table --region sg

# DECC (Data Exchange & Cross-region Compute)
# 查询 DECC endpoint ID（按数据库名称搜索）
bytedcli dorado decc endpoints --database demo_db --decc-region US-TTP --target-region Singapore-Central --region sg

# 查询 endpoint 下注册的所有 table 及 data ID
bytedcli dorado decc datas --endpoint-id 7221281395346276614 --decc-region US-EastRed --target-region Singapore-Central --region sg
```

### DECC Region 枚举值

`--decc-region` 和 `--target-region` 支持以下值：`China-North`, `Singapore-Central`, `EU-TTP2`, `US-EastRed`, `EU-Compliance2`, `US-TTP`, `Asia-SouthEastBD`, `Asia_Saas`, `Singapore_Saas`, `Asia_CIS`

## 任务名 -> Task ID（稳定定位）

在部分 Dorado 环境里，`list` 命令的 `--task-name` 可能不会生效或只做弱过滤。若任务数量极多，分页遍历的效率非常低。

**最佳实践**：使用 `advanced-search` 进行精确查找，并通过 `uid` 提取 Task ID。同时，如果是海外/特定站点的项目，请务必指定正确的 `--site`（例如 `i18n-tt`），避免 JWT 鉴权失败。

```bash
BYTEDCLI_CLOUD_SITE=i18n-tt bytedcli dorado task advanced-search --search-scope metadata,content -k <taskName> --region <region> --project-id <projectId> -j
```

在返回的 JSON 结果中：
- 匹配 `name === taskName` 的节点。
- 该节点的 `uid` 通常带有前缀（例如 `"uid": "t303071958"`）。
- 去除前缀 `'t'` 后的纯数字部分（`303071958`）即为准确的 **Task ID**。

## 查找真正依赖某个任务的下游任务

由于 Dorado `relation-nodes` API 不支持直接传 `relation=children` 来查询下游，而且通过 Coral 元数据查询表的血缘往往会返回大量无关的监控、Sensor（如 `HPSensor`）等噪音任务。

**最佳实践**：利用 `advanced-search` 搜索 `metadata`，寻找把目标 `taskId` 作为 `parentTaskId` 依赖的任务。这能精准找出真正将目标任务配为上游的节点。

```bash
bytedcli dorado task advanced-search --project-id <projectId> --keyword "<taskId>" --search-scope metadata --region <region> --json
```

在返回的 JSON 结果中（`data.nodes` 数组），过滤掉 `resource` 为 `t<taskId>` 的自身节点，其余即为目标任务的精准下游依赖。对于 `resource` 不带 `t` 前缀的节点（例如以 `N` 开头），可以用 `bytedcli dorado node relation --node-id <uid>` 解析成真实的 taskId。

## Supported Regions

| Region | Description | API Endpoint | Page Origin |
|--------|-------------|--------------|-------------|
| `cn` | China (default) | data.bytedance.net | — |
| `sg` | Singapore Central | dataleap-sg.tiktok-row.net | — |
| `va` | US East (Virginia) | dataleap-va.tiktok-row.net | — |
| `mycis` | ByteIntl MYCIS | dataleap-mycis.byteintl.net | — |
| `gcp` / `eu` | EU Compliance2 | dataleap.tiktok-eu.net | dataleap-gcp.tiktok-row.net |
| `us-ttp` | US TTP | dataleap-bdee.tiktok-us.net | dataleap-tx.tiktok-row.net |
| `us-eastred` | US EastRed | dataleap.tiktok-eu.net | — |
| `eu-ttp2` | EU TTP2 | dataleap-no1a.tiktok-eu.net | — |
| `boe` | BOE (CN) | data-boe.bytedance.net | — |
| `boei18n` | BOE (International) | data-boe.bytedance.net | — |
| `gp-us` | GP US | dataleap-pipo-us.byteintl.net | — |

Custom regions can be added via `~/.local/share/bytedcli/data/.dorado.env` or `./.dorado.env`, for example:

```env
DORADO_REGION_PIPOUS_API_BASE_URL=https://dataleap-pipous.example.net/dorado_api
DORADO_REGION_PIPOUS_ALIASES=us_pipo,pipo-us,pipo_us,uspipo

# Optional: set PAGE_ORIGIN when the web UI uses a different domain than the API
# DORADO_REGION_PIPOUS_PAGE_ORIGIN=https://dataleap-pipous-page.example.net

# Optional: set REQUEST_VREGION when the API gateway expects a vregion different from the region key
# DORADO_REGION_PIPOUS_REQUEST_VREGION=us-pipo-prod

# Optional: only set this for Dataleap environments that require browser-session cookies
# DORADO_REGION_PIPOUS_AUTH=session
```

If the built-in region list does not cover the target IDC/region, prefer adding a custom region in `.dorado.env` instead of changing code. When `DORADO_REGION_<NAME>_SITE` is omitted, Dorado auth follows the global `--site` / `BYTEDCLI_CLOUD_SITE` setting.

`DORADO_REGION_<NAME>_AUTH` supports `jwt|auto|session`. Built-in regions default to `jwt`, except `mycis` and `gp-us`, which are built in as `session`; custom regions default to `auto`. Use `session` for known special Dataleap environments that require browser-session cookies in addition to JWT. Without `AUTH=session`, keep the normal JWT flow first and only switch to `bytedcli auth login --session` when the target region shows explicit web-auth signals, such as JSON output already including `error.hint` / `error.auth_command`, login redirects, or web-side auth failures.

## Notes

- 需要结构化输出加 `--json`
- `task update --query` 支持 hsql、fsql、stream_sql 和 doris_sql 类型任务
- `task diff` 默认对比最新发布版本与草稿，可用 `--from`/`--to` 指定任意版本
- `instance list` 需要 `--project-id` 参数
- DTS 任务会显示源/目标数据库和表信息
- hsql 任务会显示 SQL 代码
- `task get` 文本输出会附带依赖任务 ID，便于快速查看上游关系
- `folder structure` 默认显示任务开发目录（root-id=-1），可用 `--root-id -2` 查看临时查询目录
- `folder create` 在指定项目下创建子目录，`--parent-uri` 为父目录 URI（如 `task:///HrdNGPWr`），可用 `tree-nodes children` 命令获取，`--name` 为新目录名称，可选 `--description` 添加描述
- `node` 子命令（create/get/save/submit）适用于 python、notebook 和 spark（含 pyspark）三种类型任务；hsql/fsql/stream_sql 等 SQL 类任务请使用 `task-draft update` 更新草稿、`rerun-task` 提交上线
- `node create` 返回 nodeId（字符串）；需要 taskId 时，用 `node relation --node-id <nodeId>` 查询对应关系，再用 taskId 调用 `get-task`、`list-instances` 等命令
- `node relation` 支持批量查询，多个 nodeId 用逗号分隔；响应中 taskId 与 nodeId 按顺序一一对应
- 仅有 taskId、需要 IDE nodeUid 时，用 `node resolve-uid`（通过 tree-nodes 的 name+type filter 单路径下钻 + node-relations 校验）
- `image list` 查询项目可用镜像列表，返回的 `id` + `name` 用于 `node save --metadata` 中 `configuration.conf` 里的 `operator.parameter.image` 字段；切换镜像时必须同时写入 `id` 和 `name`
- `node save` 调用时 **必须同时传入 `--metadata`**；API 要求 metadata 不能缺失。标准做法是先用 `node get --json` 获取当前草稿，取出 `data.metadata` 字段，按需修改后整体回写，避免覆盖现有配置
- `node save --content-file` 支持直接传入 Python 脚本路径或 notebook (.ipynb) 文件路径
- `node submit` 默认启用 autoRelease=true（提交即部署），如需关闭可加 `--no-auto-release`
- `node submit-approval` 默认启用 autoRelease=true（提交即部署），如需关闭可加 `--no-auto-release`
- `task commit-approval` 与 `node submit-approval` 的 `--review-policy-id`、`--review-users` 必须由用户按项目显式提供，不要从项目默认配置或页面上下文自动推断
- `node history` 列出节点的生产版本历史（上线部署后的版本），返回版本号、commitId、创建者、更新时间、提交说明
- `node rollback` 将草稿恢复到指定的生产版本，`--commit-id` 和 `--latest` 二选一
- `node rollback --latest` 等价于先 `node history` 取第一个版本的 commitId，再执行 rollback
- 回滚操作只覆盖草稿，不影响线上；如需线上生效，回滚后需重新 submit
- `node save --metadata` 中的 `configuration.dataOutputs` 用于登记任务产出，支持三种类型：
  - `{"type":"hdfs","path":"<hdfs路径>"}` — 登记 HDFS 产出
  - `{"type":"partition","databaseName":"<库名>","tableName":"<表名>","partitions":[{"key":"date","value":"${date}"}],"namespace":"default"}` — 登记 Hive 分区表产出
  - `{"type":"other"}` — 登记其他类型产出
- 修改产出登记时，建议先用 `node get --json` 获取当前 metadata，在现有配置基础上修改 `dataOutputs` 后整体回写，避免覆盖其他配置字段
- Python 任务提交上线（`node submit`）前，须在 metadata 的 `configuration.conf` 中设置 `operator.parameter.jobType`，默认填 `"cronjob_with_image"`；否则会报"部署类型不能为空"
- `tree-nodes children` 返回的是 IDE 层的 UID-based URI（如 `task:///f{numericId}/{nodeUid}`），与 `folder-structure`/`folder-children` 返回的老式数字 ID 不同；创建 `node create` 时的 `--parent-uri` 必须使用 `tree-nodes children` 返回的 URI，不能用 `task:///f{numericId}` 格式
- `task create --type common-dts-batch` 创建 DTS 批处理任务，创建后可用 `task-draft update` 配置 reader/writer
- `task-draft update` 支持更新队列、集群、调度时间、SQL 代码、任务依赖、跨区域查询配置、DTS 读写配置等
- `task-draft update` 支持小时调度字段；日调度可继续传 `--schedule-time 00:00`，小时调度请按页面原始值传 `--schedule-time <minute>` 与 `--schedule-day <value>`（例如 `--schedule-time 5 --schedule-day 16`）
- `task-draft explain` 使用 Dorado `resource/explain` 校验 HSQL 草稿或线上版本语法，支持 `--date` 替换 `${DATE}` / `${date}` / `${date-1}`，支持 `--template-var k=v` 替换 `{{k}}`，支持 `--online` / `--version <n>` 校验发布版本
- `task-draft explain` 仅适用于 `type=hsql` 任务；如果任务是 DTS，请改用 `dts-draft explain`
- `dts-draft explain` 使用 Dorado `resource/explain` 校验 DTS reader SQL（`conf.configuration.reader.parameter.query`），支持 `typeGroup=dts` 和 `typeGroup=common-dts-batch`
- `dts-draft explain` 同样支持 `--date`、`--template-var k=v`、`--online`、`--version <n>`
- `task-draft update --query-type` 设置查询类型（如 `FLEXIBLE_UNION`、`COMPLEX_QUERY`），写入 `conf.configuration.operator.parameter.queryType`
- `task-draft update --source-region-infos` 设置跨区域数据源配置，接受 JSON 数组，每个元素包含 `geo`（区域标识）和 `yarnQueue`（含 region/dc/clusterName/queue），可选 DECC 字段（`deccDataId`/`deccEndpointId`/`deccTransmissionTaskId`/`deccTransferJobId`/`owner`），写入 `conf.configuration.operator.parameter.sourceRegionInfos`
- `task-draft update` DTS 参数说明（`common-dts-batch` 类型任务）：
  - **Reader 参数**（写入 `conf.configuration.reader`）：
    - `--dts-read-type`：reader 类型（如 `hive`），写入 `reader.type`
    - `--dts-read-idc`：reader IDC（如 `sg`）
    - `--dts-read-source-type`：数据源模式，`sql`（SQL 查询读取）或 `table`（指定库表读取）
    - `--dts-read-query`：SQL 查询语句（`sourceType=sql` 时使用）
    - `--dts-read-database-name` / `--dts-read-table-name`：库名和表名（`sourceType=table` 时使用）
    - `--dts-read-columns`：列定义 JSON 数组，格式 `[{"type":"string","name":"col1"}]`；`sourceType=table` 时可加 `extraType`、`description` 字段
    - `--dts-read-partitions`：分区定义 JSON 数组（`sourceType=table` 时使用），格式 `[{"name":"date","type":"string","value":"${date}"}]`
    - `--dts-read-connector-type`：连接器类型（如 `hive`）
  - **Writer 参数**（写入 `conf.configuration.writer`）：
    - `--dts-writer-type`：writer 类型（如 `clickhouse`），写入 `writer.type`
    - `--dts-writer-idc`：writer IDC（如 `sg`）
    - `--dts-writer-cluster`：集群名称
    - `--dts-writer-database-name` / `--dts-writer-table-name`：目标库名和表名
    - `--dts-writer-columns`：列定义 JSON 数组，格式 `[{"type":"string","name":"col1"},{"type":"int64","name":"col2"}]`
    - `--dts-writer-partitions`：分区定义 JSON 数组，格式 `[{"name":"date","type":"TIME","value":"${date}"}]`
    - `--dts-writer-shard-column`：hash 分布列
    - `--dts-writer-shard-num`：分片数（如 `1200`）
    - `--dts-writer-append-mode`：写入模式（默认 `1`），`1`（覆盖写）、`0`（追加写）、`-2`（删除分区）、`2`（覆盖写2）、`11`（1 + 数据强一致检查）、`12`（2 + 数据强一致检查）
    - `--dts-writer-connector-type`：连接器类型（如 `clickhouse`）
  - `--dts-read-source-type` 传入时有严格校验：`sql` 必须同时传 `--dts-read-query`；`table` 必须同时传 `--dts-read-database-name` 和 `--dts-read-table-name`
  - 不传 `--dts-read-source-type` 时，其他 DTS 参数支持局部更新，只传需要修改的字段即可
- `task-draft update --dependencies` 接受 `taskId[:offsets:offsetsType]` 格式的逗号分隔列表，offsets 默认 0，offsetsType 默认 set（如 `123,456` 等同于 `123:0:set,456:0:set`），可配合 `task dep-recommendations` 获取推荐依赖
- `task-draft update --outer-dependencies` 配置跨机房依赖，格式为 `taskId@region[:offsets[:offsetsType]]` 逗号分隔；例如 `--outer-dependencies "306220763@sg"` 表示依赖 sg 机房的任务 306220763，默认 offsets=0、offsetsType=set；支持多 region 混合（如 `"100@sg,200@va:0:set"`）
- `task-draft test` 返回 Debug ID，可用 `adhoc status` 查询状态，用 `adhoc result` 获取结果
- `task dep-recommendations` 解析任务 SQL 并推荐产出相关表的上游任务，便于快速配置任务依赖
- `node save --image-name/--image-id` 支持为 python/notebook/spark 三种任务类型更新 Docker 镜像；save 时会自动获取当前草稿并检测任务类型，将镜像写入对应位置（spark 写入 `conf.configuration.operator.parameter.image`，python 写入 `conf.configuration.operator.parameter.image` 并设置 `jobType`，notebook 写入 `executeParam.image`）
- `node create` 同样支持 `--image-name/--image-id`，适用于 `--type python/notebook/spark`；创建后会自动补写镜像配置（平台 create API 不完全持久化嵌套 conf，CLI 自动做一次 save 补充）
- Spark 任务创建时默认 `--language python --spark-version 3.2`，可通过 option 覆盖
- 三种非 SQL 任务的镜像存储位置不同（spark/python 存在 `conf.configuration.operator.parameter.image`，notebook 存在 `executeParam.image`），`node create` 和 `node save --image-name/--image-id` 会自动处理差异
- `project yarn-queues` 支持 `--task-type` 按任务类型过滤队列（如 `global_hsql`）
- `project yarn-queues --restricted` 走「合规视图」：注入 `X-Restricted-Status: restricted` 请求头，服务端只返回合规授权的队列子集和合规默认队列；输出会同时打印 `Default queue:` 一行。该开关只对 i18n / 非 cn region（sg、va、mybd、gcp、us-ttp、us-eastred、eu-ttp2、boei18n 等）有意义，cn 没有合规队列概念，加不加无差别
- `task sql-schema` 解析 Hive SQL 语句，返回输出列的 name 和 type，可用于构造 `--dts-read-columns` 参数
- `task fetch-columns` 拉取 Hive 或 ClickHouse 表的列元数据（名称、类型、是否分区列、是否主键等），可用于构造 `--dts-read-columns` 或 `--dts-writer-columns` 参数；ClickHouse 表需额外传 `--schema-name`（集群名）
- `decc endpoints` 按数据库名称查询 DECC endpoint ID，需指定 `--decc-region`（源区域）和 `--target-region`（目标区域）
- `decc datas` 按 endpoint ID 查询该 endpoint 下注册的所有 table 及其 data ID
- `us-ttp`、`us-eastred`、`eu-ttp2` 等 TTP 区域使用 Dataleap JWT 认证（`x-dataleap-jwt-token`），CLI 会自动通过 SG 的 `/user/jwt` 接口换取 Dataleap JWT，用户只需登录 `i18n-tt` 站点（`bytedcli --site i18n-tt auth login`）
- `gp-us` 使用 DataLeap 页面态 session cookie，首次使用前先执行 `bytedcli --site i18n-bd auth login --session`

## References

- `references/dorado.md`


### 从 DataLeap URL 解析 nodeId

用户经常给出 DataLeap 页面 URL，格式类似：

```
https://dataleap-{region}.tiktok-row.net/dorado/development/node[/notebook]/{taskId}?project={region}_{projectId}&version=-1
```

URL 中的数字 ID 是 **taskId**；对 `dorado node get` / `node save` 等 IDE 接口需要的是 **nodeUid**（`N...`）。

**Step 1：解析 URL**
- `taskId`：URL 路径中的数字，如 `/node/305851780` → `305851780`
- `projectId`：query 参数 `project={region}_{projectId}` 中去掉 region 前缀后的数字（可能不带 region）
- `region`：从 hostname 推断，如 `dataleap-sg` → `sg`

**Step 2：调用 `dorado node resolve-uid`**

```bash
bytedcli dorado node resolve-uid --project-id {projectId} --task-id {taskId} --region {region} -j
```

该命令通过 `get-task` 获取任务名称和类型，然后向 `tree-nodes children` 发起带 `name+type` filter 的请求，后端会只返回沿路径向下命中的那个子节点；沿着这条单路径逐层下钻到匹配的叶子节点后，再用 `node-relations` 与入参 `taskId` 校验；输出中 `verified: true` 表示校验通过。
