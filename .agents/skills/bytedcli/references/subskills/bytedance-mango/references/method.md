# 芒果任务接口命令

当需要查询、录入、修改或删除任务下的接口时读取本文件。

所有接口命令都要显式传 `--space-id`、`--module` 和任务 ID。

## 接口类型

`mango task method add` 通过 `--methods` JSON 中的 `ApiMethodType` 表示接口类型。不传时默认按 RPC 录入。

| 接口类型 | `ApiMethodType` | 使用方式                                  |
| -------- | --------------- | ----------------------------------------- |
| RPC      | `1`             | 默认类型；通常传 `Psm` 和下游方法名。     |
| 数据中心 | `2`             | 需要在 JSON 中显式传 `ApiMethodType: 2`。 |
| TCC      | `3`             | 需要在 JSON 中显式传 `ApiMethodType: 3`。 |

## 查询任务下接口

```bash
bytedcli mango task method list --space-id 6 --module demo_module --task-id <task-id>
bytedcli mango task method list --space-id 6 --module demo_module --task-id <task-id> --method-id <method-id>
bytedcli --json mango task method list --space-id 6 --module demo_module --task-id <task-id>
```

说明：

- `--task-id <id>` 必传。
- 不传 `--method-id` 时，文本输出用表格展示任务下所有接口。
- 传 `--method-id` 时，文本输出直接展示该接口 JSON，避免大对象被压成表格。
- `--json` 适合 Agent 或脚本消费完整数据。

## 查询关联菜单

创建需要关联菜单的接口前，先查询当前任务可选菜单：

```bash
bytedcli mango task menu list --space-id 6 --module demo_module --task-id <task-id>
bytedcli mango task menu list --space-id 6 --module demo_module --task-id <task-id> --service-group demo-service
bytedcli mango task menu list --space-id 6 --module demo_module --app-id 82 --task-id <task-id>
```

默认文本输出会直接提示菜单绑定状态。如果输出提示“当前任务已绑定菜单”并说明“可以直接添加接口”，后续 `mango task method add` 可以不传 `MenuItems` / `MethodResources`，CLI 会默认使用绑定菜单，并按 Web 平台规则自动选择或生成默认 `MethodResources`。
如果输出提示未绑定或需要选择菜单，则从表格中选择菜单；需要机器读取时可加 `--json`，其中 `menus[].method_menu_item` 是 `mango task method add --methods` 可直接复用的 `MenuItems` 元素。
AI 开放平台（如 `ai_base` / `ai_special_service`）不按任务绑定菜单选择，`mango task menu list` 会展示 Web 端同源的预设 `Scope` 菜单。默认 scope 是 `douyin_ai_platform_4`，可直接添加接口；需要选择其他菜单时，把表格中的 `Scope` 传给 `mango task method add --menu-scope <scope>`。AI 开放平台不补 `MethodResources`。
默认会按 `--space-id + --module` 查询应用列表并解析 AppID；如果模块名不唯一或平台提示 AppID 异常，显式传 `--app-id <id>`。

通常不需要单独查询资源；确定菜单后，添加接口流程会按 Web 端规则选择默认资源。只有需要人工检查或覆盖资源时，再使用 `mango task menu resource` 查询该菜单对应的 `MethodResources`。

规则：

- 非 AI 平台按 Web 端原规则处理：需要资源的平台会在选中 `MenuItems` 后自动补 `MethodResources`；任务已绑定唯一菜单时可省略 `MenuItems`；多个资源需要在 `--methods` 中显式传 `MethodResources`。
- AI 开放平台特殊处理：`menu list` 展示预设 `Scope` 菜单；`method add` 默认使用 `douyin_ai_platform_4`，也可通过 `--menu-scope` 指定；不自动补 `MethodResources`。

## 录入接口

```bash
bytedcli mango task method add --space-id 6 --module demo_module --task-id <task-id> --methods '[{"Name":"demo-method","Psm":"example.service_demo","DownstreamMethods":["GetApp"]}]'
bytedcli mango task method add --space-id 6 --module demo_module --task-id <task-id> --methods '[{"Name":"demo-tcc","Psm":"example.access_control_v2","ApiMethodType":3,"DownstreamMethods":["sample_key"]}]'
bytedcli --json mango task method add --space-id 6 --module demo_module --task-id <task-id> --methods '[{"Name":"demo-method"}]'
```

顶层参数：

| CLI 参数                 | 说明                                       | 是否必传 |
| ------------------------ | ------------------------------------------ | -------- |
| `--space-id <id>`        | 芒果空间 ID。                              | 是。     |
| `--module <module>`      | 应用模块。                                 | 是。     |
| `--task-id <id>`         | 任务 ID。                                  | 是。     |
| `--methods <json>`       | 方法对象数组 JSON。                        | 是。     |
| `--agw-psm <psm>`        | 应用 AGW PSM；需要检查并回填已有路由时传。 | 否。     |
| `--service-group <name>` | 服务组名称。                               | 否。     |
| `--menu <json>`          | 菜单 JSON 字符串。                         | 否。     |
| `--menu-scope <scope>`   | 选择预设菜单权限。                         | 否。     |

`--methods` 中可以直接传 `MenuItems`。非 AI 平台按 Web 端原规则决定是否自动补 `MethodResources`、顶层 `ServiceGroupName` 和 `MenuJson`；如果 `mango task menu list` 文本输出提示当前任务已绑定菜单且可以直接添加接口，也可以省略 `MenuItems`。AI 开放平台使用 `--menu-scope` 选择预设菜单，不补资源字段。

## 修改接口

```bash
bytedcli mango task method update --space-id 6 --module demo_module --task-id <task-id> --method-id <method-id> --method '{"Name":"demo-method","AgwTimeout":50000}'
bytedcli --json mango task method update --space-id 6 --module demo_module --task-id <task-id> --method-id <method-id> --method '{"RWType":"read"}'
```

说明：

- `--task-id` 和 `--method-id` 必传。
- `--method` 传单个方法对象，不要传数组。
- 已录入接口不允许修改 `Psm`、`IdlBranch`、`DownstreamMethods`；需要变更这些字段时，删除后重新录入。

## 删除接口

```bash
bytedcli mango task method delete --space-id 6 --module demo_module --task-id <task-id> --method-id <method-id>
bytedcli --json mango task method delete --space-id 6 --module demo_module --task-id <task-id> --method-id <method-id>
```

说明：

- `--task-id` 和 `--method-id` 必传。

## 方法字段表

`--methods` 传入的是方法对象数组；`--method` 传入的是单个方法对象。

| 字段                | 含义                                                             | 默认或使用建议                                   | 是否必传                           |
| ------------------- | ---------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------- |
| `Id`                | 已录入接口的方法 ID。                                            | 修改接口时通过 `--method-id` 传。                | 新增不传；修改必传 `--method-id`。 |
| `ApiMethodType`     | 接口类型。`1` RPC，`2` 数据中心，`3` TCC。                       | 新增默认 `1`。                                   | 否；非 RPC 时必传。                |
| `Name`              | 芒果平台展示的接口名称。                                         | 建议显式传入，方便后续检索和确认。               | 建议必传。                         |
| `HttpPath`          | 对外 HTTP 路径。                                                 | 常规 RPC/TCC 可省略；特殊路径建议显式传。        | 条件必填。                         |
| `HttpMethod`        | 对外 HTTP 方法。                                                 | 新增默认 `"POST"`。                              | 否。                               |
| `RwType` / `RWType` | 接口读写类型，如 `read`、`write`。                               | 常规读接口可省略；写接口建议显式传 `write`。     | 否。                               |
| `Psm`               | 下游 RPC/TCC 的 PSM。                                            | RPC/TCC 常规录入建议传；修改接口禁止传。         | 常规 RPC/TCC 建议必传。            |
| `IdlBranch`         | 下游 IDL 分支。                                                  | 新增默认 `master`；修改接口禁止传。              | 否。                               |
| `DownstreamMethods` | 下游方法列表。RPC 通常传方法名数组；TCC 可传 key 列表。          | RPC 常规录入建议传一个方法名；修改接口禁止传。   | 常规 RPC 建议必传。                |
| `AgwTemplateRules`  | GraphQL / AGW 模板规则。                                         | 常规不需要传；需要覆盖默认规则时传。             | 否。                               |
| `MethodResources`   | 关联资源列表。                                                   | 有资源配置需求时传。                             | 否。                               |
| `MenuItems`         | 关联菜单权限配置。                                               | 通常优先用 `--menu-scope` 选择预设菜单。         | `PermissionType: 3` 时需要。       |
| `AgwOperationName`  | AGW 操作名。                                                     | 常规可省略；需要固定操作名时显式传。             | 否。                               |
| `AgwGroupName`      | AGW 分组名。                                                     | 没有分组需求时省略。                             | 否。                               |
| `AgwTimeout`        | AGW 接口超时时间，单位毫秒。                                     | 常规可省略；需要更长超时时显式传，例如 `50000`。 | 否。                               |
| `PermissionType`    | 权限模型。`1` 无需登录，`2` 需登录无需鉴权，`3` 需登录且需鉴权。 | 常规可省略；传 `3` 时同时准备菜单权限。          | 否。                               |
| `AppIdFieldName`    | 应用 ID 字段名，供权限配置识别。                                 | 需要按应用 ID 校验权限时传。                     | 否。                               |
| `TpAppIdFieldName`  | 第三方应用 ID 字段名。                                           | 需要按第三方应用 ID 校验权限时传。               | 否。                               |
| `StarryPageId`      | 关联 Starry 页面 ID 列表。                                       | 有页面关联需求时传。                             | 否。                               |
| `VisualPageKeys`    | 关联 Visual 页面 key 列表。                                      | 有 Visual 页面关联需求时传。                     | 否。                               |

## 菜单权限

需要指定菜单权限时，优先使用 `--menu-scope`：

```bash
bytedcli mango task method add --space-id 6 --module demo_module --task-id <task-id> --menu-scope douyin_ai_platform_4 --methods '[{"Name":"demo-method","Psm":"example.service_demo","DownstreamMethods":["GetApp"]}]'
```

可选值：

| `--menu-scope`         | 菜单名称               |
| ---------------------- | ---------------------- |
| `douyin_ai_platform_3` | 校验智能体与用户关系   |
| `douyin_ai_platform_5` | 校验模型库与用户关系   |
| `douyin_ai_platform_4` | 只校验空间和用户间权限 |

## 常见写法

录入一个 RPC 方法：

```bash
bytedcli mango task method add --space-id 6 --module demo_module --task-id <task-id> --methods '[{"Name":"demo-GetApp","Psm":"example.service_demo","DownstreamMethods":["GetApp"]}]'
```

录入多个 RPC 方法：

```bash
bytedcli mango task method add --space-id 6 --module demo_module --task-id <task-id> --methods '[{"Name":"demo-GetApp","Psm":"example.service_demo","DownstreamMethods":["GetApp"]},{"Name":"demo-CreateApp","Psm":"example.service_demo","DownstreamMethods":["CreateApp"],"RwType":"write"}]'
```

录入 TCC：

```bash
bytedcli mango task method add --space-id 6 --module demo_module --task-id <task-id> --methods '[{"Name":"demo-tcc","Psm":"example.access_control_v2","ApiMethodType":3,"DownstreamMethods":["sample_key"]}]'
```

修改名称和超时：

```bash
bytedcli mango task method update --space-id 6 --module demo_module --task-id <task-id> --method-id <method-id> --method '{"Name":"demo-method-renamed","AgwTimeout":50000}'
```
