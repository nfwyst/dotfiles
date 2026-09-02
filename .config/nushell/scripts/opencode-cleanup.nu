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

const DAY_MS = 86400000      # 毫秒/天(live 实证: session.time_updated/time_created 为毫秒, 非微秒)
const FIXPOINT_CAP = 6       # fixpoint 最大轮次, 超 cap 打 warn 非 error
def main [
    --days: int = 7        # 保留天数,删除更早的会话
    --dry-run              # 仅预览,不删除
    --no-vacuum            # 删除后跳过 VACUUM(默认删除后执行 VACUUM 回收磁盘,需独占锁)
    --status               # 仅输出 OpenCode DB / snapshot 状态,不删除
] {
    if $days < 0 {
        error make {msg: "--days must be >= 0"}
    }

    # 与 aliases/opencode.nu 一致的包装:XDG_CACHE_HOME 重定向到临时目录;
    # 支持 OPENCODE_DATA_HOME 覆盖数据目录(指向含 opencode.db 的目录),测试用,默认路径不变
    def opencode-data-override [] {
        $env.OPENCODE_DATA_HOME? | default "" | str trim
    }

    def opencode-logical-data-home [] {
        let override = (opencode-data-override)
        if ($override | is-not-empty) {
            return ($override | path expand --no-symlink)
        }

        let xdg_data_home = ($env.XDG_DATA_HOME? | default "" | str trim)
        if ($xdg_data_home | is-not-empty) {
            return ($xdg_data_home | path join "opencode" | path expand --no-symlink)
        }

        $env.HOME | path join ".local" "share" "opencode" | path expand --no-symlink
    }

    def opencode-xdg-env [] {
        let override = (opencode-data-override)
        if ($override | is-empty) {
            return {}
        }

        let data_home = (opencode-logical-data-home)
        if (($data_home | path basename) == "opencode") {
            return { XDG_DATA_HOME: ($data_home | path dirname) }
        }

        let digest = ($data_home | hash sha256)
        let wrapper_root = (($env.TMPDIR? | default "/tmp") | path join "oc-data-home" $digest)
        let wrapper_link = ($wrapper_root | path join "opencode")

        mkdir ($wrapper_root | path dirname)
        match ($wrapper_root | path type) {
            null => { mkdir $wrapper_root }
            "dir" => {}
            _ => { error make {msg: $"OpenCode data wrapper root exists but is not directory: ($wrapper_root)"} }
        }

        match ($wrapper_link | path type) {
            null => { ^ln -s $data_home $wrapper_link }
            "symlink" => {
                let link_target_res = (^readlink $wrapper_link | complete)
                let link_target = ($link_target_res.stdout | str trim)
                if $link_target != $data_home {
                    error make {msg: $"OpenCode data wrapper collision: ($wrapper_link) points to ($link_target), expected ($data_home)"}
                }
            }
            _ => { error make {msg: $"OpenCode data wrapper collision: ($wrapper_link) exists and is not symlink to ($data_home)"} }
        }

        { XDG_DATA_HOME: $wrapper_root }
    }

    def --wrapped oc [ ...args ] {
        with-env ((opencode-xdg-env) | merge {
            XDG_CACHE_HOME: ($env.TMPDIR? | default "/tmp" | path join "oc-cache")
            PATH: (["/opt/homebrew/bin"] | append ($env.PATH | split row (char esep)) | str join (char esep))
        }) {
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
        let status_sql = "SELECT 'sessions', count(*) FROM session UNION ALL SELECT 'root_sessions', count(*) FROM session WHERE parent_id IS NULL UNION ALL SELECT 'child_sessions', count(*) FROM session WHERE parent_id IS NOT NULL UNION ALL SELECT 'orphan_child_sessions', count(*) FROM session WHERE parent_id IS NOT NULL AND parent_id NOT IN (SELECT id FROM session) UNION ALL SELECT 'event_rows', count(*) FROM event UNION ALL SELECT 'orphan_event_sequences', count(*) FROM event_sequence WHERE aggregate_id NOT IN (SELECT id FROM session) UNION ALL SELECT 'freelist_count', freelist_count FROM pragma_freelist_count UNION ALL SELECT 'page_count', page_count FROM pragma_page_count UNION ALL SELECT 'page_size', page_size FROM pragma_page_size;"
        let status_res = (oc db --format tsv $status_sql | complete)
        if $status_res.exit_code != 0 {
            error make {msg: ("opencode db status failed: " + ($status_res.stderr | str trim))}
        }

        let version_res = (oc --version | complete)
        let version = if $version_res.exit_code == 0 { $version_res.stdout | str trim } else { "unknown" }
        let data_home = (opencode-logical-data-home)
        let opencode_db = ($data_home | path join "opencode.db")
        let snapshot_global = ($data_home | path join "snapshot" "global")
        let tool_output = ($data_home | path join "tool-output")
        print $"opencode_version\t($version)"
        print $status_res.stdout
        print $"opencode_db_bytes\t(storage-bytes $opencode_db)"
        print $"snapshot_global_bytes\t(storage-bytes $snapshot_global)"
        print $"tool_output_bytes\t(storage-bytes $tool_output)"
        return
    }

    def query-ids [sql: string] {
        let res = (oc db --format tsv $sql | complete)
        if $res.exit_code != 0 {
            error make {msg: ("opencode db query failed: " + ($res.stderr | str trim))}
        }
        $res.stdout | lines | skip 1 | str trim | where {|id| not ($id | is-empty)}
    }

    def count-sessions [] {
        let res = (oc db --format tsv "SELECT count(*) FROM session" | complete)
        if $res.exit_code != 0 {
            error make {msg: ("opencode db count failed: " + ($res.stderr | str trim))}
        }
        $res.stdout | lines | last | str trim | into int
    }

    def delete-one [id: string] {
        let delete_res = (oc session delete $id | complete)
        let exists_sql = ("SELECT count(*) FROM session WHERE id = '" + ($id | str replace -a "'" "''") + "'")
        let exists_res = (oc db --format tsv $exists_sql | complete)
        let survives = if $exists_res.exit_code == 0 {
            ($exists_res.stdout | lines | last | str trim | into int) != 0
        } else {
            true
        }
        # 外部并发已删容错: 删除目的是行不存在; survives=false 即达成(无论 CLI exit 如何)。
        # not_found 仅用于提示文案, 不参与 ok 判定——避免「删除失败+stderr 碰巧含 not found+行还在」被误判成功
        let not_found = (($delete_res.stderr | str lowercase) | str contains "not found")
        let ok = (not $survives)
        if $ok and $not_found and $delete_res.exit_code != 0 {
            print -e $"(ansi yellow)note: ($id) delete reported not-found but session already gone \(concurrent removal\)(ansi reset)"
        }
        if not $ok {
            let err = ($delete_res.stderr | str trim)
            let verify_err = ($exists_res.stderr | str trim)
            print $"(ansi red)FAILED: ($id) delete=($err) verify=($verify_err)(ansi reset)"
        }
        $ok
    }

    # fixpoint: 每轮重查 roots+孤儿 → 删 → 重查(删 root 使其保留的 child 变孤儿) → 至无新增, cap FIXPOINT_CAP 轮
    def run-fixpoint [roots_sql: string, orphans_sql: string] {
        mut deleted: list = []
        mut failed: list = []
        mut round = 0
        loop {
            $round += 1
            let r = (query-ids $roots_sql)
            let o = (query-ids $orphans_sql)
            if ($r | is-empty) and ($o | is-empty) { break }
            let candidates = (($r | append $o) | where {|id| $id not-in $failed})
            if ($candidates | is-empty) { break }
            for id in $candidates {
                if (delete-one $id) {
                    $deleted = ($deleted | append $id)
                } else {
                    $failed = ($failed | append $id)
                }
            }
            if $round >= $FIXPOINT_CAP {
                let remaining = (query-ids $orphans_sql)
                if ($remaining | is-empty) { break }
                print -e $"(ansi yellow)warn: fixpoint cap ($FIXPOINT_CAP) reached, ($remaining | length) orphan sessions remain \(含子树未清完\)(ansi reset)"
                break
            }
        }
        { deleted: $deleted, failed: $failed }
    }

    def dangling-orphans [] {
        let res = (oc db --format tsv "SELECT id, parent_id FROM session WHERE parent_id IS NOT NULL AND parent_id NOT IN (SELECT id FROM session) ORDER BY id" | complete)
        if $res.exit_code != 0 {
            error make {msg: ("opencode db query failed: " + ($res.stderr | str trim))}
        }
        $res.stdout
        | lines
        | skip 1
        | str trim
        | where {|l| not ($l | is-empty)}
        | each {|l|
            let cells = ($l | split row "\t")
            { id: ($cells | get 0), parent: ($cells | get 1) }
        }
    }

    # 多层校验 (b): 删除后剩余悬空 parent ⊆ (被删集合 ∪ 删除前已悬空), near-active child 报为容忍孤儿
    def check-dangling [deleted_ids: list, pre_dangling: list] {
        let rows = (dangling-orphans)
        let unexpected = ($rows | where {|r| $r.parent not-in $deleted_ids and $r.parent not-in $pre_dangling})
        if ($unexpected | length) > 0 {
            let ids = ($unexpected | each {|r| $"($r.id)<-($r.parent)"} | str join ', ')
            print -e $"(ansi yellow)warn: post-delete check found orphans with parent outside deleted subtree \(可能并发外部删除\), treated as concurrent modification: ($ids)(ansi reset)"
        }
        let tolerated = ($rows | where {|r| $r.parent in $deleted_ids})
        if ($tolerated | length) > 0 {
            let ids = ($tolerated | each {|r| $r.id} | str join ', ')
            print -e $"(ansi yellow)tolerated orphans (near-active children of deleted sessions): ($ids)(ansi reset)"
        }
    }

    let now_ms = (((date now | into int) / 1_000_000) | into int)  # 纳秒 /1e6 = 毫秒(live 实证 time_updated 毫秒)
    let cutoff_ms = ($now_ms - $days * $DAY_MS)

    # 统一守卫 time_updated < cutoff: 删除集合 = 过期 roots ∪ 过期孤儿(parent_id 悬空; 列已实证 NOT NULL, 无需 COALESCE)
    let roots_sql = "WITH RECURSIVE subtree(root_id, id, time_updated) AS (SELECT id, id, time_updated FROM session WHERE parent_id IS NULL UNION ALL SELECT subtree.root_id, child.id, child.time_updated FROM session child JOIN subtree ON child.parent_id = subtree.id), stale_roots AS (SELECT root_id FROM subtree GROUP BY root_id HAVING max(time_updated) < " + ($cutoff_ms | into string) + ") SELECT session.id FROM session JOIN stale_roots ON stale_roots.root_id = session.id ORDER BY session.time_updated, session.id;"
    let orphans_sql = "WITH RECURSIVE subtree(root_id, id, time_updated) AS (SELECT id, id, time_updated FROM session WHERE parent_id IS NOT NULL AND parent_id NOT IN (SELECT id FROM session) UNION ALL SELECT subtree.root_id, child.id, child.time_updated FROM session child JOIN subtree ON child.parent_id = subtree.id), stale_roots AS (SELECT root_id FROM subtree GROUP BY root_id HAVING max(time_updated) < " + ($cutoff_ms | into string) + ") SELECT session.id FROM session JOIN stale_roots ON stale_roots.root_id = session.id ORDER BY session.time_updated, session.id;"
    let root_ids = (query-ids $roots_sql)
    let orphan_ids = (query-ids $orphans_sql)

    if ($root_ids | is-empty) and ($orphan_ids | is-empty) {
        print $"no sessions older than ($days)d"
        return
    }

    let before = (count-sessions)
    print $"($root_ids | length) root + ($orphan_ids | length) orphan sessions older than ($days)d \(含子树\), current total: ($before)"

    if $dry_run {
        let starting_ids = ($root_ids | append $orphan_ids | uniq)
        if ($starting_ids | length) > 0 {
            # 投影级联删除面: WITH RECURSIVE 沿 parent_id 向下统计选中 roots/孤儿子树总 session 数
            let root_lits = ($starting_ids | each {|id| "'" + ($id | str replace -a "'" "''") + "'"} | str join ",")
            let subtree_sql = ("WITH RECURSIVE sub(id) AS (SELECT id FROM session WHERE id IN (" + $root_lits + ") UNION ALL SELECT s.id FROM session s JOIN sub ON s.parent_id = sub.id) SELECT count(*) FROM sub")
            let proj_res = (oc db --format tsv $subtree_sql | complete)
            if $proj_res.exit_code != 0 {
                error make {msg: ("opencode db projection query failed: " + ($proj_res.stderr | str trim))}
            }
            let subtree_total = ($proj_res.stdout | lines | last | str trim | into int)
            print $"\(含子树: ($subtree_total) sessions total\)"
        }
        print "(dry-run, nothing deleted)"
        return
    }

    let answer = (input $"delete ($root_ids | length) root + ($orphan_ids | length) orphan sessions \(含子树\)? [y/N] " | str lowercase | str trim)
    if $answer not-in ["y" "yes"] {
        print "cancelled"
        return
    }

    let pre_dangling = (query-ids "SELECT DISTINCT parent_id FROM session WHERE parent_id IS NOT NULL AND parent_id NOT IN (SELECT id FROM session)")
    let fix = (run-fixpoint $roots_sql $orphans_sql)
    check-dangling $fix.deleted $pre_dangling

    let after = (count-sessions)
    if $after > $before {
        # 并发新建: warn 降级(替换原硬 error), 跳过严格 delta 校验
        print -e $"(ansi yellow)warn: session total grew from ($before) to ($after), concurrent creation detected; strict delta check skipped(ansi reset)"
    } else {
        let removed = $before - $after
        let expected_removed = ($fix.deleted | length)
        # CLI 级联删 descendants(root 的 child 随删), removed 可 > 显式删数; 删少才是异常
        if $removed < $expected_removed {
            error make {msg: $"opencode cleanup accounting failed: removed ($removed) < deleted ($expected_removed)"}
        }
        print $"requested: ($root_ids | length) roots + ($orphan_ids | length) orphans \(含子树\); deleted: ($expected_removed) explicit; actual sessions removed: ($removed)\(含 CLI 级联\); remaining: ($after)"
    }

    if not $no_vacuum {
        print "running VACUUM (needs exclusive lock)..."
        let vacuum_res = (oc db "VACUUM;" | complete)
        if $vacuum_res.exit_code == 0 {
            print "VACUUM done"
        } else {
            let err = ($vacuum_res.stderr | str trim)
            print -e $"(ansi yellow)VACUUM failed: ($err) 可稍后空闲时手动执行 $(ansi cyan)oclean --no-vacuum 后自行 opencode db \"VACUUM;\"$(ansi reset)"
        }
    }

    if ($fix.failed | length) > 0 {
        error make {msg: $"opencode cleanup failed for ($fix.failed | length) session\(s\)"}
    }
}
