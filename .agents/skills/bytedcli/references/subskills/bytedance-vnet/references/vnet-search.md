# VNet Search

VNet 搜索的是火山引擎私有网络（Volcano Engine VPC）中的网络资源信息。

## 多站点支持

VNet 支持三个独立站点，每个站点有独立的认证 session：

| 站点 | 环境 | SSO 来源命令 | 支持 Region 示例 |
|------|------|-------------|-----------------|
| `cn` | 公有云线上 | `bytedcli auth login --session` | cn-beijing, cn-shanghai, cn-guangzhou |
| `sdv` | BOE 开发环境 | `bytedcli --site boe auth login --session` | cn-guilin-boe, cn-ningbo-sdv |
| `sg` | 海外环境 | `bytedcli --site i18n-tt auth login --session` | ap-southeast-1, cn-hongkong, ap-southeast-3 |

## 认证方式

VNet 命令使用 SSO Session + 浏览器 Cookie 捕获进行认证：

1. 先执行对应环境的 SSO 登录：
   - 线上：`bytedcli auth login --session`
   - BOE：`bytedcli --site boe auth login --session`
   - 海外：`bytedcli --site i18n-tt auth login --session`
2. CLI 会自动使用 SSO session 兑换对应站点的 `_vnet-session` Cookie
3. 如果 session 过期，重新执行对应环境的 `auth login --session` 即可

## 命令示例

### 搜索网络资源

```bash
# 按资源 ID 搜索（默认线上 cn 站点）
bytedcli vnet search --keyword vpc-demo123

# 按 IP 地址搜索
bytedcli vnet search --keyword 10.0.0.1

# 按类型过滤
bytedcli vnet search --keyword demo --type vpc

# 搜索 BOE 开发环境资源
bytedcli vnet search --keyword demo --site sdv

# 搜索海外环境资源
bytedcli vnet search --keyword demo --site sg

# JSON 输出
bytedcli --json vnet search --keyword demo
```

### 获取资源详情

```bash
# 获取资源完整详情（默认线上 cn 站点）
bytedcli vnet get --id vpc-demo123

# 只获取概览信息
bytedcli vnet get --id vpc-demo123 --section overview

# 只获取关联资源
bytedcli vnet get --id vpc-demo123 --section related

# 查询 BOE 开发环境资源
bytedcli vnet get --id vpc-demo123 --site sdv

# 查询海外环境资源
bytedcli vnet get --id vpc-demo123 --site sg --region ap-southeast-1

# JSON 输出
bytedcli --json vnet get --id vpc-demo123
```

## 参数说明

| 参数 | 说明 |
|------|------|
| `--keyword <keyword>` | 搜索关键词（资源 ID 或 IP 地址） |
| `--type <type>` | 资源类型过滤，如 `vpc`, `subnet`, `eni`, `plb`, `clb`, `eip`, `nat`, `vpn` |
| `--id <id>` | 资源 ID（如 `vpc-xxx`, `eni-xxx`, `plb-xxx`） |
| `--section <section>` | 查询段落：`overview` \| `detail` \| `related` \| `all`（默认 `all`） |
| `--site <site>` | VNet 站点：`cn`（线上，默认）\| `sdv`（BOE 开发环境）\| `sg`（海外） |
| `--region <region>` | 地域（如 `cn-beijing`），`get` 命令省略时自动通过搜索推断 |

## 支持的资源类型

- **VPC**：私有网络
- **Subnet**：子网
- **ENI**：弹性网卡
- **PLB**：私网负载均衡
- **CLB**：公网负载均衡
- **EIP**：弹性公网 IP
- **NAT**：NAT 网关
- **VPN**：VPN 网关

## 参考文档

- [VNet 控制台](https://vnet.byted.org)
