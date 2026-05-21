# auto-install.nu — ensure dev dependencies present at shell startup.
#
# Loaded from config.nu after env.nu. Each tool checked at startup; missing
# tools trigger a foreground install with live output, blocking the prompt
# until done.
#
# Schema per dep:
#   tool:     binary name probed via `which`
#   manager:  one of "brew" | "cargo-git"
#   spec:     formula name (brew) or git URL (cargo-git)
#   platform: optional string — only install when $env.UNAME equals it
#             (omit / empty = any platform)
#
# Add new dep -> append a record to AUTO_INSTALL_DEPS.

const AUTO_INSTALL_DEPS = [
    { tool: "difft",       manager: "brew",      spec: "difftastic",                 platform: "Darwin" }
    { tool: "vivid",       manager: "brew",      spec: "vivid",                      platform: "Darwin" }
    { tool: "dark-notify", manager: "brew",      spec: "cormacrelf/tap/dark-notify", platform: "Darwin" }
    { tool: "nufmt",       manager: "cargo-git", spec: "https://github.com/nushell/nufmt", platform: "" }
]

def auto-install-deps [] {
    let uname = ($env.UNAME? | default "")

    for dep in $AUTO_INSTALL_DEPS {
        # platform gate (empty string = any)
        if $dep.platform != "" and $dep.platform != $uname { continue }

        # already installed?
        if (which $dep.tool | is-not-empty) { continue }

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
        }

        print $"[auto-install] ($dep.tool) missing — installing via ($dep.manager): ($dep.spec)"

        match $dep.manager {
            "brew"      => { ^brew install $dep.spec }
            "cargo-git" => { ^cargo install --git $dep.spec }
            _           => { print $"[auto-install] unknown manager: ($dep.manager)" }
        }
    }
}

auto-install-deps
