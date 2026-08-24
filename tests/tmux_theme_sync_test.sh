#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMUX_CONF="$ROOT_DIR/.config/tmux/tmux.conf"
SOCKET_DIR=""
SOCKET=""
TESTS_RUN=0
TESTS_FAILED=0

cleanup() {
    if [[ -n "$SOCKET" ]]; then
        tmux -S "$SOCKET" kill-server >/dev/null 2>&1 || true
    fi
    if [[ -n "$SOCKET_DIR" ]]; then
        rm -rf "$SOCKET_DIR"
    fi
}
trap cleanup EXIT

run_tmux() {
    tmux -S "$SOCKET" "$@"
}

check_eq() {
    local expected="$1"
    local actual="$2"
    local scenario="$3"
    TESTS_RUN=$((TESTS_RUN + 1))
    if [[ "$actual" == "$expected" ]]; then
        printf 'ok %d - %s\n' "$TESTS_RUN" "$scenario"
        return
    fi
    printf 'not ok %d - %s\nexpected: %s\nactual:   %s\n' \
        "$TESTS_RUN" "$scenario" "$expected" "$actual" >&2
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

check_contains() {
    local needle="$1"
    local haystack="$2"
    local scenario="$3"
    TESTS_RUN=$((TESTS_RUN + 1))
    if [[ "$haystack" == *"$needle"* ]]; then
        printf 'ok %d - %s\n' "$TESTS_RUN" "$scenario"
        return
    fi
    printf 'not ok %d - %s\nmissing: %s\nactual:  %s\n' \
        "$TESTS_RUN" "$scenario" "$needle" "$haystack" >&2
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

check_not_contains() {
    local needle="$1"
    local haystack="$2"
    local scenario="$3"
    TESTS_RUN=$((TESTS_RUN + 1))
    if [[ "$haystack" != *"$needle"* ]]; then
        printf 'ok %d - %s\n' "$TESTS_RUN" "$scenario"
        return
    fi
    printf 'not ok %d - %s\nunexpected: %s\n' \
        "$TESTS_RUN" "$scenario" "$needle" >&2
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

show_global() {
    run_tmux show-options -gv "$1"
}

assert_dark_theme() {
    check_eq 'dark' "$(show_global @theme_mode)" \
        'dark theme publishes its applied-mode marker'
    check_eq 'bg=#262626,fg=#626262' "$(show_global status-style)" \
        'dark status style uses tmux-power dark palette'
    check_eq 'bg=#a7c080,fg=#626262' "$(show_global mode-style)" \
        'dark mode style remains unchanged'
    check_eq '#[fg=#a7c080,bg=#3a3a3a] #W ' "$(show_global window-status-format)" \
        'dark inactive tab format remains unchanged'
    check_eq '#[fg=#262626,bg=#a7c080,bold] #W ' "$(show_global window-status-current-format)" \
        'dark active tab format remains unchanged'
    check_eq 'fg=#555555' "$(show_global pane-border-style)" \
        'dark pane border remains unchanged'
}

assert_light_theme() {
    check_eq 'light' "$(show_global @theme_mode)" \
        'light theme publishes its applied-mode marker'
    check_eq 'bg=#e8e8e8,fg=#8a8a8a' "$(show_global status-style)" \
        'light status style uses light palette'
    check_eq 'bg=#4a4a4a,fg=#e8e8e8' "$(show_global mode-style)" \
        'light mode style remains unchanged'
    check_eq '#[fg=#4a4a4a,bg=#d0d0d0] #W ' "$(show_global window-status-format)" \
        'light inactive tab format remains unchanged'
    check_eq '#[fg=#e8e8e8,bg=#4a4a4a,bold] #W ' "$(show_global window-status-current-format)" \
        'light active tab format remains unchanged'
    check_eq 'fg=#c8c8c8' "$(show_global pane-border-style)" \
        'light pane border remains unchanged'
}

SOCKET_DIR="$(mktemp -d /tmp/tmux-theme-sync-test.XXXXXX)"
SOCKET="$SOCKET_DIR/tmux.sock"
TEST_HOME="$SOCKET_DIR/home"
TPM_RUNTIME_MARKER="$SOCKET_DIR/tpm-runtime-sourced"
mkdir -p "$TEST_HOME/.config/tmux/plugins/tpm"
ln -s "$ROOT_DIR/.config/tmux/tmux-dark.conf" \
    "$ROOT_DIR/.config/tmux/tmux-light.conf" \
    "$ROOT_DIR/.config/tmux/tmux-which-key.yaml" "$TEST_HOME/.config/tmux/"
ln -s "$TMUX_CONF" "$TEST_HOME/.config/tmux/tmux.conf"
ln -s "$ROOT_DIR/.config/tmux/plugins/tmux-power" \
    "$ROOT_DIR/.config/tmux/plugins/tmux-which-key" "$TEST_HOME/.config/tmux/plugins/"
printf '#!/bin/sh\n: >"%s"\n' "$TPM_RUNTIME_MARKER" >"$TEST_HOME/.config/tmux/plugins/tpm/tpm"
chmod +x "$TEST_HOME/.config/tmux/plugins/tpm/tpm"
export HOME="$TEST_HOME"
export XDG_CONFIG_HOME="$HOME/.config"
export XDG_DATA_HOME="$HOME/.local/share"
unset TMUX_PLUGIN_MANAGER_PATH

run_tmux -f /dev/null new-session -d -s theme-sync
run_tmux bind-key I run-shell "$HOME/.config/tmux/plugins/tpm/bindings/install_plugins"
run_tmux bind-key U run-shell "$HOME/.config/tmux/plugins/tpm/bindings/update_plugins"
run_tmux bind-key M-u run-shell "$HOME/.config/tmux/plugins/tpm/bindings/clean_plugins"
run_tmux set-option -g @plugin 'alexwforsythe/tmux-which-key'
run_tmux set-environment -g TMUX_PLUGIN_MANAGER_PATH "$HOME/.config/tmux/plugins/"
run_tmux set-option -as terminal-features ',xterm*:RGB'
run_tmux set-option -as terminal-features ',xterm-ghostty:clipboard:cstyle:focus:overline:RGB:strikethrough:sync:usstyle'
run_tmux source-file "$TMUX_CONF"

prefix_bindings="$(run_tmux list-keys -T prefix)"
check_contains 'Space' "$prefix_bindings" \
    'tmux-which-key is sourced from its generated config'
check_contains 'M-p     send-prefix' "$prefix_bindings" \
    'prefix M-p forwards the prefix to nested tmux'
check_contains 'L       switch-client -l' "$prefix_bindings" \
    'last-session action has a distinct key'

features_before="$(run_tmux show-options -sv terminal-features)"
path_before="$(run_tmux show-environment -g PATH)"
check_eq '1' "$(printf '%s\n' "$features_before" | grep -Fxc 'xterm*:RGB')" \
    'reload removes duplicate legacy RGB terminal feature'
check_eq '1' "$(printf '%s\n' "$features_before" | grep -Fxc 'xterm-ghostty:clipboard:cstyle:focus:overline:RGB:strikethrough:sync:usstyle')" \
    'reload removes duplicate legacy Ghostty terminal feature'
which_key_init="$XDG_DATA_HOME/tmux/plugins/tmux-which-key/init.tmux"
which_key_mtime_before="$(stat -f %m "$which_key_init")"
sleep 1
run_tmux source-file "$TMUX_CONF"
features_after="$(run_tmux show-options -sv terminal-features)"
path_after="$(run_tmux show-environment -g PATH)"
which_key_mtime_after="$(stat -f %m "$which_key_init")"
check_eq "$features_before" "$features_after" \
    'reload does not append terminal features'
check_eq "$path_before" "$path_after" \
    'reload does not prepend PATH again'
check_eq "$which_key_mtime_before" "$which_key_mtime_after" \
    'reload does not rebuild unchanged which-key config'

prefix_bindings="$(run_tmux list-keys -T prefix)"
which_key_options="$(run_tmux show-options -g)"
check_not_contains 'plugins/tpm/bindings/install_plugins' "$prefix_bindings$which_key_options" \
    'submodule plugins expose no TPM install action'
check_not_contains 'plugins/tpm/bindings/update_plugins' "$prefix_bindings$which_key_options" \
    'submodule plugins expose no TPM update action'
check_not_contains 'plugins/tpm/bindings/clean_plugins' "$prefix_bindings$which_key_options" \
    'submodule plugins expose no TPM clean action'
check_eq '' "$(run_tmux show-options -gqv @plugin)" \
    'reload clears stale TPM plugin declarations'
check_eq '' "$(run_tmux show-environment -g TMUX_PLUGIN_MANAGER_PATH 2>/dev/null || true)" \
    'reload clears stale TPM manager path'
if [[ -e "$TPM_RUNTIME_MARKER" ]]; then tpm_runtime_state=called; else tpm_runtime_state=idle; fi
check_eq 'idle' "$tpm_runtime_state" 'reload does not source TPM runtime'
check_contains '#S' "$(show_global status-left)" \
    'tmux-power is sourced from its pinned submodule'

reload_alias="$(show_global 'command-alias[202]')"
check_contains "\$HOME/.config/tmux/tmux.conf" "$reload_alias" \
    'which-key reload alias targets the XDG tmux config'
if reload_error="$(run_tmux reload-config 2>&1)"; then
    reload_result=0
else
    reload_result=$?
fi
check_eq '0' "$reload_result" 'which-key reload alias succeeds'
check_not_contains 'No such file or directory' "$reload_error" \
    'which-key reload alias finds the XDG tmux config'

run_tmux source-file "$ROOT_DIR/.config/tmux/tmux-dark.conf"
assert_dark_theme
run_tmux source-file "$ROOT_DIR/.config/tmux/tmux-light.conf"
assert_light_theme
run_tmux source-file "$ROOT_DIR/.config/tmux/tmux-dark.conf"
assert_dark_theme

printf '1..%d\n' "$TESTS_RUN"
if ((TESTS_FAILED > 0)); then
    printf '%d test(s) failed\n' "$TESTS_FAILED" >&2
    exit 1
fi
