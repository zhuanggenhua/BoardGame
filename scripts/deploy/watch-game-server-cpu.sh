#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${BG_GAME_SERVER_CONTAINER:-boardgame-game-server}"
THRESHOLD_PERCENT="${BG_GAME_SERVER_CPU_THRESHOLD:-${BG_GAME_SERVER_CPU_RESTART_THRESHOLD:-80}}"
SAMPLE_COUNT="${BG_GAME_SERVER_CPU_SAMPLE_COUNT:-3}"
SAMPLE_INTERVAL_SECONDS="${BG_GAME_SERVER_CPU_SAMPLE_INTERVAL_SECONDS:-20}"
COOLDOWN_SECONDS="${BG_GAME_SERVER_CPU_RESTART_COOLDOWN_SECONDS:-600}"
FEEDBACK_COOLDOWN_SECONDS="${BG_GAME_SERVER_CPU_FEEDBACK_COOLDOWN_SECONDS:-600}"
LOG_SINCE="${BG_GAME_SERVER_CPU_LOG_SINCE:-10m}"
EVIDENCE_DIR="${BG_GAME_SERVER_CPU_EVIDENCE_DIR:-./logs/game-server-cpu-watch}"
HISTORY_LOG="${BG_GAME_SERVER_CPU_HISTORY_LOG:-$EVIDENCE_DIR/restart-history.log}"
STATE_FILE="${BG_GAME_SERVER_CPU_STATE_FILE:-/tmp/boardgame-game-server-cpu-watch.last-restart}"
FEEDBACK_STATE_FILE="${BG_GAME_SERVER_CPU_FEEDBACK_STATE_FILE:-/tmp/boardgame-game-server-cpu-watch.last-feedback}"
LOCK_FILE="${BG_GAME_SERVER_CPU_LOCK_FILE:-/tmp/boardgame-game-server-cpu-watch.lock}"
ENABLE_RESTART="${BG_GAME_SERVER_CPU_WATCH_RESTART:-0}"
ENABLE_FEEDBACK="${BG_GAME_SERVER_CPU_FEEDBACK:-1}"
FEEDBACK_URL="${BG_GAME_SERVER_CPU_FEEDBACK_URL:-http://127.0.0.1/internal/feedback/system}"
FEEDBACK_TOKEN="${BG_GAME_SERVER_CPU_FEEDBACK_TOKEN:-${INTERNAL_FEEDBACK_TOKEN:-}}"

usage() {
  cat <<'EOF'
Usage:
  BG_GAME_SERVER_CPU_WATCH_RESTART=1 bash scripts/deploy/watch-game-server-cpu.sh

Environment:
  BG_GAME_SERVER_CONTAINER                 container name, default boardgame-game-server
  BG_GAME_SERVER_CPU_THRESHOLD             sustained CPU percent threshold, default 80
  BG_GAME_SERVER_CPU_RESTART_THRESHOLD     legacy alias for threshold
  BG_GAME_SERVER_CPU_SAMPLE_COUNT          sample count, default 3
  BG_GAME_SERVER_CPU_SAMPLE_INTERVAL_SECONDS sample interval, default 20
  BG_GAME_SERVER_CPU_RESTART_COOLDOWN_SECONDS cooldown after restart, default 600
  BG_GAME_SERVER_CPU_FEEDBACK_COOLDOWN_SECONDS cooldown after feedback, default 600
  BG_GAME_SERVER_CPU_EVIDENCE_DIR          evidence output dir, default ./logs/game-server-cpu-watch
  BG_GAME_SERVER_CPU_HISTORY_LOG           append-only decision log, default $BG_GAME_SERVER_CPU_EVIDENCE_DIR/restart-history.log
  BG_GAME_SERVER_CPU_WATCH_RESTART         set to 1 to actually restart; default 0 only records evidence
  BG_GAME_SERVER_CPU_FEEDBACK              set to 0 to disable internal feedback; default 1
  BG_GAME_SERVER_CPU_FEEDBACK_URL          internal feedback URL, default http://127.0.0.1/internal/feedback/system
  BG_GAME_SERVER_CPU_FEEDBACK_TOKEN        internal feedback token; defaults to INTERNAL_FEEDBACK_TOKEN
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$EVIDENCE_DIR"
evidence_file="$EVIDENCE_DIR/$timestamp-$CONTAINER_NAME.txt"
last_decision="unknown"
last_reason="unknown"
last_restarted="no"

json_escape() {
  local value="${1:-}"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  value="${value//$'\r'/\\r}"
  value="${value//$'\t'/\\t}"
  printf '%s' "$value"
}

record_decision() {
  local decision="$1"
  local reason="$2"
  local restarted="$3"
  last_decision="$decision"
  last_reason="$reason"
  last_restarted="$restarted"
  local average="${average_cpu:-n/a}"
  local high="${high_samples:-n/a}"
  local samples="${SAMPLE_COUNT:-n/a}"
  local line
  line="$(printf '%s container=%s decision=%s restarted=%s reason=%q averageCpu=%s highSamples=%s/%s threshold=%s evidence=%s' \
    "$timestamp" "$CONTAINER_NAME" "$decision" "$restarted" "$reason" "$average" "$high" "$samples" "$THRESHOLD_PERCENT" "$evidence_file")"
  printf '%s\n' "$line" >>"$HISTORY_LOG"
  {
    echo
    echo "# decision"
    printf '%s\n' "$line"
  } >>"$evidence_file"
}

report_high_cpu_feedback() {
  local now_epoch="$1"
  local decision="${last_decision:-unknown}"
  local reason="${last_reason:-unknown}"
  local restarted="${last_restarted:-no}"

  if [[ "$ENABLE_FEEDBACK" != "1" ]]; then
    echo "[watch-game-server-cpu] internal feedback disabled" >>"$evidence_file"
    return 0
  fi
  if ! command -v curl >/dev/null 2>&1; then
    echo "[watch-game-server-cpu] curl not found; internal feedback skipped" >>"$evidence_file"
    return 0
  fi
  if [[ -z "$FEEDBACK_TOKEN" ]]; then
    echo "[watch-game-server-cpu] INTERNAL_FEEDBACK_TOKEN missing; internal feedback skipped" >>"$evidence_file"
    return 0
  fi

  local last_feedback_epoch
  if [[ -f "$FEEDBACK_STATE_FILE" ]]; then
    last_feedback_epoch="$(cat "$FEEDBACK_STATE_FILE" 2>/dev/null || echo 0)"
  else
    last_feedback_epoch=0
  fi
  if [[ "$last_feedback_epoch" =~ ^[0-9]+$ ]] && (( now_epoch - last_feedback_epoch < FEEDBACK_COOLDOWN_SECONDS )); then
    echo "[watch-game-server-cpu] internal feedback cooldown active; skipped" >>"$evidence_file"
    return 0
  fi

  local severity="high"
  if [[ "$decision" == "restart-failed" ]]; then
    severity="critical"
  fi

  local host_name
  host_name="$(hostname 2>/dev/null || echo unknown-host)"
  local content="[system][infra-cpu-watch] game-server CPU sustained high: average=${average_cpu}% highSamples=${high_samples}/${SAMPLE_COUNT} threshold=${THRESHOLD_PERCENT}% decision=${decision} restarted=${restarted}"
  local incident_key="infra-cpu-watch:${host_name}:${CONTAINER_NAME}:${THRESHOLD_PERCENT}"
  local state_snapshot
  state_snapshot="{\"timestamp\":\"$(json_escape "$timestamp")\",\"host\":\"$(json_escape "$host_name")\",\"container\":\"$(json_escape "$CONTAINER_NAME")\",\"thresholdPercent\":${THRESHOLD_PERCENT},\"averageCpu\":${average_cpu},\"highSamples\":${high_samples},\"sampleCount\":${SAMPLE_COUNT},\"sampleIntervalSeconds\":${SAMPLE_INTERVAL_SECONDS},\"decision\":\"$(json_escape "$decision")\",\"reason\":\"$(json_escape "$reason")\",\"restarted\":\"$(json_escape "$restarted")\",\"evidenceFile\":\"$(json_escape "$evidence_file")\"}"
  local action_log="evidence=${evidence_file}; history=${HISTORY_LOG}; logsSince=${LOG_SINCE}; restartCooldownSeconds=${COOLDOWN_SECONDS}; feedbackCooldownSeconds=${FEEDBACK_COOLDOWN_SECONDS}"
  local payload_file="$EVIDENCE_DIR/$timestamp-$CONTAINER_NAME-feedback.json"

  cat >"$payload_file" <<EOF
{
  "content": "$(json_escape "$content")",
  "source": "infra-cpu-watch",
  "type": "bug",
  "severity": "$severity",
  "status": "open",
  "autoReportKind": "cpu-sustained-high",
  "incidentKey": "$(json_escape "$incident_key")",
  "gameName": "infra",
  "contactInfo": "system:infra-cpu-watch",
  "actionLog": "$(json_escape "$action_log")",
  "stateSnapshot": "$(json_escape "$state_snapshot")",
  "clientContext": {
    "route": "host-cpu-watch",
    "mode": "production",
    "gameId": "infra"
  },
  "errorContext": {
    "source": "infra-cpu-watch",
    "name": "cpu-sustained-high",
    "message": "$(json_escape "$reason")"
  }
}
EOF

  if curl -fsS --max-time 10 \
    -H 'Content-Type: application/json' \
    -H "X-Internal-Feedback-Token: $FEEDBACK_TOKEN" \
    -X POST "$FEEDBACK_URL" \
    --data-binary "@$payload_file" >>"$evidence_file" 2>&1; then
    printf '%s\n' "$now_epoch" >"$FEEDBACK_STATE_FILE"
    echo "[watch-game-server-cpu] internal feedback reported: $FEEDBACK_URL" >>"$evidence_file"
  else
    echo "[watch-game-server-cpu] internal feedback failed: $FEEDBACK_URL payload=$payload_file" >>"$evidence_file"
  fi
}

if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    echo "[watch-game-server-cpu] another watch process is running; lock=$LOCK_FILE" >&2
    exit 0
  fi
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "[watch-game-server-cpu] docker command not found" >&2
  record_decision "error" "docker_command_not_found" "no"
  exit 1
fi

if ! docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  echo "[watch-game-server-cpu] container not found: $CONTAINER_NAME" >&2
  record_decision "error" "container_not_found" "no"
  exit 1
fi

cpu_samples=()
high_samples=0

{
  echo "# game-server CPU watch"
  echo "timestamp=$timestamp"
  echo "container=$CONTAINER_NAME"
  echo "thresholdPercent=$THRESHOLD_PERCENT"
  echo "sampleCount=$SAMPLE_COUNT"
  echo "sampleIntervalSeconds=$SAMPLE_INTERVAL_SECONDS"
  echo "restartEnabled=$ENABLE_RESTART"
  echo "feedbackEnabled=$ENABLE_FEEDBACK"
  echo "feedbackUrl=$FEEDBACK_URL"
  echo
} >>"$evidence_file"

for ((i = 1; i <= SAMPLE_COUNT; i += 1)); do
  raw_stats="$(docker stats --no-stream --format '{{.CPUPerc}} {{.MemUsage}} {{.PIDs}}' "$CONTAINER_NAME")"
  cpu_percent="$(printf '%s\n' "$raw_stats" | awk '{ gsub(/%/, "", $1); print $1 }')"
  cpu_samples+=("$cpu_percent")
  awk -v cpu="$cpu_percent" -v threshold="$THRESHOLD_PERCENT" 'BEGIN { exit !(cpu + 0 >= threshold + 0) }' && high_samples=$((high_samples + 1))
  printf '[watch-game-server-cpu] sample=%s/%s cpu=%s%% raw="%s"\n' "$i" "$SAMPLE_COUNT" "$cpu_percent" "$raw_stats" | tee -a "$evidence_file"
  if [[ "$i" -lt "$SAMPLE_COUNT" ]]; then
    sleep "$SAMPLE_INTERVAL_SECONDS"
  fi
done

average_cpu="$(printf '%s\n' "${cpu_samples[@]}" | awk '{ sum += $1; count += 1 } END { if (count == 0) print "0"; else printf "%.2f", sum / count }')"

{
  echo
  echo "# host snapshot"
  uptime || true
  free -m || true
  df -h || true
  echo
  echo "# docker stats snapshot"
  docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.PIDs}}' 2>/dev/null || true
  echo
  echo "# docker ps"
  docker ps || true
  echo
  echo "# docker inspect"
  docker inspect --format 'status={{.State.Status}} oomKilled={{.State.OOMKilled}} restartCount={{.RestartCount}} startedAt={{.State.StartedAt}} finishedAt={{.State.FinishedAt}}' "$CONTAINER_NAME"
  echo
  echo "# docker top"
  docker top "$CONTAINER_NAME" 2>&1 || true
  echo
  echo "# recent logs"
  docker logs --since "$LOG_SINCE" "$CONTAINER_NAME" 2>&1 || true
} >>"$evidence_file"

if [[ "$high_samples" -lt "$SAMPLE_COUNT" ]]; then
  record_decision "ok" "sustained_high_cpu_not_confirmed" "no"
  echo "[watch-game-server-cpu] OK: sustained high CPU not confirmed; highSamples=$high_samples/$SAMPLE_COUNT averageCpu=$average_cpu% evidence=$evidence_file"
  exit 0
fi

now_epoch="$(date +%s)"
if [[ -f "$STATE_FILE" ]]; then
  last_restart_epoch="$(cat "$STATE_FILE" 2>/dev/null || echo 0)"
else
  last_restart_epoch=0
fi

if [[ "$last_restart_epoch" =~ ^[0-9]+$ ]] && (( now_epoch - last_restart_epoch < COOLDOWN_SECONDS )); then
  record_decision "cooldown" "high_cpu_but_restart_cooldown_active" "no"
  report_high_cpu_feedback "$now_epoch"
  echo "[watch-game-server-cpu] HIGH but cooldown active: averageCpu=$average_cpu% highSamples=$high_samples/$SAMPLE_COUNT evidence=$evidence_file"
  exit 0
fi

if [[ "$ENABLE_RESTART" != "1" ]]; then
  record_decision "dry-run" "high_cpu_confirmed_but_restart_disabled" "no"
  report_high_cpu_feedback "$now_epoch"
  echo "[watch-game-server-cpu] HIGH dry-run: set BG_GAME_SERVER_CPU_WATCH_RESTART=1 to restart; averageCpu=$average_cpu% evidence=$evidence_file"
  exit 2
fi

echo "[watch-game-server-cpu] HIGH: restarting $CONTAINER_NAME; averageCpu=$average_cpu% evidence=$evidence_file"
if ! docker restart "$CONTAINER_NAME" >>"$evidence_file" 2>&1; then
  record_decision "restart-failed" "docker_restart_failed_after_high_cpu" "no"
  report_high_cpu_feedback "$now_epoch"
  echo "[watch-game-server-cpu] restart failed: $CONTAINER_NAME; evidence=$evidence_file" >&2
  exit 1
fi
printf '%s\n' "$now_epoch" >"$STATE_FILE"
record_decision "restarted" "sustained_high_cpu" "yes"
report_high_cpu_feedback "$now_epoch"
echo "[watch-game-server-cpu] restarted $CONTAINER_NAME"
