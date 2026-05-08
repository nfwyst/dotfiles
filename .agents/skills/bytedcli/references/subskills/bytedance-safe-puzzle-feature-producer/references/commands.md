# bytedcli 命令速查(唯一 SSOT)

所有命令均可用 `-h` 查看完整参数。`--json` 等全局参数参见 `invocation.md`；`--tenant` 是 `safe puzzle` 常用参数,按各子命令要求显式传入。

## 租户
| 动作 | 命令                                       |
|---|------------------------------------------|
| 获取当前配置租户 | `bytedcli safe config get --key tenant`  |
| 列出所有有效租户 | `bytedcli safe puzzle tenant list --all` |

## 实体
| 动作 | 命令 |
|---|---|
| 列出实体 | `bytedcli safe puzzle entity list --tenant <tenant>` |
| 获取实体详情(含实体参数) | `bytedcli safe puzzle entity get --tenant <tenant> --id <entity_id>` |

## 生产集合
| 动作 | 命令                                                                                                 |
|---|----------------------------------------------------------------------------------------------------|
| 列出生产集合 | `bytedcli safe puzzle collection list --tenant <tenant>`                                           |
| 获取集合详情(含集合参数) | `bytedcli safe puzzle collection get --tenant <tenant> --id <collection_id>`                       |
| 列出集合内特征(分页) | `bytedcli safe puzzle collection list-features --tenant <tenant> --id <collection_id> --page <n> --page-size <n>` |

## 数据源(ds)
> `datasource` 是 `ds` 的别名,本 Skill 统一写 `ds`。

| 动作 | 命令 |
|---|---|
| 列出数据源 | `bytedcli safe puzzle ds list --tenant <tenant>` |
| 获取数据源详情 | `bytedcli safe puzzle ds get --tenant <tenant> --id <datasource_id>` |
| 获取数据源 schema | `bytedcli safe puzzle ds get-schema --tenant <tenant> --psm <psm> --method <method>` |
| 创建数据源 | `bytedcli safe puzzle ds create --tenant <tenant> --type <type> --psm <psm> --method <method> --name <name> --desc <desc>` |
| 相似数据源检索 | `bytedcli safe puzzle ds similar-search --keyword <keyword>` |

## 特征
| 动作 | 命令 |
|---|---|
| 列出特征(可按 entity/collection 过滤) | `bytedcli safe puzzle feature list --tenant <tenant> [--entity-ids <ids>]` |
| 获取特征详情(含 mm_feature_id) | `bytedcli safe puzzle feature get --tenant <tenant> --id <feature_id>` |
| **全局**相似特征检索(**不带 tenant**) | `bytedcli safe puzzle feature similar-search --keyword <keyword> --top 10` |
| 创建草稿 | `bytedcli safe puzzle feature create-draft --type <script\|ds> --content <json_file>` |
| 获取草稿规则配置 | `bytedcli safe puzzle feature get-rule-conf --id <mm_feature_id> --load-draft` |
| 更新草稿规则配置 | `bytedcli safe puzzle feature update-rule-conf --id <mm_feature_id> --content <json_file>` |
| 获取依赖参数 | `bytedcli safe puzzle feature list-dependencies --id <mm_feature_id>` |
| 测算实体特征 | `bytedcli safe puzzle feature test --id <mm_feature_id> --entity-params <json>` |
| 测算集内特征 | `bytedcli safe puzzle feature test --id <mm_feature_id> --pkg-params <json>` |

测算 JSON 形如 `{"room_id": {"type": 2, "val": "123"}}`,`type` 见 yaegi-syntax.md 的**值类型**小节，因自动推断出参数类型，无需手动指定。

## 脚本
| 动作 | 命令 |
|---|---|
| 生成脚本模板(脚本特征) | `bytedcli safe puzzle script generate-template --type common` |
| 生成脚本模板(RPC 请求) | `bytedcli safe puzzle script generate-template --type req --ds-type rpc` |
| 生成脚本模板(RPC 结果) | `bytedcli safe puzzle script generate-template --type resp --ds-type rpc` |
| 编译脚本(`--content` **传文件路径**) | `bytedcli safe puzzle script compile --content <script_path> --tenant <tenant> (--entity-id <id> \| --collection-id <id>)` |

## 工单
| 动作 | 命令 |
|---|---|
| 列出工单 | `bytedcli safe puzzle ticket list --tenant <tenant>` |
| 创建提单(发布) | `bytedcli safe puzzle ticket create --tenant <tenant> --id <mm_feature_id>` |
