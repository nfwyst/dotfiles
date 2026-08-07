#!/usr/bin/env nu
# opencode-cleanup.nu — 手动清理 opencode 过期会话
#
# 用官方 `opencode session delete`(级联回收 event/message/part,含 event_sequence),
# 并复用 aliases/opencode.nu 的包装行为(缓存重定向到 TMPDIR,不落盘 ~/.cache/opencode)。
#
# 用法:
#   nu ~/.config/nushell/scripts/opencode-cleanup.nu --dry-run    # 仅预览
#   nu ~/.config/nushell/scripts/opencode-cleanup.nu              # 删 7 天前,确认后执行
#   nu ~/.config/nushell/scripts/opencode-cleanup.nu --days 14    # 保留 14 天
#   nu ~/.config/nushell/scripts/opencode-cleanup.nu --no-vacuum # 删除后跳过 VACUUM(默认删后自动 VACUUM,需无 opencode 实例运行)
#   nu ~/.config/nushell/scripts/opencode-cleanup.nu --status    # 查看 DB / snapshot 状态,不删除

def main [
    --days: int = 7        # 保留天数,删除更早的会话
    --dry-run              # 仅预览,不删除
    --no-vacuum            # 删除后跳过 VACUUM(默认删除后执行 VACUUM 回收磁盘,需独占锁)
    --status               # 仅输出 OpenCode DB / snapshot 状态,不删除
] {
    if $days < 0 {
        error make {msg: "--days must be >= 0"}
    }

    # 与 aliases/opencode.nu 一致的包装:XDG_CACHE_HOME 重定向到临时目录
    def --wrapped oc [ ...args ] {
        with-env {
            XDG_CACHE_HOME: ($env.TMPDIR? | default "/tmp" | path join "oc-cache")
            PATH: (["/opt/homebrew/bin"] | append ($env.PATH | split row (char esep)) | str join (char esep))
        } {
            ^bun --bun run opencode ...$args
        }
    }

    def storage-bytes [path: string] {
        let du_res = (^du -sk $path | complete)
        if $du_res.exit_code != 0 {
            return 0
        }

        let kib = (
            $du_res.stdout
            | str trim
            | split row -r '\s+'
            | first
            | into int
        )
        $kib * 1024
    }

    if $status {
        let status_sql = "SELECT 'sessions', count(*) FROM session UNION ALL SELECT 'root_sessions', count(*) FROM session WHERE parent_id IS NULL UNION ALL SELECT 'child_sessions', count(*) FROM session WHERE parent_id IS NOT NULL UNION ALL SELECT 'event_rows', count(*) FROM event UNION ALL SELECT 'orphan_event_sequences', count(*) FROM event_sequence WHERE aggregate_id NOT IN (SELECT id FROM session) UNION ALL SELECT 'freelist_count', freelist_count FROM pragma_freelist_count UNION ALL SELECT 'page_count', page_count FROM pragma_page_count UNION ALL SELECT 'page_size', page_size FROM pragma_page_size;"
        let status_res = (oc db --format tsv $status_sql | complete)
        if $status_res.exit_code != 0 {
            error make {msg: ("opencode db status failed: " + ($status_res.stderr | str trim))}
        }

        let version_res = (oc --version | complete)
        let version = if $version_res.exit_code == 0 { $version_res.stdout | str trim } else { "unknown" }
        let opencode_db = ($env.HOME | path join ".local" "share" "opencode" "opencode.db")
        let snapshot_global = ($env.HOME | path join ".local" "share" "opencode" "snapshot" "global")
        let tool_output = ($env.HOME | path join ".local" "share" "opencode" "tool-output")
        print $"opencode_version\t($version)"
        print $status_res.stdout
        print $"opencode_db_bytes\t(storage-bytes $opencode_db)"
        print $"snapshot_global_bytes\t(storage-bytes $snapshot_global)"
        print $"tool_output_bytes\t(storage-bytes $tool_output)"
        return
    }

    let now_ms = ((date now | into int) / 1_000_000)
    let cutoff_ms = ($now_ms - $days * 86400000)

    let id_res = (oc db --format tsv $"SELECT id FROM session WHERE time_created < ($cutoff_ms)" | complete)
    if $id_res.exit_code != 0 {
        error make {msg: ("opencode db query failed: " + ($id_res.stderr | str trim))}
    }
    let ids = (
        $id_res.stdout
        | lines
        | skip 1
        | str trim
        | where {|id| not ($id | is-empty)}
    )

    if ($ids | is-empty) {
        print $"no sessions older than ($days)d"
        return
    }

    let before_res = (oc db "SELECT count(*) FROM session" | complete)
    if $before_res.exit_code != 0 {
        error make {msg: ("opencode db count failed: " + ($before_res.stderr | str trim))}
    }
    let before = ($before_res.stdout | lines | last | str trim | into int)
    print $"(ansi green)($ids | length)(ansi reset) sessions older than ($days)d, current total: ($before)"

    if $dry_run {
        print "(dry-run, nothing deleted)"
        return
    }

    let ans = (input $"delete ($ids | length) sessions? [y/N] " | str lowercase | str trim)
    if $ans not-in ["y" "yes"] {
        print "cancelled"
        return
    }

    let results = ($ids | each { |id|
        let delete_res = (oc session delete $id | complete)
        if $delete_res.exit_code == 0 {
            { id: $id, ok: true }
        } else {
            let err = ($delete_res.stderr | str trim)
            print $"(ansi red)FAILED: ($id) ($err)(ansi reset)"
            { id: $id, ok: false }
        }
    })

    let failed = ($results | where ok == false | length)
    let deleted = ($results | where ok == true | length)

    let after_res = (oc db "SELECT count(*) FROM session" | complete)
    if $after_res.exit_code != 0 {
        error make {msg: ("opencode db count failed: " + ($after_res.stderr | str trim))}
    }
    let after = ($after_res.stdout | lines | last | str trim | into int)
    print $"deleted ($deleted) sessions, ($failed) failed; remaining: ($after)"

    if not $no_vacuum {
        print "running VACUUM (needs exclusive lock)..."
        let vacuum_res = (oc db "VACUUM;" | complete)
        if $vacuum_res.exit_code == 0 {
            print "VACUUM done"
        } else {
            let err = ($vacuum_res.stderr | str trim)
            print $"(ansi yellow)VACUUM failed: ($err) 可稍后空闲时手动执行 $(ansi cyan)oclean --no-vacuum 后自行 opencode db \"VACUUM;\"$(ansi reset)"
        }
    }
}
