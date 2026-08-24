#!/usr/bin/env bash

test_concurrent_env_startup() {
  local home="$TMP_ROOT/env-concurrent" state="$TMP_ROOT/env-concurrent/launchctl.state"
  local failed print_count bootstrap_count marker
  local -a pids=()

  prepare_env_case concurrent >/dev/null || fail "concurrent fixture setup bootstraps current plist"
  mkdir -p "$state"
  run_env "$home" concurrent "$home/run-1.out" &
  pids+=("$!")
  run_env "$home" concurrent "$home/run-2.out" &
  pids+=("$!")
  if ! wait_for_marker_count "$state" print 2; then
    fail "two concurrent env loads reach missing-service barrier"
    stop_background_jobs "${pids[@]}"
    return
  fi
  pass "two concurrent env loads both observe missing service"
  for marker in "$state"/print-*; do
    printf 'go\n' >"$state/release-${marker##*-}"
  done

  wait_for_jobs "${pids[@]}"
  failed=$?
  if [ "$failed" -eq 0 ]; then
    pass "two concurrent env loads converge after bootstrap race"
  else
    fail "two concurrent env loads converge after bootstrap race (failed: $failed)"
  fi
  print_count=$(grep -Fc "print gui/$(id -u)/com.user.als-theme" "$home/launchctl.trace")
  bootstrap_count=$(grep -Fc "bootstrap gui/$(id -u) $home/Library/LaunchAgents/com.user.als-theme.plist" "$home/launchctl.trace")
  if [ "$print_count" -eq 3 ]; then
    pass "bootstrap loser rechecks exact service target"
  else
    fail "bootstrap loser rechecks exact service target (print calls: $print_count)"
  fi
  if [ "$bootstrap_count" -eq 2 ]; then
    pass "both missing-service startups attempt bootstrap"
  else
    fail "both missing-service startups attempt bootstrap (bootstrap calls: $bootstrap_count)"
  fi
}

run_concurrent_repair() {
  local mode=$1 home="$TMP_ROOT/env-concurrent-$1" state="$TMP_ROOT/env-concurrent-$1/launchctl.state"
  local marker failed
  local -a pids=()

  prepare_env_case "concurrent-$mode" >/dev/null || fail "concurrent $mode fixture setup bootstraps current plist"
  mkdir -p "$state/registered"
  run_env "$home" "concurrent-$mode" "$home/run-1.out" &
  pids+=("$!")
  run_env "$home" "concurrent-$mode" "$home/run-2.out" &
  pids+=("$!")
  if ! wait_for_marker_count "$state" initial-print 2; then
    fail "two concurrent $mode repairs reach initial-state barrier"
    stop_background_jobs "${pids[@]}"
    return
  fi
  for marker in "$state"/initial-print-*; do
    printf 'go\n' >"$state/print-release-${marker##*-}"
  done
  if [ "$mode" = stale ]; then
    wait_for_stale_repair "$state"
  elif ! release_failed_repair "$state"; then
    stop_background_jobs "${pids[@]}"
    return
  fi
  wait_for_jobs "${pids[@]}"
  failed=$?
  assert_concurrent_repair "$mode" "$home" "$failed"
}

release_failed_repair() {
  local state=$1 marker
  if ! wait_for_marker_count "$state" healthy-waiter 1; then
    fail "bootout loser registers before failed repair release"
    return 1
  fi
  if ! wait_for_path "$state/healthy"; then
    fail "failed repair winner becomes healthy before loser release"
    return 1
  fi
  for marker in "$state"/healthy-waiter-*; do
    mkdir "$state/healthy-release-${marker##*-}"
  done
}

wait_for_stale_repair() {
  local state=$1 marker
  if ! wait_for_path "$state/healthy"; then
    fail "bootout loser continues stale repair after service becomes missing"
  fi
  for marker in "$state"/bootout-winner-*; do
    if [ -e "$marker" ]; then
      printf 'go\n' >"$state/bootout-release-${marker##*-}"
    fi
  done
}

assert_concurrent_repair() {
  local mode=$1 home=$2 failed=$3
  if [ "$failed" -eq 0 ]; then
    pass "two concurrent $mode repairs converge"
  else
    fail "two concurrent $mode repairs converge (failed: $failed)"
  fi
  if [ "$(grep -Fc "bootout gui/$(id -u)/com.user.als-theme" "$home/launchctl.trace")" -eq 2 ]; then
    pass "both $mode repairs attempt exact bootout"
  else
    fail "both $mode repairs attempt exact bootout"
  fi
  if [ "$mode" = failed ] && [ "$(grep -Fc "bootstrap gui/$(id -u) $home/Library/LaunchAgents/com.user.als-theme.plist" "$home/launchctl.trace")" -eq 1 ]; then
    pass "failed repair skips bootstrap after exact healthy convergence"
  elif [ "$mode" = failed ]; then
    fail "failed repair skips bootstrap after exact healthy convergence"
  fi
}

test_concurrent_repair() {
  run_concurrent_repair stale
  run_concurrent_repair failed
}
