#!/usr/bin/env bash

test_delta_include_migration() {
  local home="$TMP_ROOT/delta" output="$TMP_ROOT/delta/config.out" marker total canonical legacy unrelated expected_include company_include
  prepare_config_home "$home"
  expected_include=$(cd "$home/.config/delta" && pwd -P)/themes.gitconfig
  # Git stores these include paths with a literal tilde.
  # shellcheck disable=SC2088
  company_include='~/.config/company.gitconfig'
  cat >"$home/.config/company.gitconfig" <<'EOF'
[company]
  sentinel = preserved
EOF
  cat >"$home/.local/bin/git" <<'SH'
#!/bin/sh
printf '%s\n' "$*" >>"$HOME/path-git.trace"
exec /usr/bin/git "$@"
SH
  chmod +x "$home/.local/bin/git"
  HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --unset-all include.path
  HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --add include.path "$company_include"
  # shellcheck disable=SC2088
  HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --add include.path '~/.config/delta/themes.gitconfig'
  run_config_command "$home" null "$output" || fail "first isolated config startup succeeds"
  run_config_command "$home" null "$output" || fail "second isolated config startup succeeds"
  run_config_command "$home" null "$output" || fail "third isolated config startup succeeds"
  total=$(HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --get-all include.path | wc -l | tr -d ' ')
  marker=$(HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --get-all include.path)
  canonical=$(printf '%s\n' "$marker" | grep -Fxc "$expected_include" || true)
  # shellcheck disable=SC2088
  legacy=$(printf '%s\n' "$marker" | grep -Fxc '~/.config/delta/themes.gitconfig' || true)
  unrelated=$(printf '%s\n' "$marker" | grep -Fxc "$company_include" || true)
  if [ "$total" = 2 ] && [ "$canonical" = 1 ] && [ "$legacy" = 0 ] && [ "$unrelated" = 1 ]; then
    pass "Delta includes converge while unrelated include is preserved (total=2 canonical=1 legacy=0 unrelated=1)"
  else
    fail "Delta includes converge while unrelated include is preserved (total=$total canonical=$canonical legacy=$legacy unrelated=$unrelated got: ${marker//$'\n'/,})"
  fi
  if [ ! -e "$home/path-git.trace" ]; then
    pass "config startup ignores PATH-preceding git"
  else
    fail "config startup ignores PATH-preceding git"
  fi
  marker=$(HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --includes --get delta.test.syntax-theme 2>/dev/null || true)
  if [ "$marker" = wired ]; then
    pass "active GIT_CONFIG_GLOBAL includes delta themes"
  else
    fail "active GIT_CONFIG_GLOBAL includes delta themes (got: ${marker:-empty})"
  fi
  marker=$(HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --includes --get company.sentinel 2>/dev/null || true)
  if [ "$marker" = preserved ]; then
    pass "unrelated company include remains readable"
  else
    fail "unrelated company include remains readable (got: ${marker:-empty})"
  fi
  if [ "$(HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --get user.name)" = preserved-user ]; then
    pass "serial config loads preserve user entries"
  else
    fail "serial config loads preserve user entries"
  fi
  if [ -e "$home/active.gitconfig.lock" ]; then
    fail "serial config loads leave no lock file"
  else
    pass "serial config loads leave no lock file"
  fi
  marker=$(HOME="$home" /usr/bin/git config --file "$ROOT/.gitconfig_base" --get-all include.path 2>/dev/null || true)
  # Git stores this include path with a literal tilde.
  # shellcheck disable=SC2088
  if [ "$marker" = '~/.config/delta/themes.gitconfig' ]; then
    pass "base git config has only the theme catalog include"
  else
    fail "base git config has only the theme catalog include (got: ${marker:-empty})"
  fi
  marker=$(HOME="$home" /usr/bin/git config --file "$ROOT/.gitconfig_base" --includes --get delta.test.syntax-theme 2>/dev/null || true)
  if [ "$marker" = wired ]; then
    pass "base git config reaches dynamic selector through theme catalog"
  else
    fail "base git config reaches dynamic selector through theme catalog (got: ${marker:-empty})"
  fi
}

test_concurrent_config_startup() {
  local home="$TMP_ROOT/concurrent" total canonical legacy unrelated expected_include company_include failed marker pid run
  local -a pids=()
  prepare_config_home "$home"
  expected_include=$(cd "$home/.config/delta" && pwd -P)/themes.gitconfig
  # Git stores these include paths with a literal tilde.
  # shellcheck disable=SC2088
  company_include='~/.config/company.gitconfig'
  cat >"$home/.config/company.gitconfig" <<'EOF'
[company]
  sentinel = preserved
EOF
  HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --unset-all include.path
  HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --add include.path "$company_include"
  # shellcheck disable=SC2088
  HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --add include.path '~/.config/delta/themes.gitconfig'
  HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --add include.path "$expected_include"
  HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --add include.path "$expected_include"
  for run in {1..4}; do
    run_config_command "$home" null "$home/run-$run.out" healthy &
    pids+=("$!")
  done
  wait_for_jobs "${pids[@]}"
  failed=$?
  if [ "$failed" -eq 0 ]; then
    pass "four concurrent config loads all exit successfully"
  else
    fail "four concurrent config loads all exit successfully (failed: $failed)"
  fi
  total=$(HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --get-all include.path | wc -l | tr -d ' ')
  marker=$(HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --get-all include.path)
  canonical=$(printf '%s\n' "$marker" | grep -Fxc "$expected_include" || true)
  # shellcheck disable=SC2088
  legacy=$(printf '%s\n' "$marker" | grep -Fxc '~/.config/delta/themes.gitconfig' || true)
  unrelated=$(printf '%s\n' "$marker" | grep -Fxc "$company_include" || true)
  if [ "$total" = 2 ] && [ "$canonical" = 1 ] && [ "$legacy" = 0 ] && [ "$unrelated" = 1 ]; then
    pass "concurrent config loads converge Delta includes and preserve unrelated include (total=2 canonical=1 legacy=0 unrelated=1)"
  else
    fail "concurrent config loads converge Delta includes and preserve unrelated include (total=$total canonical=$canonical legacy=$legacy unrelated=$unrelated got: ${marker//$'\n'/,})"
  fi
  if [ -e "$home/active.gitconfig.lock" ]; then
    fail "concurrent config loads leave no lock file"
  else
    pass "concurrent config loads leave no lock file"
  fi
  if [ "$(HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --get user.name)" = preserved-user ]; then
    pass "concurrent config loads preserve user entries"
  else
    fail "concurrent config loads preserve user entries"
  fi
  if [ "$(HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --includes --get company.sentinel 2>/dev/null || true)" = preserved ]; then
    pass "concurrent config loads keep unrelated company include readable"
  else
    fail "concurrent config loads keep unrelated company include readable"
  fi
  if [ "$(HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --includes --get delta.test.syntax-theme 2>/dev/null || true)" = wired ]; then
    pass "concurrent config loads keep Delta include wired"
  else
    fail "concurrent config loads keep Delta include wired"
  fi
  if [ "$(HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --get core.pager)" = delta ] \
      && [ "$(HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --get interactive.diffFilter)" = 'delta --color-only' ] \
      && [ "$(HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --get delta.navigate)" = true ] \
      && [ "$(HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --get merge.conflictStyle)" = zdiff3 ] \
      && [ "$(HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --get merge.tool)" = nvimdiff ]; then
    pass "concurrent config loads install all required scalar Git settings"
  else
    fail "concurrent config loads install all required scalar Git settings"
  fi
}

seed_expected_git_scalars() {
  local home=$1
  HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global core.pager delta
  HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global interactive.diffFilter 'delta --color-only'
  HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global delta.navigate true
  HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global merge.conflictStyle zdiff3
  HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global merge.tool nvimdiff
}

test_git_executable_override_rejected() {
  local home="$TMP_ROOT/git-override-rejected" output
  prepare_config_home "$home"
  output="$home/output"
  cat >"$home/.local/bin/git" <<'SH'
#!/bin/sh
printf '%s\n' "$*" >>"$HOME/path-git.trace"
exit 99
SH
  chmod +x "$home/.local/bin/git"
  make_fake_git "$home"
  printf 'non-lock-failure\n' >"$home/git.mode"
  if DOTFILES_TEST_GIT="$home/.local/bin/git-control" run_config_command "$home" null "$output"; then
    pass "Git executable environment override is rejected"
  else
    fail "Git executable environment override is rejected"
  fi
  if [ ! -e "$home/git.trace" ]; then
    pass "Git executable environment override is never invoked"
  else
    fail "Git executable environment override is never invoked"
  fi
  if [ ! -e "$home/path-git.trace" ]; then
    pass "Git setup ignores PATH-preceding executable during override attack"
  else
    fail "Git setup ignores PATH-preceding executable during override attack"
  fi
}

make_fake_git() {
  local home=$1
  cat >"$home/.local/bin/git-control" <<'SH'
#!/bin/sh
printf '%s\n' "$*" >>"$HOME/git.trace"
case " $* " in
  *" --get-all include.path"*)
    if [ "$(cat "$HOME/git.mode")" = read-failure ]; then
      printf 'forced Git config read failure\n' >&2
      exit 1
    fi
    ;;
  *" --replace-all include.path"*)
    count=0
    [ ! -f "$HOME/git-write-count" ] || count=$(cat "$HOME/git-write-count")
    count=$((count + 1))
    printf '%s\n' "$count" >"$HOME/git-write-count"
    case "$(cat "$HOME/git.mode")" in
      retry-success)
        failures=$(cat "$HOME/git-lock-failures")
        if [ "$count" -le "$failures" ]; then
          printf 'error: could not lock config file: deterministic contention\n' >&2
          exit 255
        fi
        ;;
      lock-exhaustion)
        printf 'error: could not lock config file: deterministic exhaustion\n' >&2
        exit 255
        ;;
      non-lock-failure)
        printf 'forced non-lock Git config write failure\n' >&2
        exit 23
        ;;
    esac
    ;;
esac
exec /usr/bin/git "$@"
SH
  chmod +x "$home/.local/bin/git-control"
}

make_git_control_config() {
  local home=$1 git_bin=$2
  local source="$home/dotfiles/.config/nushell/config.nu"
  local fixture="$home/dotfiles/.config/nushell/git-control-config.nu"
  local replacement_count
  if [ "$(grep -Fc '"/usr/bin/git"' "$source")" -ne 2 ]; then
    echo 'expected exactly two trusted Git path literals in config fixture source' >&2
    return 1
  fi
  /usr/bin/sed "s|\"/usr/bin/git\"|\"$git_bin\"|g" "$source" >"$fixture"
  replacement_count=$(grep -Fc "let git = \"$git_bin\"" "$fixture")
  if [ "$replacement_count" -ne 2 ] || grep -Fq '"/usr/bin/git"' "$fixture"; then
    echo 'failed to create isolated Git control config fixture' >&2
    return 1
  fi
}

prepare_git_control_case() {
  local name=$1 mode=$2
  local home="$TMP_ROOT/git-$name"
  prepare_config_home "$home"
  seed_expected_git_scalars "$home"
  HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --unset-all include.path
  printf '%s\n' "$mode" >"$home/git.mode"
  make_fake_git "$home"
  make_git_control_config "$home" "$home/.local/bin/git-control" || return
  printf '%s\n' "$home"
}

assert_managed_include_state() {
  local home=$1 scenario=$2 expected_include marker canonical legacy unrelated
  expected_include=$(cd "$home/.config/delta" && pwd -P)/themes.gitconfig
  marker=$(HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --get-all include.path)
  canonical=$(printf '%s\n' "$marker" | grep -Fxc "$expected_include" || true)
  # shellcheck disable=SC2088
  legacy=$(printf '%s\n' "$marker" | grep -Fxc '~/.config/delta/themes.gitconfig' || true)
  # shellcheck disable=SC2088
  unrelated=$(printf '%s\n' "$marker" | grep -Fxc '~/.config/company.gitconfig' || true)
  if [ "$canonical" = 1 ] && [ "$legacy" = 0 ] && [ "$unrelated" = 1 ]; then
    pass "$scenario"
  else
    fail "$scenario (canonical=$canonical legacy=$legacy unrelated=$unrelated)"
  fi
}

test_git_config_retry_success() {
  local home output expected_include
  home=$(prepare_git_control_case retry-success retry-success)
  output="$home/output"
  expected_include=$(cd "$home/.config/delta" && pwd -P)/themes.gitconfig
  # shellcheck disable=SC2088
  HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --add include.path '~/.config/company.gitconfig'
  # shellcheck disable=SC2088
  HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --add include.path '~/.config/delta/themes.gitconfig'
  HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --add include.path "$expected_include"
  printf '4\n' >"$home/git-lock-failures"
  if run_config_command "$home" null "$output" manual-fail "$home/dotfiles/.config/nushell/git-control-config.nu"; then
    pass "fifth include write success receives terminal convergence budget"
  else
    fail "fifth include write success receives terminal convergence budget"
  fi
  if [ "$(cat "$home/git-write-count" 2>/dev/null || printf 0)" = 6 ]; then
    pass "lock retry success performs four failures and two state transitions"
  else
    fail "lock retry success performs four failures and two state transitions"
  fi
  assert_not_contains "$output" "did not converge" "fifth successful write does not report false non-convergence"
  assert_managed_include_state "$home" "retry success converges managed includes and preserves unrelated include"
}

test_git_config_lock_exhaustion() {
  local home output
  home=$(prepare_git_control_case lock-exhaustion lock-exhaustion)
  output="$home/output"
  # shellcheck disable=SC2088
  HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --add include.path '~/.config/delta/themes.gitconfig'
  if run_config_command "$home" null "$output" manual-fail "$home/dotfiles/.config/nushell/git-control-config.nu"; then
    fail "persistent Git lock exits nonzero"
  else
    pass "persistent Git lock exits nonzero"
  fi
  assert_contains "$output" "deterministic exhaustion" "persistent Git lock reports explicit failure"
  if [ "$(cat "$home/git-write-count" 2>/dev/null || printf 0)" = 5 ]; then
    pass "persistent Git lock consumes bounded five-write budget"
  else
    fail "persistent Git lock consumes bounded five-write budget"
  fi
}

test_git_config_non_lock_failure() {
  local home output
  home=$(prepare_git_control_case non-lock non-lock-failure)
  output="$home/output"
  # shellcheck disable=SC2088
  HOME="$home" GIT_CONFIG_GLOBAL="$home/active.gitconfig" /usr/bin/git config --global --add include.path '~/.config/delta/themes.gitconfig'
  if run_config_command "$home" null "$output" manual-fail "$home/dotfiles/.config/nushell/git-control-config.nu"; then
    fail "non-lock Git write failure exits nonzero"
  else
    pass "non-lock Git write failure exits nonzero"
  fi
  assert_contains "$output" "forced non-lock Git config write" "non-lock Git write failure keeps original detail"
  if [ "$(cat "$home/git-write-count" 2>/dev/null || printf 0)" = 1 ]; then
    pass "non-lock Git write failure does not retry"
  else
    fail "non-lock Git write failure does not retry"
  fi
}

test_git_config_read_failure() {
  local home output
  home=$(prepare_git_control_case read-failure read-failure)
  output="$home/output"
  if run_config_command "$home" null "$output" manual-fail "$home/dotfiles/.config/nushell/git-control-config.nu"; then
    fail "Git config read failure exits nonzero"
  else
    pass "Git config read failure exits nonzero"
  fi
  assert_contains "$output" "forced Git config read" "Git config read failure preserves original detail"
  if grep -Fq -- '--replace-all include.path' "$home/git.trace"; then
    fail "Git config read failure stops before write"
  else
    pass "Git config read failure stops before write"
  fi
}

test_git_config_missing_key() {
  local home output
  home=$(prepare_git_control_case missing-key pass)
  output="$home/output"
  if run_config_command "$home" null "$output" manual-fail "$home/dotfiles/.config/nushell/git-control-config.nu"; then
    pass "missing Git config key is treated as empty"
  else
    fail "missing Git config key is treated as empty"
  fi
}

test_delta_include() {
  test_delta_include_migration
  test_git_executable_override_rejected
  test_git_config_retry_success
  test_git_config_lock_exhaustion
  test_git_config_non_lock_failure
  test_git_config_read_failure
  test_git_config_missing_key
}

make_failing_xcrun() {
  local home=$1
  cat >"$home/.local/bin/xcrun" <<'SH'
#!/bin/sh
output=
while [ "$#" -gt 0 ]; do
  if [ "$1" = -o ]; then
    shift
    output=$1
    break
  fi
  shift
done
printf 'partial binary\n' >"$output"
printf 'forced swiftc failure\n' >&2
exit 42
SH
  chmod +x "$home/.local/bin/xcrun"
}

make_successful_xcrun() {
  local home=$1
  cat >"$home/.local/bin/xcrun" <<'SH'
#!/bin/sh
output=
printf '%s\n' "$@" >"$HOME/xcrun.argv"
while [ "$#" -gt 0 ]; do
  if [ "$1" = -o ]; then
    shift
    output=$1
    break
  fi
  shift
done
if [ -f "$output" ] && [ ! -L "$output" ]; then
  printf 'stage=exclusive\n' >>"$HOME/build.trace"
else
  printf 'stage=unreserved\n' >>"$HOME/build.trace"
fi
printf 'new binary\n' >"$output"
chmod +x "$output"
printf 'target=%s\n' "$output" >>"$HOME/build.trace"
printf 'previous=%s\n' "$(cat "$HOME/.local/bin/als_reader")" >>"$HOME/build.trace"
SH
  chmod +x "$home/.local/bin/xcrun"
}

prepare_compile_case() {
  local name=$1
  local home="$TMP_ROOT/compile-$name"
  mkdir -p "$home/dotfiles/.config/nushell/scripts" "$home/dotfiles/scripts" "$home/.local/bin"
  cp "$ROOT/.config/nushell/scripts/auto-install.nu" "$home/dotfiles/.config/nushell/scripts/auto-install.nu"
  if [ "$(grep -Fc '"/usr/bin/xcrun"' "$home/dotfiles/.config/nushell/scripts/auto-install.nu")" -ne 2 ]; then
    echo 'expected exactly two trusted xcrun path literals in auto-install.nu source' >&2
    return 1
  fi
  /usr/bin/sed -i '' "s|\"/usr/bin/xcrun\"|\"$home/.local/bin/xcrun\"|g" "$home/dotfiles/.config/nushell/scripts/auto-install.nu"
  cp "$ROOT/scripts/als_reader.swift" "$ROOT/scripts/theme_sync.swift" "$home/dotfiles/scripts/"
  printf 'old binary\n' >"$home/.local/bin/als_reader"
  chmod +x "$home/.local/bin/als_reader"
  for tool in mv rm; do
    cat >"$home/.local/bin/$tool" <<'SH'
#!/bin/sh
printf '%s %s\n' "$(basename "$0")" "$*" >>"$HOME/path-tools.trace"
exit 99
SH
    chmod +x "$home/.local/bin/$tool"
  done
  touch -t 202001010000 "$home/dotfiles/scripts/als_reader.swift" "$home/dotfiles/scripts/theme_sync.swift"
  touch -t 202001020000 "$home/.local/bin/als_reader"
  printf '%s\n' "\$env.UNAME = \"Darwin\"" >"$home/test-env.nu"
  printf '%s\n' "$home"
}

run_compile_case() {
  local home=$1 output=$2
  HOME="$home" PATH="$home/.local/bin:/usr/bin:/bin" \
    "$NU_BIN" --env-config "$home/test-env.nu" \
    --config "$home/dotfiles/.config/nushell/scripts/auto-install.nu" -c null \
    >"$output" 2>&1
}

assert_compile_source_arguments() {
  local home=$1 expected_argv
  expected_argv=$(printf '%s\n' \
    swiftc \
    -O \
    -o \
    "$(sed -n '4p' "$home/xcrun.argv")" \
    "$(cd "$home/dotfiles/scripts" && pwd -P)/als_reader.swift" \
    "$(cd "$home/dotfiles/scripts" && pwd -P)/theme_sync.swift")
  if [ "$(cat "$home/xcrun.argv")" = "$expected_argv" ]; then
    pass "swift compiler argv contains ordered als_reader and theme_sync sources"
  else
    fail "swift compiler argv contains ordered als_reader and theme_sync sources"
  fi
  if [ -f "$home/dotfiles/scripts/als_reader.swift" ] && [ -f "$home/dotfiles/scripts/theme_sync.swift" ]; then
    pass "both Swift compiler source arguments exist"
  else
    fail "both Swift compiler source arguments exist"
  fi
}

test_compile_sources_and_atomic_replace() {
  local home output
  home=$(prepare_compile_case success)
  output="$home/output"
  make_successful_xcrun "$home"
  run_compile_case "$home" "$output" || fail "newer binary startup succeeds"
  if [ ! -e "$home/build.trace" ]; then
    pass "binary newer than both sources skips build"
  else
    fail "binary newer than both sources skips build"
  fi
  touch -t 202001030000 "$home/dotfiles/scripts/theme_sync.swift"
  run_compile_case "$home" "$output" || fail "theme source rebuild succeeds"
  assert_compile_source_arguments "$home"
  if grep -Fq "target=$home/.local/bin/als_reader.tmp-" "$home/build.trace"; then
    pass "only newer theme_sync.swift triggers staged build"
  else
    fail "only newer theme_sync.swift triggers staged build"
  fi
  if grep -Fq "stage=exclusive" "$home/build.trace" \
      && ! grep -Eq "target=.*als_reader\.tmp-[0-9]+$" "$home/build.trace"; then
    pass "Swift staging path is unpredictable and exclusively created"
  else
    fail "Swift staging path is unpredictable and exclusively created"
  fi
  if grep -Fq "previous=old binary" "$home/build.trace" \
      && [ "$(cat "$home/.local/bin/als_reader")" = "new binary" ] \
      && ! compgen -G "$home/.local/bin/als_reader.tmp-*" >/dev/null; then
    pass "successful build atomically replaces old binary and cleans staging file"
  else
    fail "successful build atomically replaces old binary and cleans staging file"
  fi
  if [ ! -e "$home/path-tools.trace" ]; then
    pass "successful Swift install ignores PATH-preceding mv"
  else
    fail "successful Swift install ignores PATH-preceding mv"
  fi
}

test_compile_failure_case() {
  local home output
  home=$(prepare_compile_case failure)
  output="$home/output"
  touch -t 202001030000 "$home/dotfiles/scripts/theme_sync.swift"
  make_failing_xcrun "$home"
  run_compile_case "$home" "$output" || fail "swift compile failure is handled"
  if grep -Fq "compile failed, keeping existing binary" "$output" \
      && [ "$(cat "$home/.local/bin/als_reader")" = "old binary" ] \
      && ! compgen -G "$home/.local/bin/als_reader.tmp-*" >/dev/null; then
    pass "compile failure reports, retains old binary, and cleans staging file"
  else
    fail "compile failure reports, retains old binary, and cleans staging file"
  fi
  if [ ! -e "$home/path-tools.trace" ]; then
    pass "failed Swift compile ignores PATH-preceding rm"
  else
    fail "failed Swift compile ignores PATH-preceding rm"
  fi
}

test_compile_failure_keeps_binary() {
  test_compile_sources_and_atomic_replace
  test_compile_failure_case
}
