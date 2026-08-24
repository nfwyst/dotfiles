#!/usr/bin/env bash

set -u

ROOT=$(cd "$(dirname "$0")/.." && pwd)
NU_BIN=${NU_BIN:-/opt/homebrew/bin/nu}
TMP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/theme-launchagent-test.XXXXXX")
FAILURES=0

source "$ROOT/tests/theme_launchagent_fake_launchctl.sh"
source "$ROOT/tests/theme_launchagent_test_helpers.sh"
source "$ROOT/tests/theme_launchagent_env_suite.sh"
source "$ROOT/tests/theme_launchagent_concurrency_suite.sh"
source "$ROOT/tests/theme_launchagent_manual_suite.sh"
source "$ROOT/tests/theme_launchagent_delta_compile_suite.sh"

trap cleanup EXIT

if [ "${1:-}" = generation ]; then
  test_plist_generation_bootout_races
elif [ "${1:-}" = concurrent ]; then
  test_concurrent_env_startup
  test_concurrent_repair
else
  test_launchagent_lifecycle
  test_initial_identity_collisions
  test_bootout_recheck_identity_collisions
  test_bootstrap_recheck_identity_collisions
  test_concurrent_env_startup
  test_concurrent_repair
  test_manual_failure_reporting
  test_manual_state_semantics
  test_status_states
  test_manual_identity_collisions
  test_delta_include
  test_concurrent_config_startup
  test_compile_failure_keeps_binary
fi

if [ "$FAILURES" -ne 0 ]; then
  printf 'RESULT: FAIL (%d assertions)\n' "$FAILURES" >&2
  exit 1
fi

printf 'RESULT: PASS\n'
