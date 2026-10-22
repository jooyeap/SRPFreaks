#!/usr/bin/env bash
# check-backups.sh 테스트. 사용: bash scripts/deploy/check-backups.test.sh
# 임시 폴더에 가짜 백업 파일(진짜 gzip, 파일 시각을 고정)을 만들어 판정과 출력을 확인한다.
# 핵심 확인: (1) 최근 백업이 있으면 정상 (2) 없거나 오래됐거나 작거나 손상됐으면 실패 (3) 아무것도 지우거나 바꾸지 않는다 (4) 출력에 파일 이름·경로가 새지 않는다(공개 로그).
set -uo pipefail

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/check-backups.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fail=0
pass=0

check() { # 이름, 조건 결과(0이면 통과)
  if [ "$2" -eq 0 ]; then pass=$((pass + 1)); else echo "FAIL [$1]"; fail=$((fail + 1)); fi
}

NOW=2000000000   # 테스트용 "지금"(초). 파일 시각은 여기서 몇 시간 전으로 맞춘다.
hours_ago() { echo $((NOW - $1 * 3600)); }

# 크기를 키운 진짜 gzip 파일을 만든다 (2048 bytes 넘게)
make_backup() { # 이름, 몇 시간 전
  head -c 20000 /dev/urandom | gzip -c > "$DIR/$1"
  touch -d "@$(hours_ago "$2")" "$DIR/$1"
}

run() { # 환경변수는 호출 쪽에서 앞에 붙인다. 출력은 $OUT, 종료 코드는 $CODE
  OUT="$(env BACKUP_DIR="$DIR" CHECK_NOW="$NOW" "$@" bash "$SCRIPT" 2>&1)"
  CODE=$?
}

new_dir() { DIR="$TMP/$1"; mkdir -p "$DIR"; }

# 1) 5시간 전 백업이 있으면 정상
new_dir ok
make_backup srpfreaks-20260101-000000.sql.gz 5
make_backup srpfreaks-20251231-000000.sql.gz 29
run env
[ "$CODE" -eq 0 ]; check "최근 백업: 종료 코드 0" "$?"
grep -q "정상" <<<"$OUT"; check "최근 백업: 정상이라고 알린다" "$?"
grep -q "백업 2개" <<<"$OUT"; check "최근 백업: 개수를 알린다" "$?"
grep -q "5시간 전" <<<"$OUT"; check "최근 백업: 가장 최근 것의 나이를 알린다" "$?"

# 2) 가장 최근 백업이 31시간 전이면 실패 (기준 30시간)
new_dir old
make_backup srpfreaks-20251230-000000.sql.gz 31
run env
[ "$CODE" -eq 1 ]; check "오래된 백업: 종료 코드 1" "$?"
grep -q "오래되었습니다" <<<"$OUT"; check "오래된 백업: 이유를 알린다" "$?"
run env MAX_AGE_HOURS=48
[ "$CODE" -eq 0 ]; check "기준을 48시간으로 늘리면 정상" "$?"

# 3) 정확히 30시간 전은 통과(경계), 이 기준은 "초과"만 실패
new_dir edge
make_backup srpfreaks-20251230-120000.sql.gz 30
run env
[ "$CODE" -eq 0 ]; check "경계(30시간): 정상" "$?"

# 4) 백업이 없으면 실패, 폴더가 없어도 실패
new_dir empty
run env
[ "$CODE" -eq 1 ]; check "빈 폴더: 종료 코드 1" "$?"
grep -q "백업 파일이 없습니다" <<<"$OUT"; check "빈 폴더: 이유를 알린다" "$?"
DIR="$TMP/missing"
run env
[ "$CODE" -eq 1 ]; check "폴더 없음: 종료 코드 1" "$?"

# 5) 너무 작은 백업과 손상된 백업은 실패
new_dir small
echo x | gzip -c > "$DIR/srpfreaks-20260101-000000.sql.gz"
touch -d "@$(hours_ago 1)" "$DIR/srpfreaks-20260101-000000.sql.gz"
run env
[ "$CODE" -eq 1 ]; check "작은 백업: 종료 코드 1" "$?"
grep -q "작습니다" <<<"$OUT"; check "작은 백업: 이유를 알린다" "$?"
new_dir broken
head -c 20000 /dev/urandom > "$DIR/srpfreaks-20260101-000000.sql.gz"   # gzip이 아닌 파일
touch -d "@$(hours_ago 1)" "$DIR/srpfreaks-20260101-000000.sql.gz"
run env
[ "$CODE" -eq 1 ]; check "손상된 백업: 종료 코드 1" "$?"
grep -q "손상" <<<"$OUT"; check "손상된 백업: 이유를 알린다" "$?"

# 6) 옛 .sql / .partial 파일은 알리기만 하고 지우지 않는다. 판정에는 영향이 없다
new_dir legacy
make_backup srpfreaks-20260101-000000.sql.gz 2
echo "old" > "$DIR/manual-dump.sql"
echo "tmp" > "$DIR/srpfreaks-20260101-010000.sql.gz.partial"
before="$(ls -1 "$DIR" | sort | tr '\n' ' ')"
run env
[ "$CODE" -eq 0 ]; check "옛 파일이 있어도 정상" "$?"
grep -q "압축 안 된 옛 덤프(.sql) 1개" <<<"$OUT"; check "옛 .sql 개수를 알린다" "$?"
grep -q "(.partial) 1개" <<<"$OUT"; check ".partial 개수를 알린다" "$?"
[ "$before" = "$(ls -1 "$DIR" | sort | tr '\n' ' ')" ]; check "아무 파일도 지우거나 바꾸지 않는다" "$?"

# 7) 출력에 파일 이름이나 경로가 없다 (공개 저장소의 실행 로그에 남는다)
if grep -Eq "srpfreaks-2026|manual-dump|$TMP" <<<"$OUT"; then echo "FAIL [출력에 파일 이름·경로가 있습니다]"; fail=$((fail + 1)); else pass=$((pass + 1)); fi

# 8) 이상한 설정값은 거절한다
run env MAX_AGE_HOURS=abc
[ "$CODE" -eq 2 ]; check "숫자가 아닌 설정값: 종료 코드 2" "$?"
run env MAX_AGE_HOURS=
[ "$CODE" -eq 0 ]; check "빈 설정값은 기본값(30시간)을 쓴다" "$?"

echo "통과 $pass, 실패 $fail"
[ "$fail" -eq 0 ]
