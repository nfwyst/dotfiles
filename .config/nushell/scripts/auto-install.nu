# auto-install.nu — ensure dev dependencies present at shell startup.
#
# Loaded from env.nu. Each tool checked at startup; missing
# tools trigger a foreground install with live output, blocking the prompt
# until done.
#
# Schema per dep:
#   tool:     binary name probed via `which`
#   manager:  one of "brew" | "cargo-git" | "swift"
#   spec:     formula name (brew) or git URL (cargo-git)
#   sources:  repo-relative source paths required for a Swift target
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
    {
        tool: "als_reader"
        manager: "swift"
        spec: "scripts/als_reader.swift"
        sources: ["scripts/als_reader.swift", "scripts/theme_sync.swift"]
        platform: "Darwin"
    }
]

def swift-source-paths [dep] {
    let root = (dotfiles-root)
    if $root == null {
        null
    } else {
        $dep.sources | each { |source| $root | path join $source }
    }
}

def swift-dep-up-to-date [dep] {
    let sources = (swift-source-paths $dep)
    if $sources == null { return true }

    let bin = ($env.HOME | path join ".local" "bin" $dep.tool)
    let sources_exist = ($sources | all { |source| $source | path exists })
    if (which $dep.tool | is-empty) or not $sources_exist or not ($bin | path exists) {
        return false
    }

    let binary_modified = (ls $bin | get 0.modified)
    $sources | all { |source| $binary_modified >= (ls $source | get 0.modified) }
}

def dep-needs-install [dep] {
    if $dep.manager == "swift" {
        not (swift-dep-up-to-date $dep)
    } else {
        which $dep.tool | is-empty
    }
}

def manager-available [dep] {
    let command = (match $dep.manager {
        "brew" => "brew"
        "cargo-git" => "cargo"
        "swift" => ($env.DOTFILES_XCRUN? | default "/usr/bin/xcrun")
        _ => null
    })
    if $command == null or (which $command | is-not-empty) { return true }

    print $"[auto-install] skip ($dep.tool): ($command) not available"
    false
}

def install-swift-dep [dep] {
    let sources = (swift-source-paths $dep)
    if $sources == null {
        print $"[auto-install] ($dep.tool): cannot resolve dotfiles root from current Nushell config"
        return
    }

    let bin_dir = ($env.HOME | path join ".local" "bin")
    let xcrun = ($env.DOTFILES_XCRUN? | default "/usr/bin/xcrun")
    mkdir $bin_dir
    if ($sources | all { |source| $source | path exists }) {
        let tmp = (mktemp -p $bin_dir $"($dep.tool).tmp-XXXXXXXX")
        let build = (do { ^$xcrun swiftc -O -o $tmp ...$sources } | complete)
        if $build.exit_code == 0 {
            ^/bin/mv -f $tmp ($bin_dir | path join $dep.tool)
        } else {
            ^/bin/rm -f $tmp
            if ($build.stderr | str trim | is-not-empty) {
                print --stderr ($build.stderr | str trim)
            }
            print $"[auto-install] ($dep.tool): compile failed, keeping existing binary"
        }
    } else {
        let missing = ($sources | where { |source| not ($source | path exists) } | str join ", ")
        print $"[auto-install] ($dep.tool): source missing at ($missing)"
    }
}

def install-dep [dep] {
    print $"[auto-install] ($dep.tool) missing — installing via ($dep.manager): ($dep.spec)"

    match $dep.manager {
        "brew" => { ^brew install $dep.spec }
        "cargo-git" => { ^cargo install --git $dep.spec }
        "swift" => { install-swift-dep $dep }
        _ => { print $"[auto-install] unknown manager: ($dep.manager)" }
    }
}

def auto-install-deps [] {
    let uname = ($env.UNAME? | default "")

    for dep in $AUTO_INSTALL_DEPS {
        # platform gate (empty string = any)
        if $dep.platform != "" and $dep.platform != $uname { continue }
        # already installed? (swift deps: skip only if binary newer-or-equal than source)
        if not (dep-needs-install $dep) { continue }
        # manager prerequisite gate
        if not (manager-available $dep) { continue }
        install-dep $dep
    }
}

auto-install-deps
