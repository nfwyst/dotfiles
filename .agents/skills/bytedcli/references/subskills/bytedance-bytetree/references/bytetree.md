# ByteTree

## Commands

### 搜索节点

```bash
bytedcli bytetree search --query "demo-service-tree"
bytedcli --json bytetree search --keyword "sample-node" --page-size 50
```

- 返回匹配节点的 `id`、`type`、`name`、`path`、`owners`
- 适合先定位服务树节点，再继续下钻

### 查看节点详情

```bash
bytedcli bytetree get --node-id 1234567
bytedcli --json bytetree get --node-id 1234567
```

- 返回单个节点的基础信息、负责人、tags、描述和 overview URL
- 返回单个节点的基础信息、负责人、tags、描述、overview URL，以及 `resources`
- 适合拿到 node id 后快速确认节点归属和元数据

#### resources 结构提示

- `provider`：资源提供方，例如 `tce`、`tcc`、`rds`
- `resource_type`：资源类型，例如 `container`、`config`、`tcc`
- `resource_id`：资源唯一标识，后续经常可以直接拿去查 TCE/TCC
- `partition` / `env` / `region`：帮助判断资源落在哪个分区和环境
- `link.view`：控制台跳转地址，适合需要人工复核时直接打开

### 查看节点资源

```bash
bytedcli bytetree resources --node-id 1234567 --provider codebase
bytedcli --json bytetree resources --node-id 1234567 --provider tce --offset 20 --page-size 50
```

- 直接查询 `/nodes/{id}/resources_v2`，适合列出某个节点下挂载的资源
- 支持 `--provider` 精确筛选资源来源，例如 `codebase`、`tce`、`tcc`
- 返回 `node_id`、`provider`、`resource_type`、`name`、`resource_id/rid`、`env`、`link.view`

### 查看子节点

```bash
bytedcli bytetree children --node-id 1234567
bytedcli --json bytetree children --node-id 1234567 --type service,psm --page-size 100
```

- 默认类型：`service,resource,psm,employee,top-node,folder`
- 支持 `--page`、`--page-size`、`--max-level`
- 文本模式下会展示 `provider` 和 `path`

### 查看父链

```bash
bytedcli bytetree parents --node-id 1234567
bytedcli --json bytetree parents --node-id 1234567
```

- 返回从上层目录到当前节点的完整父链
- 适合补齐节点所属路径、确认归属目录、查服务树挂载位置

## 使用建议

- 不知道节点 ID 时，先用 `search`
- 已经有节点 ID、需要看节点元数据时，用 `get`
- 已经有节点 ID、需要按 provider 列资源时，用 `resources`
- 已经有父节点 ID 时，用 `children`
- 已经有节点 ID、需要看归属链路时，用 `parents`
- 服务树是全球一棵树，省略 `--site` 默认走 `cn` 控制面；跨站点排查时再按需切换
