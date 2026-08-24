#!/bin/bash
set -u

repo_root=$(cd "$(dirname "$0")/.." && pwd)
swift_sources=(
  "$repo_root/scripts/als_reader.swift"
  "$repo_root/scripts/theme_sync.swift"
)
nvim_source="$repo_root/.config/nvim/lua/plugins/colorscheme.lua"
tmp_root=$(mktemp -d "${TMPDIR:-/tmp}/theme-sync.XXXXXX")
home_dir="$tmp_root/home"
blocked_home="$tmp_root/blocked-home"
split_home="$tmp_root/split-home"
source_fail_home="$tmp_root/source-fail-home"
socket_dir="$tmp_root/sockets"
timeout_socket_dir="$tmp_root/timeout-sockets"
contention_socket_dir="$tmp_root/contention-sockets"
binary="$tmp_root/als_reader"
test_binary="$tmp_root/als_reader_tests"
timeout_binary="$tmp_root/tmux_timeout_test"
socket_one="$socket_dir/one"
socket_two="$socket_dir/two"
stale_socket="$socket_dir/stale"
ordinary_file="$socket_dir/not-a-socket"
dangling_entry="$socket_dir/dangling"
unresponsive_socket="$timeout_socket_dir/first-unresponsive"
timeout_valid_socket="$timeout_socket_dir/second-valid"
contention_socket="$contention_socket_dir/responsive"
server_one_pid=""
server_two_pid=""
timeout_server_pid=""
timeout_sync_pid=""
contention_server_pid=""
contention_resume_pid=""
contention_load_pids=()
failures=0

cleanup() {
  [ -f "$split_home/.local/state/delta/theme.gitconfig" ] && chflags nouchg "$split_home/.local/state/delta/theme.gitconfig" 2>/dev/null || true
  [ -n "$server_one_pid" ] && /opt/homebrew/bin/tmux -S "$socket_one" kill-server >/dev/null 2>&1 || true
  [ -n "$server_two_pid" ] && /opt/homebrew/bin/tmux -S "$socket_two" kill-server >/dev/null 2>&1 || true
  for load_pid in "${contention_load_pids[@]}"; do
    kill "$load_pid" >/dev/null 2>&1 || true
    wait "$load_pid" 2>/dev/null || true
  done
  if [ -n "$contention_resume_pid" ]; then
    kill "$contention_resume_pid" >/dev/null 2>&1 || true
    wait "$contention_resume_pid" 2>/dev/null || true
  fi
  [ -n "$contention_server_pid" ] && kill -CONT "$contention_server_pid" >/dev/null 2>&1 || true
  [ -n "$contention_server_pid" ] && /opt/homebrew/bin/tmux -S "$contention_socket" kill-server >/dev/null 2>&1 || true
  if [ -n "$timeout_sync_pid" ]; then
    while read -r child_pid; do
      [ -n "$child_pid" ] && kill "$child_pid" >/dev/null 2>&1 || true
    done < <(pgrep -P "$timeout_sync_pid" 2>/dev/null || true)
    kill "$timeout_sync_pid" >/dev/null 2>&1 || true
    wait "$timeout_sync_pid" 2>/dev/null || true
  fi
  [ -n "$timeout_server_pid" ] && kill "$timeout_server_pid" >/dev/null 2>&1 || true
  /opt/homebrew/bin/tmux -S "$timeout_valid_socket" kill-server >/dev/null 2>&1 || true
  [ -n "$timeout_server_pid" ] && wait "$timeout_server_pid" 2>/dev/null || true
  rm -rf "$tmp_root"
}
trap cleanup EXIT

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  failures=$((failures + 1))
}

mkdir -p "$home_dir/.config/tmux" "$home_dir/.local/state/theme" "$home_dir/.local/state/delta" \
  "$blocked_home/.config/tmux" "$split_home/.config/tmux" \
  "$source_fail_home/.config/tmux" "$split_home/.local/state/theme" \
  "$split_home/.local/state/delta" "$blocked_home/.local/state" "$socket_dir" \
  "$timeout_socket_dir" "$contention_socket_dir"
printf "set -g @synced-theme 'dark'\nset -g @theme_mode 'dark'\n" >"$home_dir/.config/tmux/tmux-dark.conf"
printf "set -g @synced-theme 'light'\nset -g @theme_mode 'light'\n" >"$home_dir/.config/tmux/tmux-light.conf"
cp "$home_dir/.config/tmux/tmux-dark.conf" "$blocked_home/.config/tmux/tmux-dark.conf"
cp "$home_dir/.config/tmux/tmux-light.conf" "$blocked_home/.config/tmux/tmux-light.conf"
cp "$home_dir/.config/tmux/tmux-dark.conf" "$split_home/.config/tmux/tmux-dark.conf"
cp "$home_dir/.config/tmux/tmux-light.conf" "$split_home/.config/tmux/tmux-light.conf"
printf "if -F '#{==:#{socket_path},%s}' 'source-file %s/.config/tmux/missing.conf' 'set -g @synced-theme dark'\nset -g @theme_mode dark\n" \
  "$socket_one" "$source_fail_home" >"$source_fail_home/.config/tmux/tmux-dark.conf"
cp "$home_dir/.config/tmux/tmux-light.conf" "$source_fail_home/.config/tmux/tmux-light.conf"
printf blocked >"$blocked_home/.local/state/theme"
printf 'dark\n' >"$split_home/.local/state/theme/mode"
printf '[delta]\n    features = woolly-mammoth\n' >"$split_home/.local/state/delta/theme.gitconfig"
chflags uchg "$split_home/.local/state/delta/theme.gitconfig"
xcrun swiftc -o "$binary" "${swift_sources[@]}" || exit 1

for invalid in "nan 200" "-1 200" "300 100"; do
  read -r dark_threshold light_threshold <<<"$invalid"
  if ALS_DRY_RUN=1 ALS_THRESHOLD_DARK="$dark_threshold" ALS_THRESHOLD_LIGHT="$light_threshold" \
    "$binary" >/dev/null 2>"$tmp_root/invalid.stderr"; then
    fail "invalid thresholds accepted: $invalid"
  fi
done

cp "$repo_root/tests/AlsReaderTests.swift" "$tmp_root/main.swift"
if ! xcrun swiftc -D ALS_TESTING -o "$test_binary" "${swift_sources[@]}" "$tmp_root/main.swift" 2>"$tmp_root/swift-test-build.stderr"; then
  fail "Swift regression test build failed"
fi
if [ -x "$test_binary" ]; then
  "$test_binary" 2>"$tmp_root/swift-test.stderr" || fail "Swift unit assertions failed"
  [ ! -s "$tmp_root/swift-test.stderr" ] || fail "missing-sensor fallback wrote to stderr"
fi
cat >"$tmp_root/main.swift" <<'SWIFT'
import Foundation

let arguments = CommandLine.arguments
if arguments.count == 4, arguments[1] == "atomic" {
    let destination = URL(fileURLWithPath: arguments[2])
    let legacyTemporary = destination.deletingLastPathComponent()
        .appendingPathComponent(".\(destination.lastPathComponent).tmp-\(getpid())")
    try Data("sentinel".utf8).write(to: legacyTemporary)
    defer { try? FileManager.default.removeItem(at: legacyTemporary) }
    do {
        try atomicWrite(arguments[3], to: destination)
    } catch {
        FileHandle.standardError.write(Data("FAIL: atomicWrite reused predictable PID temporary path: \(error)\n".utf8))
        exit(3)
    }
    guard try String(contentsOf: legacyTemporary, encoding: .utf8) == "sentinel" else { exit(3) }
    guard try String(contentsOf: destination, encoding: .utf8) == arguments[3] else { exit(4) }
    exit(0)
}
guard arguments.count == 4 else { exit(64) }
if arguments[1] == "responsive" {
    do {
        try sourceTmuxTheme(
            arguments[3], mode: "dark",
            sockets: [URL(fileURLWithPath: arguments[2])]
        )
        exit(0)
    } catch {
        FileHandle.standardError.write(Data("FAIL: responsive tmux socket: \(error)\n".utf8))
        exit(1)
    }
}
let sockets = arguments[1...2].map { URL(fileURLWithPath: $0) }
do {
    try sourceTmuxTheme(arguments[3], mode: "dark", sockets: sockets)
    FileHandle.standardError.write(Data("FAIL: unresponsive tmux socket exited zero\n".utf8))
    exit(2)
} catch {
    FileHandle.standardError.write(Data("EXPECTED: \(error)\n".utf8))
    exit(1)
}
SWIFT
xcrun swiftc -o "$timeout_binary" "$repo_root/scripts/theme_sync.swift" "$tmp_root/main.swift" || exit 1
mkdir -p "$tmp_root/atomic"
if "$timeout_binary" atomic "$tmp_root/atomic/state" 'unique-temporary-write'; then
  printf 'PASS: atomicWrite used a system-unique temporary path\n'
else
  fail "atomicWrite reused predictable PID temporary path"
fi

printf 'dark\n' >"$home_dir/.local/state/theme/mode"
printf '[delta]\n    features = woolly-mammoth\n' >"$home_dir/.local/state/delta/theme.gitconfig"
/opt/homebrew/bin/tmux -S "$socket_one" -f /dev/null new-session -d -s test-one
server_one_pid=1
/opt/homebrew/bin/tmux -S "$socket_two" -f /dev/null new-session -d -s test-two
server_two_pid=1
/opt/homebrew/bin/tmux -S "$socket_one" set-option -gq @synced-theme drifted
/opt/homebrew/bin/tmux -S "$socket_two" set-option -gq @synced-theme drifted
/opt/homebrew/bin/tmux -S "$socket_one" set-option -gq @theme_mode light
/opt/homebrew/bin/tmux -S "$socket_two" set-option -gq @theme_mode light

if [ -x "$test_binary" ]; then
  "$test_binary" sync dark "$home_dir" "$socket_dir" >/dev/null 2>"$tmp_root/sync.stderr" || fail "valid synchronization exited nonzero"
else
  fail "valid synchronization unavailable"
fi
[ "$(/opt/homebrew/bin/tmux -S "$socket_one" show-option -gv @synced-theme 2>/dev/null)" = dark ] || fail "first drifted socket was not corrected"
[ "$(/opt/homebrew/bin/tmux -S "$socket_two" show-option -gv @synced-theme 2>/dev/null)" = dark ] || fail "second drifted socket was not corrected"
[ "$(cat "$home_dir/.local/state/theme/mode")" = dark ] || fail "mode state is not dark"
[ "$(git config --file "$home_dir/.local/state/delta/theme.gitconfig" --get delta.features)" = woolly-mammoth ] || fail "delta state is not dark"
printf 'PASS: equal-state reconciliation corrected two isolated tmux sockets\n'

/opt/homebrew/bin/tmux -S "$stale_socket" -f /dev/null new-session -d -s stale
/opt/homebrew/bin/tmux -S "$stale_socket" kill-server
printf ordinary >"$ordinary_file"
ln -s "$socket_dir/missing" "$dangling_entry"
/opt/homebrew/bin/tmux -S "$socket_one" set-option -gq @synced-theme stale-test
/opt/homebrew/bin/tmux -S "$socket_one" set-option -gq @theme_mode light
if [ -x "$test_binary" ]; then
  "$test_binary" sync dark "$home_dir" "$socket_dir" >/dev/null 2>"$tmp_root/stale.stderr"
  stale_status=$?
else
  stale_status=0
fi
[ "$stale_status" -eq 0 ] || fail "stale tmux socket failed synchronization"
[ "$(/opt/homebrew/bin/tmux -S "$socket_one" show-option -gv @synced-theme 2>/dev/null)" = dark ] || fail "valid socket was not attempted after stale socket failure"
[ ! -s "$tmp_root/stale.stderr" ] || fail "stale socket produced repeated log output"
rg -qF "$ordinary_file" "$tmp_root/stale.stderr" && fail "ordinary file was treated as a tmux socket"
rg -qF "$dangling_entry" "$tmp_root/stale.stderr" && fail "unreadable directory entry failed synchronization"
printf 'PASS: stale socket skipped silently while valid socket still synchronized\n'

rm -f "$stale_socket"
/opt/homebrew/bin/tmux -S "$socket_one" set-option -gq @synced-theme marker-match-preserved
if [ -x "$test_binary" ]; then
  "$test_binary" sync dark "$home_dir" "$socket_dir" >/dev/null 2>"$tmp_root/matched.stderr" || fail "matching marker synchronization exited nonzero"
fi
[ "$(/opt/homebrew/bin/tmux -S "$socket_one" show-option -gv @synced-theme 2>/dev/null)" = marker-match-preserved ] || fail "matching marker sourced theme again"
printf 'PASS: matching tmux marker skipped redundant source\n'

/opt/homebrew/bin/tmux -S "$socket_one" set-option -gq @theme_mode light
/opt/homebrew/bin/tmux -S "$socket_two" set-option -gq @theme_mode light
/opt/homebrew/bin/tmux -S "$socket_two" set-option -gq @synced-theme before-source-test
if [ -x "$test_binary" ]; then
  "$test_binary" sync dark "$source_fail_home" "$socket_dir" >/dev/null 2>"$tmp_root/source-fail.stderr"
  source_status=$?
else
  source_status=1
fi
[ "$source_status" -ne 0 ] || fail "running socket source failure exited zero"
[ "$(/opt/homebrew/bin/tmux -S "$socket_two" show-option -gv @synced-theme 2>/dev/null)" = dark ] || fail "valid sibling was not attempted after source failure"
rg -qF "sockets/one status=1" "$tmp_root/source-fail.stderr" || fail "running socket source failure was not reported"
printf 'PASS: running socket source failure propagated after valid sibling attempt\n'

contention_client_count=8
/opt/homebrew/bin/tmux -S "$contention_socket" -f /dev/null new-session -d -s contention
/opt/homebrew/bin/tmux -S "$contention_socket" set-option -gq @theme_mode light
contention_server_pid=$(/opt/homebrew/bin/tmux -S "$contention_socket" display-message -p '#{pid}')
kill -STOP "$contention_server_pid"
(sleep 2; kill -CONT "$contention_server_pid") &
contention_resume_pid=$!
{ /usr/bin/time -p /opt/homebrew/bin/tmux -S "$contention_socket" show-options -gqv @theme_mode; } \
  >"$tmp_root/contention-delayed-query.out" 2>"$tmp_root/contention-delayed-query.time"
wait "$contention_resume_pid"
contention_resume_pid=""
delayed_response=$(cat "$tmp_root/contention-delayed-query.out")
delayed_seconds=$(awk '$1 == "real" { print $2 }' "$tmp_root/contention-delayed-query.time")
[ "$delayed_response" = light ] || fail "stopped tmux server did not answer after resuming"
awk -v elapsed="$delayed_seconds" 'BEGIN { exit !(elapsed >= 1.5) }' || \
  fail "stopped tmux server query did not exceed old 1s deadline"
kill -STOP "$contention_server_pid"
(sleep 2; kill -CONT "$contention_server_pid") &
contention_resume_pid=$!
for worker in $(seq 1 "$contention_client_count"); do
  /opt/homebrew/bin/tmux -S "$contention_socket" display-message -p '#{session_name}' \
    >"$tmp_root/contention-worker-$worker.out" &
  contention_load_pids+=("$!")
done
"$timeout_binary" responsive "$contention_socket" \
  "$home_dir/.config/tmux/tmux-dark.conf" >/dev/null 2>"$tmp_root/contention.stderr"
contention_status=$?
if [ "$contention_status" -ne 0 ]; then
  cat "$tmp_root/contention.stderr" >&2
  fail "responsive tmux socket was falsely timed out under client contention"
fi
wait "$contention_resume_pid"
contention_resume_pid=""
for load_pid in "${contention_load_pids[@]}"; do
  wait "$load_pid" || fail "contention client failed"
done
contention_load_pids=()
contention_response_count=$(rg -l '^contention$' "$tmp_root"/contention-worker-*.out | wc -l | tr -d ' ')
[ "$contention_response_count" -eq "$contention_client_count" ] || fail "contention clients did not all receive responses"
contention_response=$(/opt/homebrew/bin/tmux -S "$contention_socket" show-options -gqv @theme_mode)
[ -n "$contention_response" ] || fail "contention tmux server did not answer after resuming"
printf 'PASS: responsive tmux query took %ss; server resumed and answered %s queued clients plus direct query (%s)\n' \
  "$delayed_seconds" "$contention_response_count" "$contention_response"
/opt/homebrew/bin/tmux -S "$contention_socket" kill-server
contention_server_pid=""

python3 - "$unresponsive_socket" <<'PY' &
import socket
import sys
import time

server = socket.socket(socket.AF_UNIX)
server.bind(sys.argv[1])
server.listen()
while True:
    time.sleep(60)
PY
timeout_server_pid=$!
for _ in {1..50}; do
  [ -S "$unresponsive_socket" ] && break
  sleep 0.02
done
[ -S "$unresponsive_socket" ] || fail "unresponsive tmux socket fixture did not start"
/opt/homebrew/bin/tmux -S "$timeout_valid_socket" -f /dev/null new-session -d -s timeout-valid
/opt/homebrew/bin/tmux -S "$timeout_valid_socket" set-option -gq @synced-theme before-timeout-test
/opt/homebrew/bin/tmux -S "$timeout_valid_socket" set-option -gq @theme_mode light
"$timeout_binary" "$unresponsive_socket" "$timeout_valid_socket" \
  "$home_dir/.config/tmux/tmux-dark.conf" >/dev/null 2>"$tmp_root/timeout.stderr" &
timeout_sync_pid=$!
timeout_completed=0
for _ in {1..70}; do
  if ! kill -0 "$timeout_sync_pid" 2>/dev/null; then
    timeout_completed=1
    break
  fi
  sleep 0.1
done
if [ "$timeout_completed" -eq 0 ]; then
  fail "unresponsive tmux socket exceeded 7s watchdog; subsequent valid sibling was not synchronized"
  while read -r child_pid; do
    [ -n "$child_pid" ] && kill "$child_pid" >/dev/null 2>&1 || true
  done < <(pgrep -P "$timeout_sync_pid" 2>/dev/null || true)
  kill "$timeout_sync_pid" >/dev/null 2>&1 || true
  wait "$timeout_sync_pid" 2>/dev/null || true
else
  wait "$timeout_sync_pid"
  timeout_status=$?
  [ "$timeout_status" -ne 0 ] || fail "unresponsive tmux socket failure exited zero"
  rg -qF "query socket=$unresponsive_socket timed out" "$tmp_root/timeout.stderr" || \
    fail "unresponsive tmux socket timeout was not reported"
  [ "$(/opt/homebrew/bin/tmux -S "$timeout_valid_socket" show-option -gv @synced-theme 2>/dev/null)" = dark ] || \
    fail "subsequent valid sibling was not synchronized after tmux timeout"
  if pgrep -f "^/opt/homebrew/bin/tmux -S $unresponsive_socket " >/dev/null; then
    fail "timed-out tmux child remained running"
  fi
  printf 'PASS: unresponsive tmux socket timed out, reaped, and valid sibling synchronized\n'
fi
timeout_sync_pid=""
kill "$timeout_server_pid" >/dev/null 2>&1 || true
wait "$timeout_server_pid" 2>/dev/null || true
timeout_server_pid=""

/opt/homebrew/bin/tmux -S "$socket_one" set-option -gq @synced-theme unchanged
if [ -x "$test_binary" ]; then
  "$test_binary" sync light "$blocked_home" "$socket_dir" >/dev/null 2>"$tmp_root/unwritable.stderr"
  write_status=$?
else
  write_status=1
fi
[ "$write_status" -ne 0 ] || fail "unwritable state exited zero"
[ "$(/opt/homebrew/bin/tmux -S "$socket_one" show-option -gv @synced-theme 2>/dev/null)" = unchanged ] || fail "tmux sourced after state write failure"
[ ! -e "$blocked_home/.local/state/theme/mode" ] || fail "mode state appeared after write failure"
[ ! -e "$blocked_home/.local/state/delta/theme.gitconfig" ] || fail "delta state appeared after write failure"
printf 'PASS: initial state write failure blocked tmux source\n'

/opt/homebrew/bin/tmux -S "$socket_one" set-option -gq @synced-theme unchanged
if [ -x "$test_binary" ]; then
  "$test_binary" sync light "$split_home" "$socket_dir" >/dev/null 2>"$tmp_root/split.stderr"
  split_status=$?
else
  split_status=1
fi
[ "$split_status" -ne 0 ] || fail "second state write failure exited zero"
[ "$(cat "$split_home/.local/state/theme/mode")" = dark ] || fail "first state file was not rolled back"
[ "$(/opt/homebrew/bin/tmux -S "$socket_one" show-option -gv @synced-theme 2>/dev/null)" = unchanged ] || fail "tmux sourced after second state write failure"
printf 'PASS: second state write failure rolled back mode and blocked tmux source\n'

nvim_script="$tmp_root/parser_test.lua"
cat >"$nvim_script" <<'LUA'
package.preload["config.util"] = function()
  return { set_hl = function() end }
end
package.preload["tokyonight"] = function()
  return { setup = function() end }
end
vim.fn.has = function() return 0 end
vim.cmd.colorscheme = function() end
local source = table.concat(vim.fn.readfile(vim.env.THEME_NVIM_SOURCE), "\n")
local parser = assert(loadstring(source .. "\nreturn parse_theme_mode"))()
local path = os.tmpname()
local function write(value)
  vim.fn.writefile({ value }, path)
  return parser(path)
end
assert(write(" light ") == "light")
assert(write("dark") == "dark")
assert(write("highlight") == nil)
assert(write("darkness") == nil)
vim.fn.writefile({ "dark", "light" }, path)
assert(parser(path) == nil)
os.remove(path)
LUA
THEME_NVIM_SOURCE="$nvim_source" nvim --headless -u NONE -l "$nvim_script" || fail "Neovim exact parser assertions failed"
printf 'PASS: exact Neovim theme parser\n'

if [ "$failures" -ne 0 ]; then
  exit 1
fi
printf 'PASS: theme sync integration, failure isolation, invalid thresholds, exact parser\n'
