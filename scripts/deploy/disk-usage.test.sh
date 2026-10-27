#!/usr/bin/env bash
# disk-usage.sh 테스트. 사용: bash scripts/deploy/disk-usage.test.sh
# 진짜 df/docker 대신 고정된 값을 내는 가짜를 PATH 앞에 둔다.
# 핵심 확인: (1) 사용률·용량·백업 개수를 맞게 계산한다 (2) 80%/90% 경계에서 주의·위험으로 바뀐다 (3) 파일 이름이 출력에 나오지 않는다 (4) 아무것도 지우지 않고 항상 0으로 끝난다 (5) 이상한 기준값은 거절한다.
set -uo pipefail

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/disk-usage.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fail=0
pass=0

check() { # 이름, 조건 결과(0이면 통과)
  if [ "$2" -eq 0 ]; then pass=$((pass + 1)); else echo "FAIL [$1]"; fail=$((fail + 1)); fi
}

mkdir -p "$TMP/bin" "$TMP/backups"
# 가짜 df: FAKE_DF_USED_K 만큼 쓴 20GB(20971520K) 디스크
cat > "$TMP/bin/df" <<'FAKE'
#!/usr/bin/env bash
echo "Filesystem 1024-blocks Used Available Capacity Mounted on"
total=20971520
used="${FAKE_DF_USED_K:-10485760}"
echo "/dev/fake $total $used $((total - used)) 50% /"
FAKE
cat > "$TMP/bin/docker" <<'FAKE'
#!/usr/bin/env bash
echo "TYPE TOTAL ACTIVE SIZE RECLAIMABLE"
echo "Images 5 3 1.2GB 0.4GB"
FAKE
chmod +x "$TMP/bin/df" "$TMP/bin/docker"
# 백업 2개 + 손으로 만든 .sql 1개(개수에 세지 않는다). 파일 이름이 출력에 나오면 안 되므로 눈에 띄는 이름을 쓴다.
head -c 1048576 /dev/zero > "$TMP/backups/srpfreaks-SECRETNAME1.sql.gz"
head -c 1048576 /dev/zero > "$TMP/backups/srpfreaks-SECRETNAME2.sql.gz"
head -c 1024 /dev/zero > "$TMP/backups/manual-SECRETNAME3.sql"

run() { # 환경변수는 호출 쪽에서 앞에 붙인다. 출력은 $OUT, 종료 코드는 $CODE
  OUT="$(PATH="$TMP/bin:$PATH" BACKUP_DIR="$TMP/backups" "$@" bash "$SCRIPT" 2>&1)"
  CODE=$?
}

# 1) 50% 사용(20GB 중 10GB): 정상
run env
check "종료 코드 0" "$CODE"
printf '%s' "$OUT" | grep -Fq "사용률 50% (정상)"; check "50%는 정상" "$?"
printf '%s' "$OUT" | grep -Fq "전체 20.0GB"; check "전체 20.0GB" "$?"
printf '%s' "$OUT" | grep -Fq "사용 10.0GB"; check "사용 10.0GB" "$?"
printf '%s' "$OUT" | grep -Fq "남음 10.0GB"; check "남음 10.0GB" "$?"
printf '%s' "$OUT" | grep -Fq "백업 2개"; check "백업은 .sql.gz만 센다(2개)" "$?"
printf '%s' "$OUT" | grep -Fq "Images 5 3 1.2GB"; check "도커 용량이 나온다" "$?"

# 2) 파일 이름은 출력에 나오지 않는다
printf '%s' "$OUT" | grep -Fq "SECRETNAME"; [ "$?" -ne 0 ]; check "파일 이름이 출력에 없다" "$?"

# 3) 경계: 79% 정상, 80% 주의, 89% 주의, 90% 위험 (20971520K 기준)
used_for() { echo $(( 20971520 * $1 / 100 )); }
run env FAKE_DF_USED_K="$(used_for 79)"; printf '%s' "$OUT" | grep -Fq "(정상)"; check "79%는 정상" "$?"
run env FAKE_DF_USED_K="$(used_for 80)"; printf '%s' "$OUT" | grep -Fq "(주의)"; check "80%는 주의" "$?"
run env FAKE_DF_USED_K="$(used_for 89)"; printf '%s' "$OUT" | grep -Fq "(주의)"; check "89%는 주의" "$?"
run env FAKE_DF_USED_K="$(used_for 90)"; printf '%s' "$OUT" | grep -Fq "(위험)"; check "90%는 위험" "$?"
check "위험이어도 종료 코드 0" "$CODE"

# 4) 점검만 한다: 백업 파일이 그대로 남아 있다
[ -f "$TMP/backups/srpfreaks-SECRETNAME1.sql.gz" ] && [ -f "$TMP/backups/manual-SECRETNAME3.sql" ]; check "아무것도 지우지 않는다" "$?"

# 5) 백업 폴더가 없어도 실패하지 않는다
run env BACKUP_DIR="$TMP/none"
check "폴더 없어도 종료 코드 0" "$CODE"

# 6) 이상한 기준값은 거절한다
for badval in "abc" "80; rm -rf /" "-1" "1.5"; do
  run env DISK_WARN_PERCENT="$badval"
  [ "$CODE" -eq 2 ]; check "이상한 기준값 거절 [$badval]" "$?"
done

echo "통과 $pass, 실패 $fail"
[ "$fail" -eq 0 ]
