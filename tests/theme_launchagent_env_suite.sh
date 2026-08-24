#!/usr/bin/env bash

test_launchagent_healthy_and_repair_states() {
  local uid home trace
  uid=$(id -u)

  home="$TMP_ROOT/env-healthy"
  prepare_env_case healthy >/dev/null || fail "healthy fixture setup bootstraps current plist"
  trace="$home/launchctl.trace"
  assert_contains "$home/Library/LaunchAgents/com.user.als-theme.plist" "<key>ProgramArguments</key>" "generated plist defines ProgramArguments"
  assert_contains "$home/Library/LaunchAgents/com.user.als-theme.plist" "<string>$home/.local/bin/als_reader</string>" "generated plist launches als_reader"
  local expected_program="$home/.local/bin/als_reader"
  expected_program=${expected_program//\//\\/}
  if [ "$(/usr/bin/plutil -extract ProgramArguments json -o - "$home/Library/LaunchAgents/com.user.als-theme.plist")" = "[\"$expected_program\"]" ]; then
    pass "generated plist has exactly one ProgramArguments value"
  else
    fail "generated plist has exactly one ProgramArguments value"
  fi
  run_env "$home" healthy "$home/run.out" || fail "healthy job startup exits successfully"
  assert_contains "$trace" "print gui/$uid/com.user.als-theme" "healthy job checks exact service target"
  assert_not_contains "$trace" "bootout" "healthy job is not stopped"
  assert_not_contains "$trace" "bootstrap" "healthy job is not duplicated"

  home="$TMP_ROOT/env-no-exit-line"
  prepare_env_case no-exit-line >/dev/null || fail "missing exit line fixture setup bootstraps current plist"
  trace="$home/launchctl.trace"
  run_env "$home" no-exit-line "$home/run.out" || fail "job without last-exit line startup succeeds"
  assert_not_contains "$trace" "bootout" "job without last-exit line is not treated as failed"
  assert_not_contains "$trace" "bootstrap" "job without last-exit line is not duplicated"

  home="$TMP_ROOT/env-failed"
  prepare_env_case failed >/dev/null || fail "failed job fixture setup bootstraps current plist"
  trace="$home/launchctl.trace"
  run_env "$home" failed "$home/run.out" || fail "failed job repair exits successfully"
  assert_contains "$trace" "bootout gui/$uid/com.user.als-theme" "failed job is removed by service target"
  assert_contains "$trace" "bootstrap gui/$uid $home/Library/LaunchAgents/com.user.als-theme.plist" "failed job is bootstrapped from current plist"

  home="$TMP_ROOT/env-stale"
  prepare_env_case stale >/dev/null || fail "stale fixture setup bootstraps current plist"
  trace="$home/launchctl.trace"
  run_env "$home" stale "$home/run.out" || fail "stale job repair exits successfully"
  assert_contains "$trace" "print gui/$uid/com.user.als-theme" "stale job checks exact service target"
  assert_contains "$trace" "bootout gui/$uid/com.user.als-theme" "stale job is removed by service target"
  assert_contains "$trace" "bootstrap gui/$uid $home/Library/LaunchAgents/com.user.als-theme.plist" "stale job is bootstrapped from current plist"

  home="$TMP_ROOT/env-unregistered"
  prepare_env_case unregistered >/dev/null || fail "unregistered fixture setup bootstraps current plist"
  trace="$home/launchctl.trace"
  run_env "$home" unregistered "$home/run.out" || fail "unregistered job startup exits successfully"
  assert_contains "$trace" "print gui/$uid/com.user.als-theme" "unregistered job checks exact service target"
  assert_not_contains "$trace" "bootout" "unregistered job is not stopped"
  assert_contains "$trace" "bootstrap gui/$uid $home/Library/LaunchAgents/com.user.als-theme.plist" "unregistered job is bootstrapped"
}

test_launchagent_bootout_failures() {
  local home trace

  home="$TMP_ROOT/env-stale-bootout-fail"
  prepare_env_case stale-bootout-fail >/dev/null || fail "stale bootout failure fixture setup bootstraps current plist"
  trace="$home/launchctl.trace"
  if run_env "$home" stale-bootout-fail "$home/run.out"; then
    fail "stale repair fails when bootout fails"
  else
    pass "stale repair fails when bootout fails"
  fi
  assert_contains "$home/run.out" "als-theme startup bootout failed" "stale bootout failure is explicit"
  assert_not_contains "$trace" "bootstrap" "stale repair stops after failed bootout"

  home="$TMP_ROOT/env-bootout-recheck-fail"
  prepare_env_case bootout-recheck-fail >/dev/null || fail "bootout recheck failure fixture setup bootstraps current plist"
  trace="$home/launchctl.trace"
  mkdir -p "$home/launchctl.state"
  if run_env "$home" bootout-recheck-fail "$home/run.out"; then
    fail "bootout failure remains explicit when exact recheck fails"
  else
    pass "bootout failure remains explicit when exact recheck fails"
  fi
  assert_contains "$home/run.out" "als-theme startup bootout failed: forced launchctl failure" "bootout recheck failure preserves original error"
  assert_not_contains "$trace" "bootstrap" "bootout recheck failure stops before bootstrap"
}

change_plist_interval() {
  local plist=$1 changed="$1.changed"
  sed 's/<integer>30<\/integer>/<integer>31<\/integer>/' "$plist" >"$changed"
  mv "$changed" "$plist"
}

test_plist_generation_bootout_races() {
  local home plist trace

  home="$TMP_ROOT/env-generation-old-bootout-fail"
  prepare_env_case generation-old-bootout-fail >/dev/null || fail "old-generation fixture setup bootstraps current plist"
  plist="$home/Library/LaunchAgents/com.user.als-theme.plist"
  trace="$home/launchctl.trace"
  change_plist_interval "$plist"
  if run_env "$home" generation-old-bootout-fail "$home/run.out"; then
    fail "changed plist rejects old loaded generation after failed bootout"
  else
    pass "changed plist rejects old loaded generation after failed bootout"
  fi
  assert_contains "$home/run.out" "als-theme startup bootout failed: forced launchctl failure" "old-generation bootout failure stays explicit"
  assert_not_contains "$trace" "bootstrap" "old-generation bootout failure does not claim replacement"

  home="$TMP_ROOT/env-generation-winner"
  prepare_env_case generation-winner >/dev/null || fail "generation-winner fixture setup bootstraps current plist"
  plist="$home/Library/LaunchAgents/com.user.als-theme.plist"
  trace="$home/launchctl.trace"
  mkdir -p "$home/launchctl.state"
  change_plist_interval "$plist"
  run_env "$home" generation-winner "$home/run.out" || fail "concurrent winner with current generation converges"
  assert_contains "$trace" "bootout gui/$(id -u)/com.user.als-theme" "generation repair attempts exact bootout"
  assert_not_contains "$trace" "bootstrap" "generation repair accepts concurrent current-generation winner"
}

test_launchagent_bootstrap_failures() {
  local uid home trace
  uid=$(id -u)

  home="$TMP_ROOT/env-bootstrap-fail"
  prepare_env_case bootstrap-fail >/dev/null || fail "bootstrap failure fixture setup bootstraps current plist"
  if run_env "$home" bootstrap-fail "$home/run.out"; then
    fail "unregistered startup fails when bootstrap fails"
  else
    pass "unregistered startup fails when bootstrap fails"
  fi
  assert_contains "$home/run.out" "als-theme startup bootstrap failed" "bootstrap failure is explicit"

  home="$TMP_ROOT/env-bootstrap-race-failed"
  prepare_env_case bootstrap-race-failed >/dev/null || fail "failed race fixture setup bootstraps current plist"
  trace="$home/launchctl.trace"
  mkdir -p "$home/launchctl.state"
  if run_env "$home" bootstrap-race-failed "$home/run.out"; then
    fail "bootstrap race rejects job with nonzero last exit"
  else
    pass "bootstrap race rejects job with nonzero last exit"
  fi
  assert_contains "$home/run.out" "als-theme startup bootstrap failed" "failed bootstrap race remains explicit"
  if [ "$(grep -Fc "print gui/$uid/com.user.als-theme" "$trace")" -eq 2 ]; then
    pass "failed bootstrap race rechecks exact service once"
  else
    fail "failed bootstrap race rechecks exact service once"
  fi

  home="$TMP_ROOT/env-stale-bootstrap-fail"
  prepare_env_case stale-bootstrap-fail >/dev/null || fail "stale bootstrap failure fixture setup bootstraps current plist"
  trace="$home/launchctl.trace"
  if run_env "$home" stale-bootstrap-fail "$home/run.out"; then
    fail "stale repair fails when replacement bootstrap fails"
  else
    pass "stale repair fails when replacement bootstrap fails"
  fi
  assert_contains "$home/run.out" "als-theme startup bootstrap failed" "stale replacement bootstrap failure is explicit"
  assert_contains "$trace" "bootout gui/$uid/com.user.als-theme" "stale replacement bootout ran before bootstrap failure"
}

test_launchagent_query_failure() {
  local home trace
  home="$TMP_ROOT/env-print-fail"
  prepare_env_case print-fail >/dev/null || fail "print failure fixture setup bootstraps current plist"
  trace="$home/launchctl.trace"
  if run_env "$home" print-fail "$home/run.out"; then
    fail "startup propagates launchctl query failure"
  else
    pass "startup propagates launchctl query failure"
  fi
  assert_contains "$home/run.out" "als-theme startup status failed" "startup query failure is explicit"
  assert_not_contains "$trace" "bootstrap" "startup does not bootstrap after query failure"
}

test_launchagent_lifecycle() {
  test_launchagent_healthy_and_repair_states
  test_launchagent_bootout_failures
  test_plist_generation_bootout_races
  test_launchagent_bootstrap_failures
  test_launchagent_query_failure
}

test_initial_identity_collisions() {
  local variant home trace
  for variant in suffix prefix; do
    home="$TMP_ROOT/env-identity-$variant"
    prepare_env_case "identity-$variant" >/dev/null || fail "$variant identity fixture setup bootstraps current plist"
    trace="$home/launchctl.trace"
    run_env "$home" "identity-$variant" "$home/run.out" || fail "$variant identity repair exits successfully"
    assert_contains "$trace" "bootout gui/$(id -u)/com.user.als-theme" "initial health rejects $variant identity collision"
    assert_contains "$trace" "bootstrap gui/$(id -u) $home/Library/LaunchAgents/com.user.als-theme.plist" "$variant identity collision is replaced"
  done
}

test_bootout_recheck_identity_collisions() {
  local variant home
  for variant in suffix prefix; do
    home="$TMP_ROOT/env-bootout-race-$variant"
    prepare_env_case "bootout-race-$variant" >/dev/null || fail "bootout $variant fixture setup bootstraps current plist"
    mkdir -p "$home/launchctl.state"
    if run_env "$home" "bootout-race-$variant" "$home/run.out"; then
      fail "bootout failure rejects $variant identity collision on recheck"
    else
      pass "bootout failure rejects $variant identity collision on recheck"
    fi
    assert_contains "$home/run.out" "als-theme startup bootout failed: forced launchctl failure" "bootout $variant collision preserves original error"
    assert_not_contains "$home/launchctl.trace" "bootstrap" "bootout $variant collision stops before bootstrap"
  done
}

test_bootstrap_recheck_identity_collisions() {
  local variant home
  for variant in suffix prefix; do
    home="$TMP_ROOT/env-bootstrap-race-$variant"
    prepare_env_case "bootstrap-race-$variant" >/dev/null || fail "bootstrap $variant fixture setup bootstraps current plist"
    mkdir -p "$home/launchctl.state"
    if run_env "$home" "bootstrap-race-$variant" "$home/run.out"; then
      fail "bootstrap failure rejects $variant identity collision on recheck"
    else
      pass "bootstrap failure rejects $variant identity collision on recheck"
    fi
    assert_contains "$home/run.out" "als-theme startup bootstrap failed: forced launchctl bootstrap failure" "bootstrap $variant collision preserves original error"
  done
}
