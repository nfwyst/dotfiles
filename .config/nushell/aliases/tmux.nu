# Ghostty 主窗口手动 attach tmux:在主窗口里敲 `t` 进入,
# quick terminal 不敲就停留在 nu。
# 替代不可靠的 ghostty initial-command。
alias t = ^/opt/homebrew/bin/tmux new -A -s work
