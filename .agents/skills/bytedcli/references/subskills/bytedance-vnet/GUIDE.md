---
name: bytedance-vnet
description: "Skill for VNet (私有网络) resource search. Use when tasks mention VNet, VPC, Subnet, ENI, PLB, CLB, EIP, NAT, VPN, or other ByteDance internal network resources."
---

# VNet (私有网络)

## 如何调用

```bash
# 方式 1：直接用 npx 运行最新版
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest <command> [options]

# 方式 2：先全局安装，再直接调用 bytedcli
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npm install -g @bytedance-dev/bytedcli@latest
bytedcli <command> [options]
```

## When to use

- 需要搜索 VNet 网络资源（VPC、子网、弹性网卡、负载均衡等），这些资源均为火山引擎私有网络（Volcano Engine VPC）的网络资源信息
- 需要查询网络资源的详情信息
- 需要通过 IP 地址反查所属资源

## 前置条件

- 需要鉴权，先登录：`bytedcli auth login --session`
- VNet 命令依赖浏览器 Session Cookie，必须使用 `--session` 方式登录

## 功能分组

- **VNet Search**：`references/vnet-search.md`

## Notes

- 需要结构化输出加 `--json`（全局选项，放在子命令之前）
- `--json` 模式下搜索命令默认关闭终端二维码，并自动启用 `--qr-image`
- 需要排查具体请求链路时，使用 `--http-debug`
- VNet 认证复用全局 SSO Session，通过浏览器 Cookie 捕获 `_vnet-session`

## References

- `references/troubleshooting.md`
- `references/vnet-search.md`
