---
name: bytedance-bam
description: 'BAM API 管理平台官方 skill，提供 API 接口元数据查询、管理、IDL 检测修复等能力。当用户请求"API 查询"、"API 管理"、"接口元数据"、"接口查询"、"方法查询"、"IDL 查询"、"IDL 版本更新"、"IDL 检查"、"IDL 同步"等时使用。'
---

# bytedcli BAM

本 Skill 提供两条使用路径：

| 用户意图 | 路径 | 参考 |
|---------|------|------|
| 搜索 PSM、查方法、查版本、创建 IDL 版本、管理代码生成规则 | **A: BAM 元数据管理** | `references/metadata.md` |
| IDL 改了要检查、提 MR 前检查、同步 BAM | **B: IDL 一致性检测** | `references/idl-check.md` |

## 前置条件

- 使用通用调用方式：`references/invocation.md`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

---

## 路径 A: BAM 元数据管理

### When to use

- PSM 搜索、收藏、最近查看
- 方法列表 / 方法详情
- 服务版本查询
- 创建服务版本（IDL 版本更新）
- 查询、创建、更新 BAM scaffold 代码生成规则，并触发代码生成

### Quick start

Commands are grouped under `bam psm`, `bam method`, `bam codegen`, `bam version`, and `bam idl`. Old flat names (e.g. `bam list-recent-psm`, `bam search-psm`, `bam list-method`, `bam get-method`, `bam versions`, `bam update-idl-version`) still work as hidden aliases.

```bash
# PSM 列表
bytedcli bam psm list --cluster default
bytedcli bam psm list --cluster default --starred
bytedcli bam psm search "example.service.api" --cluster default

# 方法列表 / 详情（支持 --cluster 指定集群，--version 指定版本）
bytedcli bam method list --psm "example.service.api"
bytedcli bam method list --psm "example.service.api" --cluster i18n
bytedcli bam method list --psm "example.service.api" --cluster i18n --version 1.0.155
bytedcli bam method get --endpoint-id 123456 --version 1.2.3
bytedcli bam method get --psm "example.service.api" --method "DemoMethod"
bytedcli bam method get --psm "example.service.api" --method "DemoMethod" --cluster i18n
bytedcli bam method gencode --endpoint-id 123456
bytedcli bam method gencode --psm "example.service.api" --method "DemoMethod"
bytedcli bam method gencode --psm "example.service.api" --method "DemoMethod" --schema-type response
bytedcli bam method gencode --psm "example.service.api" --method "DemoMethod" --struct "DemoMethodRequest"

# 代码生成规则与生成任务
bytedcli bam codegen rule list --psm "example.service.api" --cluster default
bytedcli bam method list --psm "example.service.api" --cluster default
bytedcli bam codegen rule create --psm "example.service.api" --name "robot_demo_rule" --app-id 1234 --package "com.example.demo.model" --methods "GetDemoInfo"
bytedcli bam codegen rule update --rule-id 123456 --psm "example.service.api" --name "robot_demo_rule" --app-id 1234 --package "com.example.demo.model" --generate selected --methods "GetDemoInfo"
bytedcli bam codegen generate --rule-id 123456 --branch master

# 版本历史
bytedcli bam version list "example.service.api" --cluster default

# 创建/更新 IDL 版本
bytedcli bam idl update --psm "example.service.api" --branch master --next-version
bytedcli bam idl update --psm "example.service.api" --branch "codex/fix-idl" --version "1.2.4" --commit-id "abc1234" --commit-msg "update idl"
```

### Notes

- `method list` 和 `method get` 支持 `-c, --cluster <cluster>` 指定集群（默认 `default`），适用于 i18n 等非默认集群
- `method list` 支持 `--version <version>` 查询指定版本的方法列表；不带 `--version` 时走分页搜索接口，带 `--version` 时返回该版本全量方法
- `method get` 支持 `--endpoint-id` 或 `--psm` + `--method` 两种定位方式
- `method gencode` 支持 `--endpoint-id` 或 `--psm` + `--method` 两种定位方式，`--version` 默认为最新版本，`--lang` 默认为 `ts`，`--schema-type` 默认为 `request`，也支持生成 `response`
- `codegen rule create` 和 `codegen rule update` 已拆分；创建会传 `only_create=true`，更新必须传 `--rule-id` 并传 `only_create=false`
- `codegen rule create/update` 默认 `--generate selected`，因此通常需要先用 `bam method list` 查询方法名，再把 `endpoint.rpc_method || endpoint.name` 作为 `--methods` 传入
- `codegen rule create/update` 不内置业务默认值，`--app-id`、`--package`、`--psm`、`--name` 都需要显式提供；`--owner` 不传时使用当前 ByteCloud JWT 用户
- `--schema ref|raw` 控制 schema 展示方式
- `idl update` 必须提供 `--psm` 和 `--branch`，版本号通过 `--version` 指定或 `--next-version` 自动在最新版本基础上 patch +1
- 缺少必填参数会自动输出帮助信息
- 需要结构化输出加 `--json`（全局选项，放在子命令之前，如 `bytedcli --json bam method get ...`）

---

## 路径 B: IDL 一致性检测

### When to use

- 修改 .thrift/.proto 后快速检查
- 提交代码 / 提 MR 前全量检查
- 联调前 / 发版前验证
- 同步 BAM 远端接口

### 总体流程

```
项目探测 → 选择检查范围 → 执行检查 → 输出报告 → 辅助修复
```

| 用户意图 | 执行范围 |
|---------|---------|
| 改了 IDL 快速检查 | C1, C3 |
| 提交代码 / 提 MR | C1 ~ C4 |
| 联调前 / 发版前 | C1 ~ C5 |
| 同步 BAM | C5, C6 |
| 全量检查 | C1 ~ C6 |

### 检查项速览

| 编号 | 检查内容 | 依赖 |
|------|---------|------|
| C1 | IDL ↔ 生成代码一致性 | 本地 gen 命令 + git |
| C2 | IDL 接口 ↔ 业务代码一致性 | Agent 静态分析 |
| C3 | IDL 注解/语义检查 | Agent 静态分析 |
| C4 | Git 变更一致性 | git diff |
| C5 | 本地 IDL ↔ BAM 远端差异 | `bytedcli bam method list` |
| C6 | 本地 → BAM 同步 | `bytedcli bam idl update` |

### ⚠️ 约束

- **不要** 未经确认执行 BAM 版本创建 (C6)
- **不要** 删除用户的 IDL 或业务代码
- C1 中执行生成后 **默认回滚**，让用户决定是否保留

> 完整操作指南见 `references/idl-check.md`

---

## References

- `references/metadata.md` — BAM 元数据管理命令速查
- `references/idl-check.md` — IDL 一致性检测完整操作指南
- `references/invocation.md` — 通用调用方式
- `references/troubleshooting.md` — 常见问题与处理
