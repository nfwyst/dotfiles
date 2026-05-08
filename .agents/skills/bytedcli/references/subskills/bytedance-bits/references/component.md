# bytedcli BITS Component 相关操作

`bits component` 提供了客户端组件（如 iOS/Android 模块、跨端库等）在 Bits 平台的生命周期管理、升级与查询能力。

## 基础查询

### 获取组件详情 (`get-repo`)

通过唯一的组件 ID 获取该组件的详细信息。

**参数说明**：
- `--id` (必填): 组件库的唯一 ID。

**示例**：
```bash
bytedcli bits component get-repo --id 12345
```

### 按名称获取组件 (`get-repos-by-name`)

通过组件名称获取对应的组件信息。因为可能存在同名组件，返回结果可能包含多个。

**参数说明**：
- `--name` (必填): 组件名称。
- `--app-type` (必填): 应用类型枚举值（`0`:Unknown, `1`:iOS, `2`:Android, `3`:Flutter, `4`:Custom, `5`:Backend, `6`:Frontend, `7`:RubyGem, `8`:Harmony(鸿蒙), `9`:RustCrate, `12`:KotlinMultiplatform）。
- `--group-name` (可选): 组名称（例如 Android 的 `groupId`）。

**示例**：
```bash
bytedcli bits component get-repos-by-name --name "demo-component" --app-type 2
```

### 搜索组件库 (`search-repos`)

根据关键字、收藏状态等条件分页搜索组件库。

**参数说明**：
- `--page` (必填): 分页页码。
- `--page-size` (必填): 每页返回的数量。
- `--username` (可选): 过滤特定操作人（为空字符串表示不限）。
- `--app-type` (可选): 按技术栈/应用类型过滤（例如 `Unknow` 表示查看全部）。
- `--name` (可选): 组件名称，左前缀匹配。
- `--tag-id` (可选): 按标签 ID 搜索（来源于 `list-repo-tags` 的 ID）。
- `--app-id` (可选): 按空间筛选。
- `--sort-by` (可选): 排序字段。
- `--current-user` (可选): 当前用户标识。
- `--only-favorite` (可选): 如果带上此标志或设为 true，则只返回当前用户已收藏的组件。

**示例**：
```bash
bytedcli bits component search-repos --page 1 --page-size 10 --name "demo" --only-favorite
```

## 版本与升级

### 组件升级 (`upgrade-repo`)

触发客户端组件升级的主入口，创建一个新的组件升级历史。

**参数说明**：
- `--repo-id` (必填): 组件库的唯一 ID。
- `--version` (必填): 准备升级到的目标版本号（例如 `1.0.1`）。
- `--branch` (必填): 代码所在的分支名。
- `--username` (必填): 触发此次升级的操作人用户名。
- `--change-log` (可选): 版本的更新说明或 changelog。
- `--commit` (可选): 对应的 Git commit hash（如果不填写，系统会使用分支最新的 commit）。
- `--save-history` (可选): 是否保存历史记录（`1` 表示保存，重试场景推荐写 `0`）。
- `--ext-info` (可选): 透传参数。
- `--cloud-build-template-id` (可选): 云构建模板配置 ID（自定义组件类型需要使用）。
- `--public-repo-need-ttp` (可选): 支持对于公共中台组件的 TTP 发布。
- `--is-ttp` (可选): 是否为 TTP 发布。
- `--mr-id` (可选): Bits MR id（给研发流程平台使用的）。
- `--extra` (可选): 附加扩展参数的 JSON 字符串。

**示例**：
```bash
bytedcli bits component upgrade-repo \
  --repo-id 12345 \
  --version "1.0.1" \
  --branch "release/1.0" \
  --username "your_username" \
  --change-log "更新说明" \
  --commit "abcdef123456" \
  --save-history 1
```

> **注**：原 `bits component upgrade --payload-file payload.json` 保留作为向后兼容的别名，但推荐使用新的扁平化命令参数。

### 获取基准版本列表 (`get-base-versions`)

获取指定组件库的所有基准版本号列表。

**参数说明**：
- `--repo-id` (必填): 组件库的唯一 ID。
- `--version-type` (可选): 版本类型枚举值（如 `1` 代表 formal/正式版, `2` 代表 alpha 等）。
- `--version-prefix` (可选): 按版本前缀过滤（如 `1.0.`）。

**示例**：
```bash
bytedcli bits component get-base-versions --repo-id 12345 --version-type 1 --version-prefix "1.0"
```

### 获取下一个语义化版本号 (`get-next-semantic-version`)

根据当前版本和指定的版本升级规则，自动计算下一个合理的语义化版本号。

**参数说明**：
- `--repo-id` (必填): 组件库的唯一 ID。
- `--base-version` (必填): 当前的基础版本号（如 `1.0.0`）。
- `--vloc` (必填): 版本号变更位置枚举值，如 `1` (major/主版本), `2` (minor/次版本), `3` (patch/修订版本)。
- `--vtype` (可选): 新版本的类型枚举值，如 `1` (formal/正式版), `2` (alpha) 等。

**示例**：
```bash
bytedcli bits component get-next-semantic-version \
  --repo-id 12345 \
  --base-version "1.0.0" \
  --vloc 3 \
  --vtype 1
```

## 历史记录查询

### 获取升级历史详情 (`get-history-by-id` / `get-history-by-version`)

通过历史记录的 ID，或者通过组件 ID 加上版本号，精确获取某次升级的详细信息。

**参数说明**：
- `--id` (使用 `get-history-by-id` 时必填): 历史记录的唯一 ID。
- `--repo-id` (使用 `get-history-by-version` 时必填): 组件库的唯一 ID。
- `--version` (使用 `get-history-by-version` 时必填): 对应的版本号。

**示例**：
```bash
# 通过历史 ID 直接查询
bytedcli bits component get-history-by-id --id 9876

# 通过组件 ID 和版本号查询
bytedcli bits component get-history-by-version --repo-id 12345 --version "1.0.1"
# （原 bits component upgrade-history 别名仍可用）
```

### 获取历史及其构建任务 (`get-history-and-builds`)

获取某次升级的详细信息，以及与此次升级关联的所有构建（Build）任务流信息。

**参数说明**：
- `--repo-id` (必填): 组件库的唯一 ID。
- `--version` (必填): 对应的版本号。

**示例**：
```bash
bytedcli bits component get-history-and-builds --repo-id 12345 --version "1.0.1"
```

### 搜索组件升级历史 (`search-histories`)

根据组件 ID、版本前缀、操作人等条件分页搜索历史升级记录。

**参数说明**：
- `--repo-id` (必填): 组件库的唯一 ID。
- `--page` (必填): 分页页码。
- `--page-size` (必填): 每页返回的数量（最大 20）。
- `--version-prefix` (可选): 按版本前缀搜索（与 `--branch` 为或的关系）。
- `--status` (可选): 按升级状态过滤。
- `--version-type` (可选): 按版本类型过滤。
- `--username` (可选): 按当前用户过滤（注：当前为前端字段，建议直接使用 `--operate-user`）。
- `--operate-user` (可选): 按触发升级的操作人（格式为用户的邮箱）过滤。
- `--branch` (可选): 根据分支搜索。
- `--tag-id` (可选): 根据标签 ID 过滤（如稳定版本、废弃版本等，从 `list-repo-tags` 获取）。

**示例**：
```bash
bytedcli bits component search-histories \
  --repo-id 12345 \
  --page 1 \
  --page-size 20 \
  --version-prefix "1.0." \
  --operate-user "user@bytedance.com"
```

## 标签与关联

### 获取全量组件标签 (`list-repo-tags`)

查询平台上所有可用的组件标签（Tags）分类。

**参数说明**：
- `--with-business-tag` (可选): 是否包含业务标签（Business Tags）。
- `--with-standard-tag` (可选): 是否包含标准标签（Standard Tags）。

**示例**：
```bash
bytedcli bits component list-repo-tags --with-business-tag --with-standard-tag
```

### 获取指定组件的标签 (`get-tags-by-id`)

查询特定组件所绑定的所有标签信息。

**参数说明**：
- `--id` (必填): 组件库的唯一 ID。
- `--with-virtual-tags` (可选): 是否包含虚拟标签（Virtual Tags）。

**示例**：
```bash
bytedcli bits component get-tags-by-id --id 12345 --with-virtual-tags
```

### 获取关联组件 (`get-associate-repos`)

查询与目标组件存在关联关系（如依赖关系）的其他组件库。

**参数说明**：
- `--repo-id` (必填): 组件库的唯一 ID。

**示例**：
```bash
bytedcli bits component get-associate-repos --repo-id 12345
```

### 获取 Android 关联组件分组 (`list-android-associated-repos`)

专门针对 Android 项目，查询其关联组件的分组及未关联组件的结果。

**参数说明**：
- `--project-id` (必填): 目标 Android 项目的唯一 ID。

**示例**：
```bash
bytedcli bits component list-android-associated-repos --project-id 112233
```
