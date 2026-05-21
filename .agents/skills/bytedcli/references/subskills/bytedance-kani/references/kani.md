# Kani

Kani 是权限审批/工单平台。bytedcli 当前主要覆盖 **审批工单列表** 能力。

## 列出审批工单

```bash
bytedcli kani approval list

# JSON 输出（全局参数必须放在子命令前）
bytedcli --json kani approval list
```

## 常用筛选示例

```bash
# 待我审批 / 我参与审批
bytedcli kani approval list --role reviewer

# 我发起的已完成
bytedcli kani approval list --role applicant --view finished

# 过滤：申请人/审批人
bytedcli kani approval list --applicant alice --reviewer bob

# 过滤：加急 bucket
bytedcli kani approval list --urgent true

# 过滤：命名空间/安全等级/VDC
bytedcli kani approval list --ns demo_ns --security-level P0 --vdc demo_vdc

# 时间范围（ISO,ISO）
bytedcli kani approval list --created-at 2026-05-01T00:00:00Z,2026-05-12T00:00:00Z

# 分页
bytedcli kani approval list --limit 50 --offset 0
```

## 参数一览（kani approval list）

> 具体可用参数以 `bytedcli kani approval list --help` 为准。

- `--role <role>`：`applicant|reviewer`（默认 `applicant`）
- `--view <view>`：`running|finished`（默认 `running`）
- `--applicant <user>`：申请人过滤
- `--reviewer <user>`：审批人过滤
- `--status <status>`：工单状态过滤
- `--review-status <status>`：审批状态过滤
- `--urgent <boolean>`：加急 bucket 过滤（`true|false`）
- `--vdc <vdc>`：VDC 过滤
- `--limit <n>`：单 bucket page size（默认 `20`）
- `--offset <n>`：单 bucket offset
- `--start-id <id>`：单 bucket pagination start_id
- `--created-at <startISO,endISO>`：创建时间范围
- `--review-created-at <startISO,endISO>`：审批创建时间范围
- `--asc <boolean>`：是否升序
- `--cross-region <boolean>`：跨 region 过滤
- `--ns <ns>`：命名空间过滤
- `--security-level <level>`：安全等级过滤
- `--kani-site <site>`：隐藏参数，`cn|boe`（默认 `cn`）

## 站点

- 默认站点：`cn`
- BOE：隐藏参数 `--kani-site boe`
