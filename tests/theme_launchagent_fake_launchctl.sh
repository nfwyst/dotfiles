#!/usr/bin/env bash

make_fake_launchctl() {
  local home=$1
  mkdir -p "$home/.local/bin"
  cat >"$home/.local/bin/launchctl" <<'SH'
#!/bin/sh
plist_generation() {
  /usr/bin/awk '
    /<key>ALS_CONFIG_GENERATION<\/key>/ { getline; gsub(/.*<string>|<\/string>.*/, ""); print; exit }
  ' "$HOME/Library/LaunchAgents/com.user.als-theme.plist"
}

emit_job_identity() {
  printf 'path = %s\n' "$HOME/Library/LaunchAgents/com.user.als-theme.plist"
  printf 'program = %s\n' "$HOME/.local/bin/als_reader"
  printf 'ALS_CONFIG_GENERATION => %s\n' "$1"
}

emit_adversarial_identity() {
  case "$FAKE_LAUNCHCTL_MODE" in
    *-suffix)
      printf 'path = %s.attacker\n' "$HOME/Library/LaunchAgents/com.user.als-theme.plist"
      printf 'program = %s.attacker\n' "$HOME/.local/bin/als_reader"
      ;;
    *-prefix)
      printf 'attacker path = %s\n' "$HOME/Library/LaunchAgents/com.user.als-theme.plist"
      printf 'attacker program = %s\n' "$HOME/.local/bin/als_reader"
      ;;
  esac
  printf 'last exit code = 0\n'
}

printf '%s\n' "$*" >>"$FAKE_LAUNCHCTL_TRACE"
case "${FAKE_LAUNCHCTL_MODE:-unregistered}:$1" in
  healthy:print|bootout-fail:print|no-exit-line:print)
    emit_job_identity "$(plist_generation)"
    if [ "${FAKE_LAUNCHCTL_MODE:-}" != no-exit-line ]; then
      printf 'last exit code = 0\n'
    fi
    ;;
  generation-old-bootout-fail:print)
    emit_job_identity old-generation
    printf 'last exit code = 0\n'
    ;;
  generation-winner:print)
    if [ -d "$FAKE_LAUNCHCTL_STATE/winner" ]; then
      emit_job_identity "$(plist_generation)"
    else
      emit_job_identity old-generation
    fi
    printf 'last exit code = 0\n'
    ;;
  concurrent:print)
    if [ -d "$FAKE_LAUNCHCTL_STATE/registered" ]; then
      emit_job_identity "$(plist_generation)"
      printf 'last exit code = 0\n'
    else
      mkfifo "$FAKE_LAUNCHCTL_STATE/release-$$"
      mkdir "$FAKE_LAUNCHCTL_STATE/print-$$"
      IFS= read -r _ <"$FAKE_LAUNCHCTL_STATE/release-$$"
      printf 'Could not find service\n' >&2
      exit 113
    fi
    ;;
  concurrent-stale:print|concurrent-failed:print)
    if [ -d "$FAKE_LAUNCHCTL_STATE/healthy" ]; then
      emit_job_identity "$(plist_generation)"
      printf 'last exit code = 0\n'
    elif [ -d "$FAKE_LAUNCHCTL_STATE/registered" ]; then
      mkfifo "$FAKE_LAUNCHCTL_STATE/print-release-$$"
      mkdir "$FAKE_LAUNCHCTL_STATE/initial-print-$$"
      IFS= read -r _ <"$FAKE_LAUNCHCTL_STATE/print-release-$$"
      if [ "$FAKE_LAUNCHCTL_MODE" = concurrent-stale ]; then
        printf 'path = /tmp/stale-home/Library/LaunchAgents/com.user.als-theme.plist\n'
        printf 'program = /tmp/stale-home/.local/bin/als_reader\n'
      else
        emit_job_identity "$(plist_generation)"
        printf 'last exit code = 64: EX_USAGE\n'
      fi
    else
      mkdir "$FAKE_LAUNCHCTL_STATE/missing-print-$$"
      printf 'Could not find service\n' >&2
      exit 113
    fi
    ;;
  bootstrap-race-failed:print)
    if [ -d "$FAKE_LAUNCHCTL_STATE/registered" ]; then
      emit_job_identity "$(plist_generation)"
      printf 'last exit code = 64: EX_USAGE\n'
    else
      printf 'Could not find service\n' >&2
      exit 113
    fi
    ;;
  identity-suffix:print|identity-prefix:print)
    emit_adversarial_identity
    ;;
  bootout-race-suffix:print|bootout-race-prefix:print)
    if [ -d "$FAKE_LAUNCHCTL_STATE/recheck" ]; then
      emit_adversarial_identity
    else
      printf 'path = /tmp/stale-home/Library/LaunchAgents/com.user.als-theme.plist\n'
      printf 'program = /tmp/stale-home/.local/bin/als_reader\n'
    fi
    ;;
  bootstrap-race-suffix:print|bootstrap-race-prefix:print)
    if [ -d "$FAKE_LAUNCHCTL_STATE/registered" ]; then
      emit_adversarial_identity
    else
      printf 'Could not find service\n' >&2
      exit 113
    fi
    ;;
  stale:print|stale-bootout-fail:print|stale-bootstrap-fail:print)
    printf 'path = /tmp/stale-home/Library/LaunchAgents/com.user.als-theme.plist\n'
    printf 'program = /tmp/stale-home/.local/bin/als_reader\n'
    ;;
  failed:print)
    emit_job_identity "$(plist_generation)"
    printf 'last exit code = 64: EX_USAGE\n'
    ;;
  bootout-recheck-fail:print)
    if [ -d "$FAKE_LAUNCHCTL_STATE/recheck" ]; then
      printf 'forced launchctl recheck failure\n' >&2
      exit 42
    fi
    printf 'path = /tmp/stale-home/Library/LaunchAgents/com.user.als-theme.plist\n'
    printf 'program = /tmp/stale-home/.local/bin/als_reader\n'
    ;;
  unregistered:print|setup:print|bootstrap-fail:print|reload-unregistered:print)
    printf 'Could not find service\n' >&2
    exit 113
    ;;
  print-fail:print)
    printf 'forced launchctl print failure\n' >&2
    exit 42
    ;;
  bootstrap-fail:bootstrap|stale-bootstrap-fail:bootstrap)
    printf 'forced launchctl bootstrap failure\n' >&2
    exit 42
    ;;
  concurrent:bootstrap)
    if ! mkdir "$FAKE_LAUNCHCTL_STATE/registered" 2>/dev/null; then
      printf 'service already loaded by concurrent startup\n' >&2
      exit 36
    fi
    ;;
  concurrent-stale:bootout|concurrent-failed:bootout)
    if mv "$FAKE_LAUNCHCTL_STATE/registered" "$FAKE_LAUNCHCTL_STATE/bootout-claimed" 2>/dev/null; then
      if [ "$FAKE_LAUNCHCTL_MODE" = concurrent-stale ]; then
        mkfifo "$FAKE_LAUNCHCTL_STATE/bootout-release-$$"
        mkdir "$FAKE_LAUNCHCTL_STATE/bootout-winner-$$"
        IFS= read -r _ <"$FAKE_LAUNCHCTL_STATE/bootout-release-$$"
      fi
    else
      mkdir "$FAKE_LAUNCHCTL_STATE/bootout-loser-$$"
      if [ "$FAKE_LAUNCHCTL_MODE" = concurrent-failed ]; then
        mkdir "$FAKE_LAUNCHCTL_STATE/healthy-waiter-$$"
        deadline=$(( $(/bin/date +%s) + 10 ))
        while [ ! -d "$FAKE_LAUNCHCTL_STATE/healthy-release-$$" ]; do
          if [ "$(/bin/date +%s)" -ge "$deadline" ]; then
            printf 'timed out waiting for failed repair release\n' >&2
            exit 70
          fi
          /bin/sleep 0.01
        done
      fi
      printf 'service already removed by concurrent repair\n' >&2
      exit 36
    fi
    ;;
  concurrent-stale:bootstrap|concurrent-failed:bootstrap)
    if ! mkdir "$FAKE_LAUNCHCTL_STATE/healthy" 2>/dev/null; then
      printf 'service already loaded by concurrent repair\n' >&2
      exit 36
    fi
    ;;
  bootstrap-race-failed:bootstrap)
    mkdir "$FAKE_LAUNCHCTL_STATE/registered"
    printf 'service already loaded but failed\n' >&2
    exit 36
    ;;
  bootout-fail:bootout|stale-bootout-fail:bootout)
    printf 'forced launchctl failure\n' >&2
    exit 42
    ;;
  generation-old-bootout-fail:bootout)
    printf 'forced launchctl failure\n' >&2
    exit 42
    ;;
  generation-winner:bootout)
    mkdir -p "$FAKE_LAUNCHCTL_STATE/winner"
    printf 'service replaced by concurrent repair\n' >&2
    exit 36
    ;;
  bootout-recheck-fail:bootout)
    mkdir -p "$FAKE_LAUNCHCTL_STATE/recheck"
    printf 'forced launchctl failure\n' >&2
    exit 42
    ;;
  bootout-race-suffix:bootout|bootout-race-prefix:bootout)
    mkdir -p "$FAKE_LAUNCHCTL_STATE/recheck"
    printf 'forced launchctl failure\n' >&2
    exit 42
    ;;
  bootstrap-race-suffix:bootstrap|bootstrap-race-prefix:bootstrap)
    mkdir -p "$FAKE_LAUNCHCTL_STATE/registered"
    printf 'forced launchctl bootstrap failure\n' >&2
    exit 42
    ;;
esac
SH
  chmod +x "$home/.local/bin/launchctl"
}
