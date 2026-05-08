#!/usr/bin/env bash
lines=20
args=()
while [ $# -gt 0 ]; do
  case "$1" in
    -n|--lines)
      lines="$2"
      shift 2
      ;;
    *)
      args+=("$1")
      shift
      ;;
  esac
done
count=${#args[@]}
if [ "$count" -eq 0 ] || [ $((count % 2)) -ne 0 ]; then
  echo "USAGE: batch-get-jobs.sh [-n N] JOB1 URL1 [JOB2 URL2 ...]" >&2
  exit 1
fi
echo "BEGIN_BATCH lines=$lines jobs=$((count/2))"
idx=0
while [ $idx -lt $count ]; do
  job="${args[$idx]}"
  url="${args[$((idx+1))]}"
  output=$(NO_PROXY="*" no_proxy="*" curl -sS --max-time 15 "$url" 2>&1)
  rc=$?
  status="OK"
  if [ $rc -ne 0 ]; then
    status="ERROR:$rc"
  fi
  tail_output=$(printf "%s\n" "$output" | tail -n "$lines")
  echo "---"
  echo "JOB: $job"
  echo "URL: $url"
  echo "LAST_N_LINES: $lines"
  echo "STATUS: $status"
  echo "LOG_START"
  printf "%s\n" "$tail_output"
  echo "LOG_END"
  idx=$((idx+2))
done
echo "END_BATCH"
