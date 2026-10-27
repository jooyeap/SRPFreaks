#!/usr/bin/env bash
# count-stats.sh 테스트. 사용: bash scripts/deploy/count-stats.test.sh
# 진짜 docker 대신 질의 글자를 보고 고정된 값을 내는 가짜를 PATH 앞에 둔다.
# 핵심 확인: (1) 모든 질의가 READ ONLY 트랜잭션이다 (2) 쓰기 문장이 없다 (3) 숫자가 아닌 값·이상한 티어 이름은 그대로 내지 않는다
# (4) 백업·홈 폴더 파일 개수와 크기를 세고 파일 이름은 내지 않는다 (5) 항상 0으로 끝난다.
set -uo pipefail

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/count-stats.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fail=0
pass=0
check() { if [ "$2" -eq 0 ]; then pass=$((pass + 1)); else echo "FAIL [$1]"; fail=$((fail + 1)); fi; }

mkdir -p "$TMP/bin" "$TMP/backups" "$TMP/home"
cat > "$TMP/bin/docker" <<'FAKE'
#!/usr/bin/env bash
sql="${!#}"
printf '%s\n' "$sql" >> "$FAKE_LOG"
case "${FAKE_MODE:-}" in
  fail) echo "ERROR 1146 (42S02): Table 'srpfreaks.secret' doesn't exist" >&2; exit 1 ;;
  weird) echo "secret@example.com"; exit 0 ;;
esac
case "$sql" in
  *"t.display_name"*) printf 'Gold\t6\nPlatinum\t2\nBad<script>\t1\n' ;;
  *"status = 'BLOCKED'"*) echo 1 ;;
  *"FROM users u WHERE"*) echo 8 ;;
  *"FROM users"*) echo 42 ;;
  *"INTERVAL 7 DAY"*) echo 5 ;;
  *"DISTINCT user_id) FROM option_records"*) echo 30 ;;
  *"FROM option_records"*) echo 1234 ;;
  *) echo 7 ;;
esac
FAKE
chmod +x "$TMP/bin/docker"

printf 'x' | gzip > "$TMP/backups/srpfreaks-20261027-000000.sql.gz"
printf 'x' | gzip > "$TMP/backups/srpfreaks-20261026-000000.sql.gz"
head -c 2097152 /dev/zero > "$TMP/backups/manual-secretname.sql"
head -c 1048576 /dev/zero > "$TMP/home/old-dump-secretname.sql"

run() {
  : > "$TMP/log"
  OUT="$(PATH="$TMP/bin:$PATH" FAKE_LOG="$TMP/log" REPO_DIR="$TMP/repo" BACKUP_DIR="$TMP/backups" STATS_HOME_DIR="$TMP/home" "$@" bash "$SCRIPT" 2>&1)"
  CODE=$?
}

run env
check "정상 종료" "$([ "$CODE" -eq 0 ]; echo $?)"
check "유저 수" "$(printf '%s' "$OUT" | grep -q '전체 42명 · 공개 8명 · 차단 1명'; echo $?)"
check "기록 수" "$(printf '%s' "$OUT" | grep -q '기록 1234건'; echo $?)"
check "티어별 인원" "$(printf '%s' "$OUT" | grep -q '^Gold: 6명$' && printf '%s' "$OUT" | grep -q '^Platinum: 2명$'; echo $?)"
check "이상한 티어 이름은 내지 않음" "$(printf '%s' "$OUT" | grep -q 'script'; [ $? -ne 0 ]; echo $?)"
check "이상한 줄 표시" "$(printf '%s' "$OUT" | grep -q '읽을 수 없는 줄 1개'; echo $?)"
check "자동 백업 개수" "$(printf '%s' "$OUT" | grep -q '자동 백업(.sql.gz) 2개'; echo $?)"
check "압축 안 된 백업 크기" "$(printf '%s' "$OUT" | grep -q '압축 안 된 .sql 1개 · 2.0MB'; echo $?)"
check "홈 폴더 덤프" "$(printf '%s' "$OUT" | grep -q '홈 폴더 바로 아래의 .sql/.sql.gz 1개 · 1.0MB'; echo $?)"
check "파일 이름은 내지 않음" "$(printf '%s' "$OUT" | grep -q 'secretname'; [ $? -ne 0 ]; echo $?)"
total="$(wc -l < "$TMP/log" | tr -d ' ')"
ro="$(grep -c '^START TRANSACTION READ ONLY; ' "$TMP/log")"
check "모든 질의가 읽기 전용 트랜잭션" "$([ "$total" -gt 0 ] && [ "$total" -eq "$ro" ]; echo $?)"
check "쓰기 문장 없음" "$(grep -Eiq '(insert|update|delete|drop|alter|create|truncate|replace)[[:space:]]' "$TMP/log"; [ $? -ne 0 ]; echo $?)"

run env FAKE_MODE=fail
check "실패해도 0으로 끝남" "$([ "$CODE" -eq 0 ]; echo $?)"
check "실패는 (확인 실패)" "$(printf '%s' "$OUT" | grep -q '(확인 실패)'; echo $?)"
check "MySQL 오류 문장은 내지 않음" "$(printf '%s' "$OUT" | grep -q 'secret'; [ $? -ne 0 ]; echo $?)"

run env FAKE_MODE=weird
check "숫자가 아닌 값은 내지 않음" "$(printf '%s' "$OUT" | grep -q '@'; [ $? -ne 0 ]; echo $?)"

echo "count-stats: ${pass} passed, ${fail} failed"
[ "$fail" -eq 0 ]
