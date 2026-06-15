# link-self-heal.nu — ensure macOS default nushell config dir links to dotfiles.
#
# Loaded from env.nu at startup. nushell resolves its config dir from
# XDG_CONFIG_HOME; emulators that don't inject it (e.g. Terminal.app) fall back
# to "~/Library/Application Support/nushell". We symlink that fallback path to
# the dotfiles config so every launch method shares one config (starship etc.).
#
# Self-healing: any XDG-injecting launch (ghostty) runs this and (re)creates the
# link if it's missing, broken, or replaced by nushell's auto-generated default
# dir — so the next Terminal.app launch picks up the dotfiles config.

def link-self-heal [] {
    if ($env.UNAME? | default "") != "Darwin" { return }

    let src = ($env.HOME | path join "dotfiles/.config/nushell")
    let link = ($env.HOME | path join "Library/Application Support/nushell")

    # started from the fallback dir itself — nothing to link
    if $src == $link { return }

    # already the correct symlink — nothing to do
    if ($link | path exists) and (($link | path expand) == ($src | path expand)) {
        return
    }

    # missing, broken, wrong link, or nushell's auto-generated default dir:
    # drop whatever is there and (re)create the link. The fallback location only
    # ever holds nushell's own runtime files (history.txt / default stubs), never
    # real user config, so replacing it is safe.
    rm -rf $link
    mkdir ($link | path dirname)
    ^ln -s $src $link
}

link-self-heal
