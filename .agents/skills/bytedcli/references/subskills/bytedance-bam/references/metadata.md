# BAM 元数据管理

```bash
# PSM 列表
bytedcli bam psm list --cluster default
bytedcli bam psm search "example.service.api" --cluster default

# 方法列表 / 详情（支持 --cluster 指定集群，--version 指定版本）
bytedcli bam method list --psm "example.service.api"
bytedcli bam method list --psm "example.service.api" --cluster i18n
bytedcli bam method list --psm "example.service.api" --cluster i18n --version 1.0.155
bytedcli bam method get --endpoint-id 123456 --version 1.2.3
bytedcli bam method get --psm "example.service.api" --method "DemoMethod"
bytedcli bam method get --psm "example.service.api" --method "DemoMethod" --ep-type rpc
bytedcli bam method get --psm "example.service.api" --method "DemoMethod" --cluster i18n
bytedcli bam method gencode --endpoint-id 123456
bytedcli bam method gencode --psm "example.service.api" --method "DemoMethod"
bytedcli bam method gencode --psm "example.service.api" --method "DemoMethod" --ep-type rpc
bytedcli bam method gencode --psm "example.service.api" --method "DemoMethod" --schema-type response

# 代码生成规则与生成任务
bytedcli bam codegen rule list --psm "example.service.api" --cluster default
bytedcli bam method list --psm "example.service.api" --cluster default
bytedcli bam codegen rule create --psm "example.service.api" --name "robot_demo_rule" --app-id 1234 --package "com.example.demo.model" --methods "GetDemoInfo"
bytedcli bam codegen rule update --rule-id 123456 --psm "example.service.api" --name "robot_demo_rule" --app-id 1234 --package "com.example.demo.model" --generate selected --methods "GetDemoInfo"
bytedcli bam codegen generate --rule-id 123456 --branch master
bytedcli bam codegen generate --rule-id 123456 --branch master --create-permission-ticket --permission-reason "need codegen access"

# 版本历史
bytedcli bam version list "example.service.api" --cluster default

# 创建/更新 IDL 版本（--next-version 自动 patch +1；或 --version 指定版本号）
bytedcli bam idl update --psm "example.service.api" --branch master --next-version
bytedcli bam idl update --psm "example.service.api" --branch "codex/fix-idl" --version "1.2.4" --commit-id "abc1234" --commit-msg "update idl"

# 引用 schema 查询（拉取 struct、enum、const，支持按类型和名称过滤）
bytedcli bam idl schema --psm "example.service.api" --version 1.0.155 --cluster default
bytedcli bam idl schema --psm "example.service.api" --version 1.0.155 --type enum --search EntityType
```

## 代码生成规则说明

- `rule create` 和 `rule update` 是两个独立命令；创建不接受 `--rule-id`，更新必须传 `--rule-id`。
- `--generate selected|all|unselected` 默认是 `selected`；`selected` 和 `unselected` 都要求传 `--methods`。
- `--scaffold` 支持 `android`=30、`flutter`=31、`ios`=32、`ferry`=33、`harmony`=34、`kotlinmulti`=35，也可以直接传数字 id。
- `--methods` 使用 BAM 方法名，推荐先执行 `bam method list`，取返回里的 `endpoint.rpc_method || endpoint.name`。
- `codegen generate` 会在响应包含 `has_permission=false` 或 `escape_params` 时自动执行 IAM 权限检查；只有显式加 `--create-permission-ticket` 才会创建权限工单，默认权限角色为 `bam.developer.cn`。
- RPC 方法按 PSM + 方法名查询或生成代码时，给 `method get` / `method gencode` 加 `--ep-type rpc`。
- `method get --schema ref` 输出会保留 HTTP `body_param` 与 RPC `rpc_param`。
- `idl schema` 拉取指定服务版本的全部引用 schema（struct、enum、const），支持 `--search <keyword>` 按名称过滤和 `--type enum|struct|const|string_enum` 按类型过滤。
- `--app-id`、`--package`、`--psm`、`--name` 不提供业务默认值，需要按当前业务显式传入。
