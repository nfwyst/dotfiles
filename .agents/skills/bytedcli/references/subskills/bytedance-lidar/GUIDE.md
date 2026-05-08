---
name: bytedance-lidar
description: "Operate Lidar (字节服务性能平台) via bytedcli: start Golang / Python / Nodejs instant pprof sampling, poll status, list sampling history, and download raw pprof data. Use when tasks mention Lidar, instant sampling, 即时采样, pprof, heap profile, goroutine profile, or Golang performance profiling. For C++/Java/jemalloc/off-CPU flamegraphs, use bytedance-bytedog instead."
---

# bytedcli Lidar

## 如何调用 bytedcli

先选择一种调用方式。下面所有示例默认直接写 `bytedcli`。

```bash
# 方式 1：直接用 npx 运行最新版
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest <command> [options]

# 方式 2：先全局安装，再直接调用 bytedcli
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npm install -g @bytedance-dev/bytedcli@latest
bytedcli <command> [options]
```

- 使用 `npx` 时，把后文示例里的 `bytedcli` 替换成 `NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest`
- 已全局安装时，直接按后文示例执行 `bytedcli ...`

## When to use

- 对 Golang / Python / Nodejs 服务发起即时 pprof 采样（heap / profile / goroutine / allocs / trace / ...）
- 查询 profiling_id 状态，获取火焰图 URL
- 列出最近 6h（默认）的采样历史
- 下载原始 pprof 采样数据到本地

## Do not use

- C++ / Java jemalloc / off-CPU 火焰图 → 使用 `bytedance-bytedog`
- 服务性能概览 / 每日定时采样 / 部门总览 → 直接打开 Lidar Web 页面

## 前置条件

使用 `bytedcli auth login` 完成 SSO 登录后，CLI 会自动获取 ByteCloud JWT，Lidar 命令无需手动配置认证。

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

```bash
# 发起即时 heap 采样（瞬时类型，无需 --duration）
bytedcli lidar sampling create --psm demo.psm.lidar --type heap

# 发起 profile 采样（时长类型），并等待完成后输出结果（含火焰图 URL）
bytedcli lidar sampling create --psm demo.psm.lidar --type profile --duration 30 --wait

# 查询采样状态（含火焰图 URL 和下载 URL）
bytedcli lidar sampling get --id demo.psm.lidar_202604181600_abc

# 列出最近 6h 的采样历史（默认）
bytedcli lidar sampling list --psm demo.psm.lidar

# 下载原始 pprof 采样数据到本地文件
bytedcli lidar sampling download --id demo.psm.lidar_202604181600_abc
bytedcli lidar sampling download --id demo.psm.lidar_202604181600_abc --output /tmp/heap.pb.gz

# i18n 站点（ByteIntl）
bytedcli --site i18n-bd lidar sampling create --psm demo.psm.lidar --type heap
```

## Notes

- `--type heap/goroutine/allocs/memstats/block/mutex/waitduration/dynconf` 等为瞬时类型，`--duration` 传 `-` 或省略
- `--type profile/trace/latency` 属于时长类型，需通过 `--duration` 传秒数（常用 30）
- Golang 服务需在 TCE 开启 pprof 端口，否则采样请求会失败
- `--wait` 会轮询直到采样完成或超时；超时后 profiling_id 仍有效，稍后用 `lidar sampling get --id <id>` 继续查询
- 采样有副作用，PUT 请求不自动重试；瞬时失败可手动重新发起
- 火焰图 URL 在命令输出末尾，直接粘贴到浏览器打开即可查看
- `sampling get` / `sampling create` 的输出中同时包含 `download_url`，可直接在浏览器打开下载原始 pprof 数据
- `sampling download` 通过 `lidar.bytedance.net` 独立数据域名下载，与管理 API（`cloud.bytedance.net`）域名分离
- `--begin` / `--end` 支持 `YYYY-MM-DD`、`YYYY-MM-DD HH:mm`（按本机时区解析）或 unix 秒字符串

## References

- `references/invocation.md`
- `references/lidar.md`
