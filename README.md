# My dotfiles

This directory is dotfiles collections

## Requirements

Ensure you have the following installed on your system

- git
- stow

# Install

1. clone the repo
2. use stow to create symlinks `stow --adopt .`

# Other software

- zsh/nushell, unix shell/modern shell
- fzf, command line fuzzy finder written in go
- zoxide, shell extension to navigate your filesystem faster
- starship, cross-shell prompt for astronauts
- wezterm, terminal emulator that support multiplexer and written in rust
- nvim, better and powerful vim
- zellij, pluggable terminal workspace, with terminal multiplexer as the base feature
- difftastic, structural diff tool that understands syntax
- fnm
- kulala-fmt, convert openapi to http file by `kulala-fmt convert openapi.[yaml|yml|json]`

## tmux maintenance

The TPM, tmux-power, and tmux-which-key directories under `.config/tmux/plugins/` are pinned Git submodules. Initialize every pinned revision after cloning:

```sh
git submodule update --init --recursive
```

TPM is retained as a pinned source checkout, not used as the runtime plugin manager. Do not use TPM install, update, or clean actions for these submodules. To deliberately advance their pins, update only the named paths, then inspect the parent repository's gitlink changes before accepting them:

```sh
git submodule update --remote .config/tmux/plugins/tpm .config/tmux/plugins/tmux-power .config/tmux/plugins/tmux-which-key
git diff --submodule=log -- .config/tmux/plugins/tpm .config/tmux/plugins/tmux-power .config/tmux/plugins/tmux-which-key
```

The tracked tmux-which-key source config is `.config/tmux/tmux-which-key.yaml`; `tmux.conf` builds its generated runtime config only when that source or the pinned builder changes. The dark and light files own tmux-power palette selection and final style overrides. `tmux.conf` selects the current macOS appearance at startup or manual reload, while `als_reader` polls every 30 seconds and synchronizes live tmux servers, skipping sockets whose `@theme_mode` already matches. It discovers every user-owned socket in `/private/tmp/tmux-<uid>/`, including the default socket and named custom sockets stored there; sockets created with `tmux -S` outside that directory are not synchronized automatically.

# Other resources

[panscook](https://www.panscook.com/)
