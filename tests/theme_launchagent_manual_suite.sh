#!/usr/bin/env bash

test_manual_failure_reporting() {
  local command action home mode output trace
  for command in start stop reload; do
    home="$TMP_ROOT/manual-$command"
    prepare_config_home "$home"
    output="$home/output"
    trace="$home/launchctl.trace"
    if [ "$command" = start ]; then mode=bootstrap-fail; else mode=bootout-fail; fi
    if run_config_command "$home" "als $command" "$output" "$mode"; then
      fail "als $command returns failure when launchctl fails"
    else
      pass "als $command returns failure when launchctl fails"
    fi
    assert_contains "$output" "als $command failed" "als $command reports action failure"
    case "$command" in
      start) action=loaded ;;
      stop) action=unloaded ;;
      reload) action=reloaded ;;
    esac
    assert_not_contains "$output" "als-theme $action" "als $command does not print false success"
    if [ "$command" = reload ]; then
      assert_not_contains "$trace" "bootstrap" "als reload does not bootstrap after failed bootout"
    fi
  done
}

test_manual_start_states() {
  local uid home output trace
  uid=$(id -u)

  home="$TMP_ROOT/start-healthy"
  prepare_config_home "$home"
  output="$home/output"
  trace="$home/launchctl.trace"
  run_config_command "$home" "als start" "$output" healthy || fail "als start accepts already healthy job"
  assert_contains "$output" "als-theme already loaded" "als start reports already-loaded state"
  assert_contains "$trace" "print gui/$uid/com.user.als-theme" "als start checks exact service"
  assert_not_contains "$trace" "bootstrap" "als start does not bootstrap already-loaded job"

  home="$TMP_ROOT/start-query-fail"
  prepare_config_home "$home"
  output="$home/output"
  trace="$home/launchctl.trace"
  if run_config_command "$home" "als start" "$output" print-fail; then
    fail "als start propagates launchctl query failure"
  else
    pass "als start propagates launchctl query failure"
  fi
  assert_contains "$output" "als start failed: forced launchctl print failure" "als start query failure is explicit"
  assert_not_contains "$trace" "bootstrap" "als start does not bootstrap after query failure"

  home="$TMP_ROOT/start-stale"
  prepare_config_home "$home"
  output="$home/output"
  if run_config_command "$home" "als start" "$output" stale; then
    fail "als start rejects stale loaded job"
  else
    pass "als start rejects stale loaded job"
  fi
  assert_contains "$output" "als start failed: existing job is stale" "als start explains stale state"
  assert_not_contains "$output" "als-theme loaded" "als start does not print false success for stale job"
}

test_manual_reload_states() {
  local uid home output trace
  uid=$(id -u)
  home="$TMP_ROOT/reload-unregistered"
  prepare_config_home "$home"
  output="$home/output"
  trace="$home/launchctl.trace"
  run_config_command "$home" "als reload" "$output" reload-unregistered || fail "als reload starts unregistered job"
  assert_contains "$output" "als-theme loaded" "als reload truthfully reports initial load"
  assert_not_contains "$output" "als-theme reloaded" "als reload does not claim reload for unregistered job"
  assert_not_contains "$trace" "bootout" "als reload skips bootout when job is unregistered"
  assert_contains "$trace" "bootstrap gui/$uid $home/Library/LaunchAgents/com.user.als-theme.plist" "als reload bootstraps unregistered job"

  home="$TMP_ROOT/reload-query-fail"
  prepare_config_home "$home"
  output="$home/output"
  trace="$home/launchctl.trace"
  if run_config_command "$home" "als reload" "$output" print-fail; then
    fail "als reload propagates launchctl query failure"
  else
    pass "als reload propagates launchctl query failure"
  fi
  assert_contains "$output" "als reload failed: forced launchctl print failure" "als reload query failure is explicit"
  assert_not_contains "$trace" "bootout" "als reload does not mutate job after query failure"
  assert_not_contains "$trace" "bootstrap" "als reload does not bootstrap after query failure"
}

test_manual_state_semantics() {
  test_manual_start_states
  test_manual_reload_states
}

test_status_states() {
  local uid home mode output trace
  uid=$(id -u)
  for mode in healthy stale failed unregistered; do
    home="$TMP_ROOT/status-$mode"
    prepare_config_home "$home"
    output="$home/output"
    trace="$home/launchctl.trace"
    run_config_command "$home" "als status" "$output" "$mode" || fail "als status handles $mode job"
    assert_contains "$output" "$mode" "als status reports $mode"
    assert_contains "$trace" "print gui/$uid/com.user.als-theme" "als status checks exact service for $mode job"
    assert_not_contains "$trace" "list" "als status avoids label-only list for $mode job"
  done

  home="$TMP_ROOT/status-query-fail"
  prepare_config_home "$home"
  output="$home/output"
  if run_config_command "$home" "als status" "$output" print-fail; then
    fail "als status propagates launchctl query failure"
  else
    pass "als status propagates launchctl query failure"
  fi
  assert_contains "$output" "als status failed" "als status query failure is explicit"

  home="$TMP_ROOT/status-old-generation"
  prepare_config_home "$home"
  output="$home/output"
  run_config_command "$home" "als status" "$output" generation-old-bootout-fail || fail "als status handles old generation"
  assert_contains "$output" "stale" "als status reports old generation stale"
  assert_not_contains "$output" "healthy" "als status does not report old generation healthy"
}

test_manual_identity_collisions() {
  local variant command home output
  for variant in suffix prefix; do
    for command in state start status; do
      home="$TMP_ROOT/$command-identity-$variant"
      prepare_config_home "$home"
      output="$home/output"
      case "$command" in
        state)
          run_config_command "$home" 'als-job-state (als-job)' "$output" "identity-$variant" || fail "als-job-state handles $variant identity collision"
          assert_contains "$output" "stale" "als-job-state rejects $variant identity collision"
          assert_not_contains "$output" "healthy" "als-job-state does not mark $variant identity healthy"
          ;;
        start)
          if run_config_command "$home" "als start" "$output" "identity-$variant"; then
            fail "als start rejects $variant identity collision"
          else
            pass "als start rejects $variant identity collision"
          fi
          assert_contains "$output" "existing job is stale" "als start reports $variant identity stale"
          assert_not_contains "$output" "already loaded" "als start does not accept $variant identity collision"
          ;;
        status)
          run_config_command "$home" "als status" "$output" "identity-$variant" || fail "als status handles $variant identity collision"
          assert_contains "$output" "stale" "als status reports $variant identity stale"
          assert_not_contains "$output" "healthy" "als status does not report $variant identity healthy"
          ;;
      esac
    done
  done
}
