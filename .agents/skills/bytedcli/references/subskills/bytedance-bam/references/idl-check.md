# IDL 一致性检测操作指南

> **触发时机**: 修改 .thrift/.proto 后、提 MR 前、联调前、同步 BAM 时。

## 总体流程

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

## ⚠️ 约束

- **不要** 未经确认执行 BAM 版本创建 (C6)
- **不要** 删除用户的 IDL 或业务代码
- C1 中执行生成后 **默认回滚**，让用户决定是否保留

---

## 项目探测

首次执行时自动识别项目技术栈:

| 探测项 | 方法 | 示例 |
|-------|------|------|
| IDL 类型 | 扫描 *.thrift / *.proto | `thrift` / `protobuf` |
| 服务类型 | go.mod + hertz_gen/ 或 kitex_gen/ | `http(hertz)` / `rpc(kitex)` |
| 生成命令 | Makefile gen_idl_* → gen.go //go:generate | `make gen_idl_api_server` |
| IDL 目录 | .thrift/.proto 聚集目录 | `api/idl/api_server/` |
| 生成产物目录 | hertz_gen/ 或 kitex_gen/ | `api/idl/hertz_gen/` |
| 服务入口 IDL | 含 service 定义的文件 | `service.thrift` |
| Handler/路由 | **/route.go **/handler*.go | `apps/*/handler/` |
| PSM | 项目配置或询问用户 (BAM 必需) | `xx.yy.api_server` |

---

## C1: IDL ↔ 生成代码一致性

> 修改 IDL 后忘记重新生成代码

```
1. 执行探测到的代码生成命令
2. git diff gen_dir → 有 diff 则不一致，展示差异
3. 默认回滚 (git checkout -- gen_dir)
```

**修复:** 保留生成结果不回滚，或提示用户手动执行生成命令。

---

## C2: IDL 接口 ↔ 业务代码一致性

> IDL 定义了接口但业务代码未注册/实现

**HTTP (Hertz):**

```
1. service.thrift 路由注解 (api.get/post/put/delete) → {method, path, name}
2. route.go Group()嵌套 + HTTP方法注册 → {method, full_path, handler}
3. 交叉对比 → IDL有&route无=Error | route有&IDL无=Warning | method/path不一致=Error
```

**RPC (Kitex):**

```
1. service.thrift/.proto service方法 → {service_name, method_name}
2. handler目录 grep方法实现 → func.*MethodName(
3. 交叉对比 → IDL有&handler无=Error | handler有&IDL无=Warning
```

**修复:** 生成缺失的路由注册代码或 Handler 方法骨架。

---

## C3: IDL 注解/语义检查

> 注解错误，编译通过但运行时异常

| 规则 | 适用 | 级别 |
|------|------|------|
| struct/message 字段编号重复 | 通用 | Error |
| include/import 引用文件不存在 | 通用 | Error |
| 孤立 struct/message (未被 service 方法引用) | 通用 | Warning |
| GET 请求 Request 使用 api.body (应为 api.query) | HTTP | Error |
| go.tag json key ≠ api.body key | HTTP | Warning |
| 方法参数非 struct/message 类型 | RPC | Error |

**修复:** 直接修改 IDL 文件中的错误注解。

---

## C4: Git 变更一致性

> IDL 相关文件未成对变更

```
获取变更文件 (git diff --name-only / --staged / origin/main...HEAD)
按类型分类: idl_files / gen_files / route_files / handler_files

G1. IDL 变更 & 生成代码未变更   → Error: 忘了重新生成
G2. 生成代码变更 & IDL 未变更   → Error: 手动改了生成代码
G3. service IDL 新增方法 & route/handler 未变更 → Warning: 可能忘了注册
```

**修复:** G1→执行生成命令; G2→`git checkout -- gen_dir`。

---

## C5: 本地 IDL ↔ BAM 差异

> 本地与 BAM 远端接口不一致

**前置:** PSM + 可选 BAM 分支 (默认 master)

```
1. 查询 BAM 接口列表:
   bytedcli --json bam method list --psm "xx.yy.api_server"
   非 default 集群加 --cluster <cluster>；指定版本加 --version <version>
   RPC 服务加 --ep-type rpc

2. 解析本地 service IDL:
   HTTP: {method, path} 从路由注解
   RPC:  {method_name} 从 service 定义

3. 对比 (HTTP key=method+path, RPC key=method_name):
   本地有 & BAM无 → 忘了同步
   BAM有 & 本地无 → 协作者更新了，需 git pull

4. (可选) 字段级对比:
   bytedcli --json bam method get --psm "xx.yy.api_server" --method "MethodName"
   获取 schema 与本地 IDL 字段对比
```

**修复:** C6 同步 BAM，或 git pull 拉取最新。

---

## C6: 本地 → BAM 同步

> 将本地 IDL 变更推送到 BAM

```
1. 运行 C5 获取差异
2. 展示预览: +N 新增 / ~M 修改 / -K 删除
3. ⚠️ 请求用户确认
4. 执行同步:
   bytedcli bam idl update --psm "xx.yy.api_server" --branch master --next-version
5. 再次 C5 验证一致
```

---

## 报告格式

```
═══ IDL 一致性检查报告 ═══
项目: {project} | 类型: {http/rpc} | IDL: {thrift/proto}

C1 IDL↔生成代码  [❌] 1 error  → gen/ 有差异, 💡 执行生成命令
C2 接口↔业务代码  [❌] 1 error  → 1个接口未注册, 💡 补充 route/handler
C3 注解语义       [✅] 通过
C4 Git变更一致性  [❌] 1 error  → IDL 变更但 gen 未更新
C5 本地↔BAM      [⚠️] 2 warn  → 2个新接口未同步
合计: 3 errors, 2 warnings
```

---

## 远端能力依赖

| 能力 | 调用方式 | 用于 |
|------|---------|------|
| BAM 接口列表 | `bytedcli --json bam method list --psm "..." [--cluster <cluster>] [--version <version>]` | C5 |
| BAM 接口详情 | `bytedcli --json bam method get --psm "..." --method "..." [--cluster <cluster>]` | C5 |
| BAM 创建版本 | `bytedcli bam idl update --psm "..." --branch "..." --next-version` | C6 ⚠️ |
| IDL 解析 | Agent 读取 .thrift/.proto | C1~C5 |
| 代码生成 | 执行 gen_command | C1 |
| Git | git diff / git checkout | C1, C4 |

---

## 常见问题

### 找不到生成命令

- 原因：项目未使用标准 Makefile 或 go:generate 模式
- 处理：手动指定生成命令，例如 `make gen`、`hz update` 或 `kitex -module ...`
- 补充：检查 Makefile 中是否有 `gen_idl_*` 目标，或 `gen.go` 中是否有 `//go:generate` 指令

### C5 对比结果异常

- 原因：PSM 不匹配或 BAM 分支错误
- 处理：使用 `bytedcli bam psm search "keyword"` 确认 PSM 值；默认对比 master 分支，如需其他分支需显式指定
- 补充：RPC 服务需添加 `--ep-type rpc` 参数

### C1 生成命令执行失败

- 原因：本地缺少 hertz/kitex 工具链或 go 依赖
- 处理：确认 `hz`（Hertz）或 `kitex`（Kitex）命令可用；执行 `go mod tidy` 确保依赖完整
- 补充：生成命令失败不影响 C2~C5 检查，可跳过 C1 继续
