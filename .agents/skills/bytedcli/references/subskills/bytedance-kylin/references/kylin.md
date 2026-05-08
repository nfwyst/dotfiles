# Kylin（头条内容审核）

本文件记录当前已支持的 Kylin 能力（仅包含 bytedcli 可用的命令与其对应接口形态）。

为避免在仓库内写真实线上信息，本文件不包含真实域名/路径中的 origin，示例值统一使用 `demo-*` / `example.*`。

### review_context/list（gid 审核历史）

- 形态：HTTP GET
- 路径：`/review_context/list`
- Query:
  - `key`：gid
  - `flow`：可选，用于过滤并“保留下来”特征流程的审核记录（按 Kylin 实际含义）

### review_context/detail（trace 详情）

- 形态：HTTP GET
- 路径：`/review_context/detail`
- Query:
  - `index`：`base64(JSON(Index))`，其中 `Index` 来自 `review_context/list` 返回项的 `Index` 字段

### strategy dsl（流程策略 DSL）

- 形态：HTTP POST
- 路径：`/v1/get_flow_layout`
- Body:
  - `flow`：flow name
  - `ppe`：可选
- Headers:
  - `Content-Type: application/x-www-form-urlencoded`
  - `x-use-ppe: 1`（当传 `--ppe` 时）
  - `x-tt-env: <ppe>`（当传 `--ppe` 时）

## CLI

- `kylin trace list`：按 gid 查询审核历史（可选 `--flow` 过滤）
- `kylin trace get`：按 index 查询某条 trace 的详情（建议直接传 `--index-json`，CLI 自动编码；兼容别名 `trace detail`）
- `kylin strategy dsl`：获取某个 flow 的策略 DSL（POST）

> 具体 option 设计要求全部使用 `--xxx` 形式，不使用位置参数。
