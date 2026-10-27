#!/usr/bin/env bash
# migration-status.sh 테스트. 사용: bash scripts/deploy/migration-status.test.sh
# 가짜 docker가 질의 글자를 보고 값을 낸다. 확인: 읽기 전용 질의만 / 실패 기록이면 1 / 이상한 값이면 2 / 오류 문장·스크립트 이름을 내지 않음.
set -uo pipefail
SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/migration-status.sh"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
fail=0; pass=0
check() { if [ "$2" -eq 0 ]; then pass=$((pass + 1)); else echo "FAIL [$1]"; fail=$((fail + 1)); fi; }
mkdir -p "$TMP/bin"
cat > "$TMP/bin/docker" <<'FAKE'
#!/usr/bin/env bash
sql="${!#}"; printf '%s\n' "$sql" >> "$FAKE_LOG"
case "${FAKE_MODE:-ok}" in
  broken) echo "ERROR 1146: Table 'srpfreaks.flyway_schema_history' doesn't exist" >&2; exit 1 ;;
esac
case "$sql" in
  *"success = 1\""*|*"WHERE success = 1;"*|*"success = 1; COMMIT"*) echo 16 ;;
  *"COUNT(*) FROM flyway_schema_history WHERE success = 0"*) [ "${FAKE_MODE:-ok}" = failed ] && echo 1 || echo 0 ;;
  *"ORDER BY installed_rank DESC"*) echo 16 ;;
  *"success = 0 ORDER BY"*) echo 17 ;;
  *) echo 16 ;;
esac
FAKE
chmod +x "$TMP/bin/docker"
run() { : > "$TMP/log"; OUT="$(PATH="$TMP/bin:$PATH" FAKE_LOG="$TMP/log" REPO_DIR="$TMP" "$@" bash "$SCRIPT" 2>&1)"; CODE=$?; }

run env FAKE_MODE=ok
check "정상 0" "$([ "$CODE" -eq 0 ]; echo $?)"
check "요약" "$(printf '%s' "$OUT" | grep -q '적용 성공 16개 · 마지막 버전 V16 · 실패 기록 0개'; echo $?)"
total="$(wc -l < "$TMP/log" | tr -d ' ')"; ro="$(grep -c '^START TRANSACTION READ ONLY; ' "$TMP/log")"
check "읽기 전용" "$([ "$total" -gt 0 ] && [ "$total" -eq "$ro" ]; echo $?)"
check "쓰기 없음" "$(grep -Eiq '(insert|update|delete|drop|alter|create|truncate|replace)[[:space:]]' "$TMP/log"; [ $? -ne 0 ]; echo $?)"

run env FAKE_MODE=failed
check "실패 기록이면 1" "$([ "$CODE" -eq 1 ]; echo $?)"
check "실패 버전" "$(printf '%s' "$OUT" | grep -q '실패한 버전: V17'; echo $?)"

run env FAKE_MODE=broken
check "확인 실패 2" "$([ "$CODE" -eq 2 ]; echo $?)"
check "오류 문장 비노출" "$(printf '%s' "$OUT" | grep -q 'srpfreaks\|ERROR'; [ $? -ne 0 ]; echo $?)"

echo "migration-status: ${pass} passed, ${fail} failed"
[ "$fail" -eq 0 ]
