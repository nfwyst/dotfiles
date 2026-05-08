# 认证/SSO

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
```

`auth login --session` 会优先复用本地已有且仍有效的 SSO browser session；只有本地 session 不可用时才会按当前站点的默认 session method 继续获取新的浏览器态 session。
`auth login --session --feishu` 只在 `cn` 站点可用，会切到飞书二维码 / OAuth 路径；阻塞式二维码路径会复用同一次飞书扫码，同时准备 SSO browser session 和额外的 Feishu web session。
默认执行 `auth login --session` 时，CLI 会直接走 `qr`（保留老行为）；如果当前站点不支持 QR，交互终端下会弹出 `qr`/`browser-cookie`/`interactive-browser` 菜单让用户临时选一个，并提示下次加 `--auto` 让 CLI 自动挑一条可用路径。`qr` 在所有 site 上都可以显式尝试，但它是否可用取决于具体账号/环境，部分用户可能失败。
显式加上 `--auto` 后，CLI 才会自动选择一条 session 登录路径：若检测到本机浏览器 cookie store，会优先尝试 `browser-cookie`；否则回退到 `qr`。在 `cn` 站点，browser-cookie miss 后会直接回退到普通 SSO `qr`；只有显式加 `--feishu` 才会走飞书扫码路径。其他站点的 `--auto` 才会继续回退到 `interactive-browser`。但在 macOS 的 JSON/非交互环境中，如果没有显式 `--yes`，CLI 会避免无提示触发 Keychain 访问，改为回退到 `qr`。
显式选择 `browser-cookie` 时，CLI 会检测本机支持的浏览器 cookie store；如果发现多个，会继续让用户选择具体浏览器；如果只有一个，则直接使用该浏览器。显式 `browser-cookie` 失败时不会再自动回退到 `interactive-browser`；若需要这种兜底行为，请改用 `--auto`，或显式切到 `--session-method interactive-browser`。显式选择 `browser-cookie` 或 `interactive-browser` 时，CLI 会先说明即将执行的动作，再要求二次确认；在 JSON/非交互环境中，需要显式追加 `--session-method` 或 `--auto`，其中显式 `browser-cookie` / `interactive-browser` 都需要 `--yes`，而 `--browser` 只在可能同时检测到多个支持浏览器时才需要。
在开发机或 OpenClaw 等无法直接读取本机浏览器 cookie 的环境，可先在个人电脑执行 `auth export-session --out <path>`，再在目标环境执行 `auth import-session --from <path>` 导入同一站点的 SSO browser session。`export-session` 依赖当前站点已有一个可复用的本地 browser session，`import-session` 会先校验导入文件与当前站点是否匹配且是否仍可用。
对 agent/脚本，优先使用 `--json auth login --begin` + `--json auth login --complete <token>`，避免阻塞等待人工扫码。`--begin` 可选加 `--session`，但这条非阻塞链路只支持二维码方式，不支持 `--session-method browser-cookie|interactive-browser`、`--browser` 或 `--feishu`。
