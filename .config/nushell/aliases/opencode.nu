# OpenCode aliases

# 只对 opencode 生效地重定向缓存目录到临时目录(重启即清、不持久化落盘)，
# 使其不再在 ~/.cache/opencode 下生成缓存。
# 用 --wrapped 让所有 flag 原样透传；用 with-env 只在本次调用内注入 XDG_CACHE_HOME。

def --wrapped opencode [...args] {
    with-env { XDG_CACHE_HOME: ($env.TMPDIR? | default "/tmp" | path join "oc-cache") } {
        bun --bun run opencode ...$args
    }
}

def --wrapped ttadk [...args] {
    with-env { XDG_CACHE_HOME: ($env.TMPDIR? | default "/tmp" | path join "oc-cache") } {
        bun --bun run ttadk opencode ...$args
    }
}

def --wrapped oclean [...args] {
    nu ~/.config/nushell/scripts/opencode-cleanup.nu ...$args
}
