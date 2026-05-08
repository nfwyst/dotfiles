# bytedcli 通用调用方式

## 执行

```bash
# 方式 1：直接用 npx 运行最新版
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest --help
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest <command> [options]

# 方式 2：先全局安装，再直接调用 bytedcli
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npm install -g @bytedance-dev/bytedcli@latest
bytedcli --help
bytedcli <command> [options]
```

- 使用 `npx` 时，把后文示例里的 `bytedcli` 替换成 `NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest`
- 已全局安装时，直接按后文示例执行 `bytedcli ...`

## 站点切换

通过全局参数 `--site` 或环境变量 `BYTEDCLI_CLOUD_SITE` 切换 ByteCloud 站点：

| 站点值 | 说明 | SSO | 备注 |
|--------|------|-----|------|
| `cn` | 国内生产（默认） | `sso.bytedance.com` | |
| `i18n-bd` | ByteIntl 国际站 | `sso.bytedance.com` | 通常复用 cn 登录态 |
| `i18n-tt` | TikTok 国际站 | `sso.tiktok-intl.com` | 需单独登录 |
| `eu-ttp` | EU TTP 站 | `sso.tiktok-intl.com` | 需单独登录 |
| `boe` | BOE 测试 | `test-sso.bytedance.net` | |

> `--site i18n-bd` 是 ByteIntl 国际站的规范站点值（`i18n` 也可用作别名）。

**认证隔离按 SSO 环境生效。`i18n-tt`、`eu-ttp`（TikTok SSO）需单独 `auth login`；`cn`、`i18n-bd`（ByteDance SSO）通常共享登录态。**

```bash
# 检查 i18n-tt 站点认证
BYTEDCLI_CLOUD_SITE=i18n-tt bytedcli auth status

# 登录 i18n-tt 站点
BYTEDCLI_CLOUD_SITE=i18n-tt bytedcli auth login
```

## JSON 输出

```bash
bytedcli --json <command> [options]
```

注意：`--json` 是全局参数，必须放在 `<command>` 前面，例如 `--json auth status`，不能写成 `auth status --json`。

## 常用全局参数

- `-j, --json`
- `-d, --debug`
- `--site <site>`
- `--socks5-proxy <url>`
- `--http-proxy <url>`
- `--tls1.2`
- `--http-timeout-ms`
- `--http-retry-count`
- `--http-retry-base-delay-ms`
- `--http-retry-max-delay-ms`
- `--http-debug`
- `--http-print <parts>`
- `--http-trace-file <path>`
- `--http-body-limit <bytes>`

HTTP trace 示例：

```bash
bytedcli --http-debug <command> [options]
bytedcli --http-print HBhbmt <command> [options]
bytedcli --http-trace-file /tmp/bytedcli.http.log --http-body-limit 4096 <command> [options]
```

`--http-print <parts>` 的 flag 含义：

- `H`: request headers
- `B`: request body
- `h`: response headers
- `b`: response body
- `m`: meta
- `t`: time
