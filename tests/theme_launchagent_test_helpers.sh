#!/usr/bin/env bash

: "${ROOT:?ROOT must be set by theme_launchagent_test.sh}"

cleanup() {
  rm -rf "$TMP_ROOT"
}

pass() {
  printf 'PASS: %s\n' "$1"
}

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  FAILURES=$((FAILURES + 1))
}

assert_contains() {
  local file=$1 expected=$2 scenario=$3
  if grep -Fq -- "$expected" "$file"; then
    pass "$scenario"
  else
    fail "$scenario (missing: $expected)"
  fi
}

assert_not_contains() {
  local file=$1 unexpected=$2 scenario=$3
  if grep -Fq -- "$unexpected" "$file"; then
    fail "$scenario (unexpected: $unexpected)"
  else
    pass "$scenario"
  fi
}

make_fake_startup_tools() {
  local home=$1 tool
  for tool in starship zoxide carapace atuin vivid; do
    cat >"$home/.local/bin/$tool" <<'SH'
#!/bin/sh
case "$(basename "$0"):$1" in
  vivid:generate) printf 'fake-colors\n' ;;
  *) printf '# fake init\n' ;;
esac
SH
    chmod +x "$home/.local/bin/$tool"
  done
}

run_env() {
  local home=$1 mode=$2 output=$3
  HOME="$home" \
    PATH="$home/.local/bin:/opt/homebrew/bin:/usr/bin:/bin" \
    FAKE_LAUNCHCTL_MODE="$mode" \
    FAKE_LAUNCHCTL_TRACE="$home/launchctl.trace" \
    FAKE_LAUNCHCTL_STATE="$home/launchctl.state" \
    DOTFILES_LAUNCHCTL="$home/.local/bin/launchctl" \
    "$NU_BIN" --env-config "$ROOT/.config/nushell/env.nu" --config /dev/null -c 'null' \
    >"$output" 2>&1
}

prepare_env_case() {
  local name=$1
  local home="$TMP_ROOT/env-$name"
  mkdir -p "$home/Library/LaunchAgents" "$home/.local/bin"
  printf 'healthy binary\n' >"$home/.local/bin/als_reader"
  chmod +x "$home/.local/bin/als_reader"
  make_fake_launchctl "$home"
  make_fake_startup_tools "$home"
  : >"$home/launchctl.trace"
  run_env "$home" setup "$home/setup.out" || true
  if ! grep -Fq "bootstrap gui/$(id -u) $home/Library/LaunchAgents/com.user.als-theme.plist" "$home/launchctl.trace"; then
    printf 'FAIL: %s fixture setup did not bootstrap current plist\n' "$name" >&2
    return 1
  fi
  : >"$home/launchctl.trace"
  printf '%s\n' "$home"
}

prepare_config_home() {
  local home=$1
  local config_root="$home/dotfiles/.config"
  mkdir -p "$config_root/delta" "$config_root/nushell" "$home/.local/state/delta" "$home/.agents" "$home/.local/bin"
  local cache
  for cache in starship zoxide carapace atuin; do
    mkdir -p "$config_root/nushell/cache/$cache"
    : >"$config_root/nushell/cache/$cache/init.nu"
  done
  ln -s "$config_root" "$home/.config"
  cp "$ROOT/.config/nushell/config.nu" "$config_root/nushell/config.nu"
  cp -R "$ROOT/.config/nushell/aliases" "$config_root/nushell/aliases"
  : >"$config_root/nushell/custom-env.nu"
  ln -s "$ROOT/.agents/bin" "$home/.agents/bin"
  cat >"$config_root/delta/themes.gitconfig" <<'EOF'
[include]
  path = ~/.local/state/delta/theme.gitconfig
EOF
  cat >"$home/.local/state/delta/theme.gitconfig" <<'EOF'
[delta "test"]
  syntax-theme = wired
EOF
  cat >"$home/test-env.nu" <<'EOF'
$env.UNAME = "Darwin"
$env.GIT_CONFIG_GLOBAL = ($env.HOME | path join "active.gitconfig")
EOF
  cp "$ROOT/.gitconfig_base" "$home/active.gitconfig"
  printf '\n[user]\n  name = preserved-user\n' >>"$home/active.gitconfig"
  make_fake_launchctl "$home"
  make_fake_startup_tools "$home"
  mkdir -p "$home/Library/LaunchAgents"
  cat >"$home/Library/LaunchAgents/com.user.als-theme.plist" <<'EOF'
<key>ALS_CONFIG_GENERATION</key>
<string>manual-test-generation</string>
EOF
  : >"$home/launchctl.trace"
}

run_config_command() {
  local home=$1 command=$2 output=$3 mode=${4:-manual-fail}
  local config_path=${5:-"$home/dotfiles/.config/nushell/config.nu"}
  HOME="$home" \
    PATH="$home/.local/bin:/opt/homebrew/bin:/usr/bin:/bin" \
    GIT_CONFIG_GLOBAL="$home/active.gitconfig" \
    FAKE_LAUNCHCTL_MODE="$mode" \
    FAKE_LAUNCHCTL_TRACE="$home/launchctl.trace" \
    DOTFILES_LAUNCHCTL="$home/.local/bin/launchctl" \
    "$NU_BIN" --env-config "$home/test-env.nu" --config "$config_path" -c "$command" \
    >"$output" 2>&1
}

wait_for_marker_count() {
  local state=$1 prefix=$2 expected=$3 deadline=$((SECONDS + 10))
  while :; do
    set -- "$state"/"$prefix"-*
    if [ -e "$1" ] && [ "$#" -eq "$expected" ]; then
      return 0
    fi
    if [ "$SECONDS" -ge "$deadline" ]; then
      return 1
    fi
    /bin/sleep 0.01
  done
}

wait_for_path() {
  local path=$1 deadline=$((SECONDS + 10))
  while [ ! -e "$path" ]; do
    if [ "$SECONDS" -ge "$deadline" ]; then
      return 1
    fi
    /bin/sleep 0.01
  done
}

BACKGROUND_JOB_TIMEOUT_SECONDS=10
BACKGROUND_JOB_GRACE_SECONDS=1
BACKGROUND_JOB_POLL_SECONDS=0.05
BACKGROUND_JOB_TREE=()

remember_background_job() {
  local candidate=$1 known
  for known in "${BACKGROUND_JOB_TREE[@]}"; do
    [ "$known" = "$candidate" ] && return
  done
  BACKGROUND_JOB_TREE+=("$candidate")
}

remember_background_job_tree() {
  local parent=$1 child
  remember_background_job "$parent"
  while IFS= read -r child; do
    [ -n "$child" ] || continue
    remember_background_job_tree "$child"
  done < <(pgrep -P "$parent" 2>/dev/null || true)
}

signal_background_job_tree() {
  local signal=$1 pid
  shift
  for pid in "$@"; do
    kill -"$signal" "$pid" 2>/dev/null || true
  done
}

background_job_tree_alive() {
  local pid
  for pid in "${BACKGROUND_JOB_TREE[@]}"; do
    kill -0 "$pid" 2>/dev/null && return 0
  done
  return 1
}

background_jobs_alive() {
  local pid
  for pid in "$@"; do
    kill -0 "$pid" 2>/dev/null && return 0
  done
  return 1
}

terminate_background_job_trees() {
  local root deadline
  BACKGROUND_JOB_TREE=()
  for root in "$@"; do
    remember_background_job_tree "$root"
  done
  signal_background_job_tree TERM "${BACKGROUND_JOB_TREE[@]}"
  deadline=$((SECONDS + BACKGROUND_JOB_GRACE_SECONDS))
  while [ "$SECONDS" -lt "$deadline" ]; do
    background_job_tree_alive || break
    for root in "$@"; do
      remember_background_job_tree "$root"
    done
    /bin/sleep "$BACKGROUND_JOB_POLL_SECONDS"
  done
  signal_background_job_tree KILL "${BACKGROUND_JOB_TREE[@]}"
}

stop_background_jobs() {
  [ "$#" -gt 0 ] || return 0
  terminate_background_job_trees "$@"
  wait "$@" 2>/dev/null || true
  BACKGROUND_JOB_TREE=()
}

wait_for_jobs() {
  local failed=0 pid status deadline=$((SECONDS + BACKGROUND_JOB_TIMEOUT_SECONDS))
  [ "$#" -gt 0 ] || return 0
  while background_jobs_alive "$@" && [ "$SECONDS" -lt "$deadline" ]; do
    /bin/sleep "$BACKGROUND_JOB_POLL_SECONDS"
  done
  if background_jobs_alive "$@"; then
    terminate_background_job_trees "$@"
  fi
  for pid in "$@"; do
    wait "$pid"
    status=$?
    [ "$status" -eq 0 ] || failed=$((failed + 1))
  done
  BACKGROUND_JOB_TREE=()
  return "$failed"
}
