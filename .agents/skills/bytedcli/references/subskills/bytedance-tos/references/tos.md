# TOS 命令参考

> 统一使用内部源 npx 调用：`references/invocation.md`

## 环境与站点

- `--site cn|boe|i18n|i18n-tt|eu-ttp`：切换 ByteCloud 站点（影响请求 host + `x-bcgw-vregion`）
- `tos list-sites`：从平台 meta API 拉取站点/VRegion 列表（best-effort，缓存 1 天）

## 命令

### 1) tos list-sites

列出 TOS 平台支持的站点与 VRegion（用于 UI/平台维度的环境发现）。

```bash
bytedcli tos list-sites
```

### 2) tos user-info

获取当前用户信息。

```bash
bytedcli tos user-info
```

### 3) tos list-starred-buckets

列出收藏（favorited）的 buckets。

```bash
bytedcli tos list-starred-buckets --page 1 --size 5
```

### 4) tos list-viewable-buckets

列出当前用户可访问的 buckets。

```bash
bytedcli tos list-viewable-buckets --page 1 --size 5
```

### 5) tos list-records

列出用户记录：

- `--status apply`：我的申请记录（支持 `--record-type`，默认 1）
- `--status toaudit`：待我审批记录

```bash
bytedcli tos list-records --status apply --record-type 1 --page 1 --size 5
bytedcli tos list-records --status toaudit --page 1 --size 5
```

