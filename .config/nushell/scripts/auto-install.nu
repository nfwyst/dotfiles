# auto-install.nu — ensure dev dependencies present at shell startup.
#
# Loaded from config.nu after env.nu. Each tool checked at startup; missing
# tools trigger a foreground install with live output, blocking the prompt
# until done.
#
# Schema per dep:
#   tool:     binary name probed via `which`
#   manager:  one of "brew" | "cargo-git" | "swift"
#   spec:     formula name (brew), git URL (cargo-git), or repo-relative source path (swift)
#   platform: optional string — only install when $env.UNAME equals it
#             (omit / empty = any platform)
#
# Add new dep -> append a record to AUTO_INSTALL_DEPS.

def dotfiles-root [] {
    let cfg = ($nu.config-path | path expand)
    if ($cfg | path exists) {
        let cfg_dir = ($cfg | path dirname)
        if (($cfg_dir | path basename) == "scripts") {
            $cfg_dir | path dirname | path dirname | path dirname
        } else {
            $cfg_dir | path dirname | path dirname
        }
    } else {
        null
    }
}

const AUTO_INSTALL_DEPS = [
    { tool: "difft",       manager: "brew",      spec: "difftastic",                 platform: "Darwin" }
    { tool: "vivid",       manager: "brew",      spec: "vivid",                      platform: "Darwin" }
    { tool: "nufmt",       manager: "cargo-git", spec: "https://github.com/nushell/nufmt", platform: "" }
    { tool: "mo",          manager: "brew",      spec: "mole",                           platform: "Darwin" }
    { tool: "als_reader",  manager: "swift",     spec: "scripts/als_reader.swift",         platform: "Darwin" }
]

def auto-install-deps [] {
    let uname = ($env.UNAME? | default "")

    for dep in $AUTO_INSTALL_DEPS {
        # platform gate (empty string = any)
        if $dep.platform != "" and $dep.platform != $uname { continue }

        # already installed? (swift deps: skip only if binary newer-or-equal than source)
        if (which $dep.tool | is-not-empty) and $dep.manager != "swift" { continue }
        if $dep.manager == "swift" {
            let root = (dotfiles-root)
            if $root == null { continue }
            let src = ($root | path join $dep.spec)
            let bin = ($env.HOME | path join ".local" "bin" $dep.tool)
            if (which $dep.tool | is-not-empty) and ($src | path exists) and (($bin | path exists) and ((ls $bin | get 0.modified) >= (ls $src | get 0.modified))) { continue }
        }

        # manager prerequisite gate
        match $dep.manager {
            "brew" => {
                if (which brew | is-empty) {
                    print $"[auto-install] skip ($dep.tool): brew not available"
                    continue
                }
            }
            "cargo-git" => {
                if (which cargo | is-empty) {
                    print $"[auto-install] skip ($dep.tool): cargo not available"
                    continue
                }
            }
            "swift" => {
                if (which xcrun | is-empty) {
                    print $"[auto-install] skip ($dep.tool): xcrun not available"
                    continue
                }
            }
        }

        print $"[auto-install] ($dep.tool) missing — installing via ($dep.manager): ($dep.spec)"

        match $dep.manager {
            "brew"      => { ^brew install $dep.spec }
            "cargo-git" => { ^cargo install --git $dep.spec }
            "swift"     => {
                let root = (dotfiles-root)
                if $root == null {
                    print $"[auto-install] ($dep.tool): cannot resolve dotfiles root from current Nushell config"
                    continue
                }
                let src = ($root | path join $dep.spec)
                let bin_dir = ($env.HOME | path join ".local" "bin")
                mkdir $bin_dir
                if ($src | path exists) {
                    let tmp = ($bin_dir | path join $"($dep.tool).tmp-($nu.pid)")
                    ^xcrun swiftc -O -o $tmp $src
                    if ($env.LAST_EXIT_CODE? | default 0) == 0 {
                        ^mv -f $tmp ($bin_dir | path join $dep.tool)
                    } else {
                        ^rm -f $tmp
                        print $"[auto-install] ($dep.tool): compile failed, keeping existing binary"
                    }
                } else {
                    print $"[auto-install] ($dep.tool): source missing at ($src)"
                }
            }
            _           => { print $"[auto-install] unknown manager: ($dep.manager)" }
        }
    }
}

auto-install-deps
