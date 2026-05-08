---
name: bytedance-auth
description: "Operate bytedcli SSO authentication. Use when user asks to login/logout, check auth status, or fetch user info for ByteDance internal APIs."
---

# bytedcli 认证/SSO

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

- 登录/登出
- 查看登录状态或用户信息
- 获取 SSO/Bytecloud token

## 前置条件

- 使用通用调用方式：`references/invocation.md`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

```bash
bytedcli auth login
bytedcli auth login --session
bytedcli auth login --session --feishu
bytedcli auth login --session --auto
bytedcli auth login --session --session-method browser-cookie --browser vivaldi --yes
bytedcli auth login --session --session-method interactive-browser --yes
bytedcli auth export-session --out ./sample-sso-session.json
bytedcli auth import-session --from ./sample-sso-session.json
bytedcli --json auth login --begin
bytedcli --json auth login --complete <token>
bytedcli auth login --no-terminal-qr
bytedcli auth login --qr-image
bytedcli --json auth login
bytedcli auth status
bytedcli auth userinfo
bytedcli auth logout
bytedcli auth get-sso-token
bytedcli auth get-bytecloud-jwt-token
bytedcli auth get-codebase-jwt-token
```

## Notes

- 未登录会提示 `Not authenticated`
- 需要结构化输出加 `--json`（全局选项，放在子命令之前，如 `bytedcli --json auth status`）
- `auth login` 默认会显示终端二维码
- `auth login --session` 会优先复用本地已有且仍有效的浏览器态 SSO session；若不存在或已失效，再按当前站点的默认 session method 获取新的浏览器态 session，并保存到本地，供 `tce webshell` 等依赖网页登录态的能力复用
- `auth login --session --feishu` 只在 `cn` 站点可用，会切到飞书二维码 / OAuth 路径；阻塞式二维码路径会复用同一次飞书扫码，同时准备 SSO browser session 和额外的 Feishu web session
- 默认执行 `auth login --session` 时，CLI 会直接走 `qr`（保留老行为）；如果当前站点不支持 QR，交互终端下会弹出 `qr`/`browser-cookie`/`interactive-browser` 菜单让用户临时选一个，并提示下次加 `--auto` 让 CLI 自动挑一条可用路径；`qr` 在所有 site 上都可以显式尝试，但它是否可用取决于具体账号/环境，部分用户可能失败
- 显式加上 `--auto` 后，CLI 才会自动选择一条 session 登录路径：若检测到本机浏览器 cookie store，会优先尝试 `browser-cookie`；否则回退到 `qr`。在 `cn` 站点，browser-cookie miss 后会直接回退到普通 SSO `qr`；只有显式加 `--feishu` 才会走飞书扫码路径。其他站点的 `--auto` 才会继续回退到 `interactive-browser`。但在 macOS 的 JSON/非交互环境中，如果没有显式 `--yes`，CLI 会避免无提示触发 Keychain 访问，改为回退到 `qr`
- 显式选择 `browser-cookie` 时，CLI 会检测本机支持的浏览器 cookie store；如果发现多个，会继续让用户选择具体浏览器；如果只有一个，则直接使用该浏览器。显式 `browser-cookie` 失败时不会再自动回退到 `interactive-browser`；若需要这种兜底行为，请改用 `--auto`，或显式切到 `--session-method interactive-browser`。显式选择 `browser-cookie` 或 `interactive-browser` 时，CLI 会先说明即将执行的动作，再要求二次确认；在 JSON/非交互环境中，需要显式追加 `--session-method` 或 `--auto`，其中显式 `browser-cookie` / `interactive-browser` 都需要 `--yes`，而 `--browser` 只在可能同时检测到多个支持浏览器时才需要
- 如果当前环境无法直接访问本机浏览器 cookie（例如开发机、OpenClaw），可先在个人电脑导出：`auth export-session --out <path>`，再在目标环境导入：`auth import-session --from <path>`
- 对 agent/脚本，优先使用 `--json auth login --begin` 启动非阻塞登录，再用 `--json auth login --complete <token>` 轮询完成；`--complete` 未授权时会返回 pending 并立即退出
- `--json auth login --begin` 可选加 `--session` 用于 browser session 场景；它不会像阻塞式 `auth login --session` 一样继续等待并自动补完整个 device flow，但这条非阻塞链路只支持二维码方式，不支持 `--session-method browser-cookie|interactive-browser`、`--browser` 或 `--feishu`
- `auth login --no-terminal-qr` 会关闭终端二维码，并在未显式传入 `--qr-image` 时自动生成临时 PNG 路径
- `auth login --qr-image [path]` 可额外把二维码保存为 PNG；省略 path 时会自动写入系统临时目录，适合异步扫码登录流程
- `--json auth login` 会自动关闭终端二维码，并默认生成临时二维码图片，便于 agent/脚本消费 `qr_image_ready`
- **Token 按 SSO 环境缓存**（bytedance / tiktok / test 三组独立存储）
- **登录阶段**：`auth login` 根据 `--site` 推导默认 SSO（`cn`/`i18n-bd` → ByteDance；`i18n-tt` → TikTok；`boe` → BOE）。可用 `--auth-site bytedance|tiktok|test` 显式覆盖
- **API 调用阶段**：部分服务（tcc、tce、cache、scm、dkms、coral、hive 等）根据自身端点配置（jwtHost / authSite）决定使用哪个 SSO token；其余服务默认使用全局 `--site` 推导的 SSO。多数 ByteCloud 网关接受任意 SSO 的 JWT。各服务 `--help` 中会显示每个 site 推荐的 SSO
- `auth status` 显示所有 3 个 SSO 环境的 token 状态
- 跨环境自动查找：若服务需要的 SSO 环境与当前不同，系统自动从对应环境的缓存中查找（如 `--site boe dkms` 自动使用 ByteDance SSO token）
- 若本地 SSO / JWT override 不可用，`auth get-bytecloud-jwt-token` 会按 `BYTEDCLI_USER_CLOUD_JWT -> AIME_USER_CLOUD_JWT` 自动回退读取环境变量
- 操作目标站点前，先检查该站点认证状态；若 i18n-tt 未认证则先登录：

```bash
# 检查 i18n-tt 站点认证状态
BYTEDCLI_CLOUD_SITE=i18n-tt bytedcli auth status

# 登录 i18n-tt 站点
BYTEDCLI_CLOUD_SITE=i18n-tt bytedcli auth login

# 例如检查 i18n-bd 站点（通常可复用 cn 登录态）
BYTEDCLI_CLOUD_SITE=i18n-bd bytedcli auth status
```

## References

- `references/auth.md`
