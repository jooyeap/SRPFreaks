#!/usr/bin/env bash
# restore-drill.sh 테스트. 사용: bash scripts/deploy/restore-drill.test.sh
# 진짜 docker/df 대신 가짜를 PATH 앞에 둔다. 마이그레이션은 임시 git 저장소의 origin/main에서 읽게 한다.
# 핵심 확인: (1) 운영 DB 이름(srpfreaks)을 docker에 한 번도 넘기지 않는다 (2) 성공·실패·거절 어느 경우든 임시 DB를 지운다
# (3) 잘못된 입력·위험한 SQL·디스크 부족·백업 없음은 DB를 만들기 전에 막는다 (4) 출력에 MySQL 오류 문장(값이 섞일 수 있음)이 나오지 않는다
set -uo pipefail

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/restore-drill.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fail=0
pass=0

check() { # 이름, 조건 결과(0이면 통과)
  if [ "$2" -eq 0 ]; then pass=$((pass + 1)); else echo "FAIL [$1]"; fail=$((fail + 1)); fi
}

mkdir -p "$TMP/bin" "$TMP/backups" "$TMP/repo"

# ---- 가짜 docker: "_" 뒤가 mysql 인자다. 호출을 로그에 한 줄씩 남기고 상황에 따라 성공/실패한다.
cat > "$TMP/bin/docker" <<'FAKE'
#!/usr/bin/env bash
while [ "$#" -gt 0 ] && [ "$1" != "_" ]; do shift; done
shift
args="$*"
stdin=""
if [ ! -t 0 ]; then stdin="$(cat)"; fi
echo "CALL $args" >> "$FAKE_LOG"
case "$args" in
  *"DROP DATABASE"*) exit 0 ;;
  *"CREATE DATABASE"*) [ "${FAKE_FAIL:-}" = "create" ] && exit 1; exit 0 ;;
  *"information_schema.tables"*) echo 12; exit 0 ;;
  *"success=1"*) echo 14; exit 0 ;;
  *"success=0"*) echo 0; exit 0 ;;
  *"COUNT(*) FROM"*) echo 5; exit 0 ;;
esac
# -e 가 없는 호출 = SQL을 표준입력으로 받는다(덤프 복구 또는 마이그레이션 적용)
case "$stdin" in
  *FAKE_DUMP*) echo "RESTORE" >> "$FAKE_LOG"; [ "${FAKE_FAIL:-}" = "restore" ] && exit 1; exit 0 ;;
  *) echo "APPLY $(printf '%s' "$stdin" | grep -v '^--' | head -n 1)" >> "$FAKE_LOG"
     if [ "${FAKE_FAIL:-}" = "migrate" ]; then
       echo "ERROR 1062 (23000) at line 3: Duplicate entry 'secret@example.com' for key 'users.email'" >&2
       exit 1
     fi
     exit 0 ;;
esac
FAKE
cat > "$TMP/bin/df" <<'FAKE'
#!/usr/bin/env bash
echo "Filesystem 1024-blocks Used Available Capacity Mounted on"
echo "/dev/fake 20971520 1000000 ${FAKE_AVAIL_K:-15000000} 10% /"
FAKE
chmod +x "$TMP/bin/docker" "$TMP/bin/df"

# ---- 임시 git 저장소: origin/main 에 마이그레이션 파일들이 있는 것처럼 만든다
MIG="backend/src/main/resources/db/migration"
mkdir -p "$TMP/repo/$MIG"
printf '%s\n' '-- 설명: use 라는 단어가 주석에 있어도 괜찮다' 'ALTER TABLE a ADD COLUMN x INT NULL;' > "$TMP/repo/$MIG/V15__first.sql"
printf '%s\n' 'CREATE TABLE b (id INT);' > "$TMP/repo/$MIG/V16__second.sql"
printf '%s\n' 'USE srpfreaks;' 'ALTER TABLE a ADD COLUMN y INT;' > "$TMP/repo/$MIG/V90__use_prod.sql"
printf '%s\n' 'UPDATE srpfreaks.users SET email = NULL;' > "$TMP/repo/$MIG/V91__qualified.sql"
printf '%s\n' 'DROP DATABASE srpfreaks;' > "$TMP/repo/$MIG/V92__drop.sql"
printf '%s\n' 'create database other;' > "$TMP/repo/$MIG/V93__create.sql"
(
  cd "$TMP/repo" && git init -q && git add -A \
    && git -c user.email=t@example.com -c user.name=t commit -q -m init \
    && git update-ref refs/remotes/origin/main HEAD
) >/dev/null 2>&1

# ---- 정상 백업 하나 (덤프에 FAKE_DUMP 표시가 있다)
printf 'FAKE_DUMP\n-- Dump completed\n' | gzip > "$TMP/backups/srpfreaks-20261027-000000.sql.gz"

run() { # 호출 쪽에서 앞에 환경변수를 붙인다. 출력은 $OUT, 종료 코드는 $CODE
  : > "$TMP/log"
  OUT="$(PATH="$TMP/bin:$PATH" FAKE_LOG="$TMP/log" REPO_DIR="$TMP/repo" BACKUP_DIR="$TMP/backups" "$@" 2>&1)"
  CODE=$?
}
drill() { run env bash "$SCRIPT" "$@"; }
drill_env() { local e="$1"; shift; run env "$e" bash "$SCRIPT" "$@"; }
no_docker_call() { [ ! -s "$TMP/log" ]; }

# 1) 정상 복구(마이그레이션 없음)
drill
[ "$CODE" -eq 0 ]; check "정상: 종료 코드 0" "$?"
printf '%s' "$OUT" | grep -Fq "복구 성공"; check "정상: 복구 성공 안내" "$?"
printf '%s' "$OUT" | grep -Fq "표 개수: 12"; check "정상: 표 개수" "$?"
printf '%s' "$OUT" | grep -Fq "행 수 users: 5"; check "정상: 행 수" "$?"
printf '%s' "$OUT" | grep -Fq "마이그레이션 최신 버전: 14"; check "정상: 최신 버전" "$?"
grep -Fxq "RESTORE" "$TMP/log"; check "정상: 덤프를 복구했다" "$?"
printf '%s' "$OUT" | grep -Fq "임시 DB 정리 완료"; check "정상: 정리 안내" "$?"
tail -n 1 "$TMP/log" | grep -Fq "DROP DATABASE"; check "정상: 마지막 호출은 임시 DB 삭제" "$?"

# 2) 운영 DB 이름(srpfreaks, _drill 아님)은 docker 호출에 한 번도 나오지 않는다
! grep -Eq 'srpfreaks([^_]|$)' "$TMP/log"; check "운영 DB 이름이 docker 호출에 없다" "$?"
grep -Fq 'srpfreaks_drill' "$TMP/log"; check "임시 DB 이름은 쓴다" "$?"

# 3) 마이그레이션 리허설: 적은 순서대로 적용
drill V15__first.sql V16__second.sql
[ "$CODE" -eq 0 ]; check "리허설: 종료 코드 0" "$?"
grep '^APPLY' "$TMP/log" | head -n 1 | grep -Fq "ALTER TABLE a"; check "리허설: V15를 먼저" "$?"
grep '^APPLY' "$TMP/log" | sed -n 2p | grep -Fq "CREATE TABLE b"; check "리허설: V16을 그다음" "$?"
printf '%s' "$OUT" | grep -Fq "리허설 성공: V15"; check "리허설: V15 성공 안내" "$?"
printf '%s' "$OUT" | grep -Fq "리허설 후 사본"; check "리허설: 적용 후 숫자 다시 보고" "$?"

# 4) 마이그레이션 실패: 오류 번호만 보이고 값은 안 보인다, 거기서 멈추고 정리한다
drill_env FAKE_FAIL=migrate V15__first.sql V16__second.sql
[ "$CODE" -eq 1 ]; check "실패: 종료 코드 1" "$?"
printf '%s' "$OUT" | grep -Fq "MySQL 오류 번호 1062"; check "실패: 오류 번호가 나온다" "$?"
! printf '%s' "$OUT" | grep -Fq "secret@example.com"; check "실패: 오류 문장(값)은 출력에 없다" "$?"
[ "$(grep -c '^APPLY' "$TMP/log")" -eq 1 ]; check "실패: 첫 실패에서 멈춘다" "$?"
tail -n 1 "$TMP/log" | grep -Fq "DROP DATABASE"; check "실패: 그래도 임시 DB를 지운다" "$?"

# 5) 복구 실패: 그래도 정리한다
drill_env FAKE_FAIL=restore
[ "$CODE" -eq 1 ]; check "복구 실패: 종료 코드 1" "$?"
tail -n 1 "$TMP/log" | grep -Fq "DROP DATABASE"; check "복구 실패: 임시 DB를 지운다" "$?"

# 6) 임시 DB를 못 만들면 실패(복구 시도 안 함)
drill_env FAKE_FAIL=create
[ "$CODE" -eq 1 ]; check "생성 실패: 종료 코드 1" "$?"
! grep -Fxq "RESTORE" "$TMP/log"; check "생성 실패: 복구를 시도하지 않는다" "$?"

# 7) 잘못된 파일 이름은 docker를 부르기 전에 거절
for bad in "V1__a.sql; rm -rf /" "../x.sql" "V1.sql" "v15__a.sql" 'V15__a$(id).sql' "V15__a.sql V16"; do
  drill $bad
  [ "$CODE" -eq 2 ]; check "이름 거절 [$bad]" "$?"
  no_docker_call; check "이름 거절이면 docker를 안 부른다 [$bad]" "$?"
done

# 8) 위험한 SQL(USE, 운영 DB 이름이 붙은 표, DROP/CREATE DATABASE)은 DB를 만들기 전에 거절
for risky in V90__use_prod.sql V91__qualified.sql V92__drop.sql V93__create.sql; do
  drill "$risky"
  [ "$CODE" -eq 2 ]; check "위험 SQL 거절 [$risky]" "$?"
  no_docker_call; check "위험 SQL이면 docker를 안 부른다 [$risky]" "$?"
done

# 9) 없는 마이그레이션 파일
drill V77__missing.sql
[ "$CODE" -eq 2 ]; check "없는 파일: 종료 코드 2" "$?"
no_docker_call; check "없는 파일이면 docker를 안 부른다" "$?"

# 10) 디스크 여유 부족(필요 2GB 미만)
drill_env FAKE_AVAIL_K=1000000
[ "$CODE" -eq 3 ]; check "디스크 부족: 종료 코드 3" "$?"
no_docker_call; check "디스크 부족이면 docker를 안 부른다" "$?"

# 11) 백업이 없거나 손상됨
mv "$TMP/backups/srpfreaks-20261027-000000.sql.gz" "$TMP/saved.gz"
drill
[ "$CODE" -eq 1 ]; check "백업 없음: 종료 코드 1" "$?"
no_docker_call; check "백업 없음이면 docker를 안 부른다" "$?"
printf 'not gzip' > "$TMP/backups/srpfreaks-20261027-000001.sql.gz"
drill
[ "$CODE" -eq 1 ]; check "손상 백업: 종료 코드 1" "$?"
no_docker_call; check "손상 백업이면 docker를 안 부른다" "$?"

echo "통과 $pass, 실패 $fail"
[ "$fail" -eq 0 ]
