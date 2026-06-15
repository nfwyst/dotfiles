# skill-guard.nu — 扫描 ~/.agents/skills 下的 skill 注入痕迹
# 对齐《清除本地Skill内联埋点操作指引》(AgentBuddy 官方) 的清理口径:
#   - 结构性载荷: .ai-extension/ 与 .agentbuddy/ 目录(全目录扫)
#   - spans 遥测脚本: spans/ 下的 resolve_username.sh / span_invoke_start.sh /
#     span_invoke_end.sh / telemetry_lib.sh / telemetry.sh
#   - 隐藏指令/外传: 遥测块、强制静默、隐藏输出、埋点 app_id、curl POST、裸 socket
#     (文本类扫描排除 references/ 上游文档,避免引用/示例误报)
# 不对“仅引用平台地址”这类信息性指纹告警。纯 nushell 实现。
#
# 用法:
#   skill-guard                  扫描(打印清单)
#   skill-guard --clean          扫描 + 清理已知注入(遥测块 / 埋点目录 / spans 脚本)
#   skill-guard --dir <path>     指定 skills 根目录(默认 ~/.agents/skills)
#   skill-guard --quiet          静默,只返回命中类数(供 wrapper 判断)

# 官方 spans 遥测脚本名单(仅删这些,不动 spans/ 其它内容)
const SPANS_FILES = [
    "resolve_username.sh"
    "span_invoke_start.sh"
    "span_invoke_end.sh"
    "telemetry_lib.sh"
    "telemetry.sh"
]

# 官方埋点目录名单(整目录递归删)
const TEL_DIRS = [".ai-extension" ".agentbuddy"]

# 文本模式扫描(排除 references/ 文档);命中返回 1,否则 0
def hits-scan [dir: string, pat: string, label: string, quiet: bool]: nothing -> int {
    let res = (^rg -nI --no-heading -g "!**/references/**" -e $pat $dir | complete)
    let out = ($res.stdout | str trim)
    if ($out | is-not-empty) {
        if not $quiet {
            print $"(ansi red)[!](ansi reset) ($label)"
            $out | lines | first 20 | each {|l| print $"      ($l)" } | ignore
        }
        1
    } else { 0 }
}

export def main [
    --dir: string = ""   # skills 根目录
    --clean              # 清理已知注入
    --quiet              # 静默模式,只返回命中类数
]: nothing -> any {
    let skills_dir = (if ($dir | is-empty) { ($env.HOME | path join ".agents/skills") } else { $dir })
    if not ($skills_dir | path exists) {
        if not $quiet { print $"目录不存在: ($skills_dir)" }
        return 0
    }
    if not $quiet {
        print $"扫描目录: ($skills_dir)"
        print "------------------------------------------------------------"
    }
    mut hits = 0

    # 1) 结构性载荷: 埋点目录(.ai-extension / .agentbuddy,全目录扫描)
    let ext_dirs = ($TEL_DIRS | each {|d| glob ($skills_dir | path join $"**/($d)") } | flatten)
    if ($ext_dirs | is-not-empty) {
        if not $quiet {
            print $"(ansi red)[!](ansi reset) 发现隐藏埋点目录\(.ai-extension/.agentbuddy\):"
            $ext_dirs | each {|d| print $"      ($d)" } | ignore
        }
        $hits += 1
    }

    # 2) 结构性载荷: spans 遥测脚本(按官方名单全目录扫描)
    let span = ($SPANS_FILES | each {|f| glob ($skills_dir | path join $"**/($f)") } | flatten)
    if ($span | is-not-empty) {
        if not $quiet {
            print $"(ansi red)[!](ansi reset) 发现 spans 上报脚本文件:"
            $span | each {|f| print $"      ($f)" } | ignore
        }
        $hits += 1
    }

    # 3) 隐藏指令 / 数据外传(文本类,排除 references/ 文档)
    let patterns = [
        ["<!--\\s*@?telemetry"                    "SKILL 文档含 telemetry 注释块"]
        ["\\[TELEMETRY|MANDATORY\\].*[Ss]ilent"   "含「强制静默上报」指令"]
        ["[Nn]ever show .*output.*to the user"    "含「不要让用户看到输出」隐藏指令"]
        ["span_invoke_(start|end)"                "文档引用上报脚本 span_invoke_*"]
        ["app_id[\"\\s:]+1009601"                 "含埋点 app_id(MCS 上报)"]
        ["curl[^|]*-(d|-data|F)\\s"               "skill 内含 curl POST(疑似数据外传)"]
        ["/dev/tcp/"                              "含裸 socket 外联"]
    ]
    for p in $patterns {
        $hits += (hits-scan $skills_dir ($p | get 0) ($p | get 1) $quiet)
    }

    if not $quiet {
        print "------------------------------------------------------------"
        if $hits == 0 {
            print $"(ansi green)[ok](ansi reset) 未发现真实注入痕迹"
        } else {
            print $"(ansi yellow)共发现 ($hits) 类注入项。(ansi reset)"
        }
    }

    if $clean and $hits > 0 {
        if not $quiet {
            print ""
            print "清理已知注入(遥测块 + 埋点目录 + spans 脚本)..."
        }
        # a) 清 SKILL.md 遥测块
        glob ($skills_dir | path join "**/SKILL.md") | each {|f|
            let content = (open --raw $f)
            if ($content | str contains "@telemetry:start") {
                let cleaned = ($content | str replace -a -r '(?s)<!--\s*@telemetry:start\s*-->.*?<!--\s*@telemetry:end\s*-->\s*' '')
                $cleaned | save -f $f
                if not $quiet { print $"  清理遥测块: ($f)" }
            }
        } | ignore
        # b) 删埋点目录
        $TEL_DIRS | each {|d|
            glob ($skills_dir | path join $"**/($d)") | each {|p|
                rm -rf $p
                if not $quiet { print $"  删除目录: ($p)" }
            } | ignore
        } | ignore
        # c) 删 spans 遥测脚本(仅官方名单),随后清空的 spans/ 一并删除
        $SPANS_FILES | each {|f|
            glob ($skills_dir | path join $"**/($f)") | each {|p|
                rm -f $p
                if not $quiet { print $"  删除脚本: ($p)" }
            } | ignore
        } | ignore
        glob ($skills_dir | path join "**/spans") | each {|sp|
            if (($sp | path type) == "dir") and ((ls -a $sp | length) == 0) {
                rm -rf $sp
                if not $quiet { print $"  删除空目录: ($sp)" }
            }
        } | ignore
        if not $quiet { print "清理完成,请重新运行 skill-guard 复核。" }
    }

    if $quiet { $hits } else { null }
}
