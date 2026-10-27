#!/usr/bin/env bash
# 백업 복구 연습 (서버에서 실행). 가장 최근 백업을 "임시 DB"에 복구해 보고, 원하면 마이그레이션 파일을 그 사본에만 적용해 본다.
# "백업은 한 번도 복구해 보지 않으면 있는 것이 아니다"와 "운영 DB에 넣기 전에 실제 데이터로 마이그레이션 리허설"이 목적이다.
#
# 지켜야 할 것
# - 운영 DB(srpfreaks)는 절대 건드리지 않는다. 쓰는 DB 이름은 아래 DRILL_DB 하나로 고정이고 바꿀 수 없다.
#   · 마이그레이션 파일에 `USE`, `CREATE/DROP DATABASE`, `srpfreaks.`(DB 이름을 붙인 표)가 있으면 실행하기 전에 거절한다.
# - 끝나면(성공·실패·중단 모두) 임시 DB를 반드시 지운다(trap).
# - 출력은 공개 저장소의 실행 로그에 남는다. 그래서 숫자(표 개수·행 수·오류 번호·초)만 낸다. 데이터, 파일 이름, MySQL 오류 문장은 내지 않는다
#   (오류 문장에는 `Duplicate entry '이메일'`처럼 값이 섞일 수 있다).
# - 디스크 여유가 모자라면 시작하지 않는다(압축 백업 크기의 8배 또는 2GB 중 큰 쪽).
# - 비밀번호는 명령줄에 쓰지 않는다: db 컨테이너 안의 환경변수(MYSQL_ROOT_PASSWORD)를 컨테이너 안에서 읽는다.
#
# 사용 (서버에서): restore-drill.sh [V15__add_snapshot_levels.sql V16__add_setlist_events.sql ...]   ← 마이그레이션은 적은 순서대로 적용한다
# 마이그레이션 파일은 origin/main의 backend/src/main/resources/db/migration 에서만 읽는다(이름은 V숫자__영문.sql 형식만 허용).
# 종료 코드: 0 성공 / 1 복구·검증·마이그레이션 실패 / 2 잘못된 입력 / 3 디스크 여유 부족
set -uo pipefail

REPO_DIR="${REPO_DIR:-$HOME/gitalog}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
DISK_PATH="${DRILL_DISK_PATH:-/}"
readonly DRILL_DB="srpfreaks_drill"
readonly MIGRATION_DIR="backend/src/main/resources/db/migration"
COMPOSE=(docker compose --env-file "$REPO_DIR/.env.prod" -f "$REPO_DIR/docker-compose.prod.yml")

# 1) 입력 검사: 파일 이름이 형식에 맞는지 먼저 본다(아무것도 실행하기 전에).
for f in "$@"; do
  if ! printf '%s' "$f" | grep -Eq '^V[0-9]+__[A-Za-z0-9_]+\.sql$'; then
    echo "마이그레이션 파일 이름 형식이 올바르지 않습니다." >&2
    exit 2
  fi
done

# mysql을 db 컨테이너 안에서 실행한다. 비밀번호는 컨테이너 안 환경변수로 읽는다. 인자는 "$@"로 그대로 넘긴다.
mysql_root() {
  "${COMPOSE[@]}" exec -T db sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$@"' _ "$@"
}

drop_drill() {
  mysql_root -e "DROP DATABASE IF EXISTS \`$DRILL_DB\`" >/dev/null 2>&1
}

# 2) 가장 최근 정상 백업 고르기
shopt -s nullglob
backups=("$BACKUP_DIR"/srpfreaks-*.sql.gz)
shopt -u nullglob
if [ "${#backups[@]}" -eq 0 ]; then
  echo "백업 파일이 없습니다." >&2
  exit 1
fi
newest="$(ls -1t "${backups[@]}" | head -n 1)"
if ! gzip -t "$newest" 2>/dev/null; then
  echo "가장 최근 백업의 압축이 손상되었습니다." >&2
  exit 1
fi
backup_k=$(( ($(stat -c %s "$newest") + 1023) / 1024 ))
echo "복구할 백업: 가장 최근 1개 (압축 ${backup_k}KB)"

# 3) 디스크 여유 확인
avail_k="$(df -Pk "$DISK_PATH" 2>/dev/null | awk 'NR==2 {print $4}')"
need_k=$(( backup_k * 8 ))
[ "$need_k" -lt 2097152 ] && need_k=2097152
if [ -z "$avail_k" ] || [ "$avail_k" -lt "$need_k" ]; then
  echo "디스크 여유가 부족해 시작하지 않습니다. (필요 약 $((need_k / 1024))MB, 남음 약 $(( ${avail_k:-0} / 1024 ))MB)" >&2
  exit 3
fi

# 4) 마이그레이션 파일 미리 읽어서 위험한 문장이 없는지 확인한다(DB를 만들기 전에)
if [ "$#" -gt 0 ]; then
  git -C "$REPO_DIR" fetch origin main >/dev/null 2>&1 || echo "(origin/main을 새로 받지 못했습니다. 서버에 있는 사본을 씁니다.)"
fi
for f in "$@"; do
  content="$(git -C "$REPO_DIR" show "origin/main:$MIGRATION_DIR/$f" 2>/dev/null)" || { echo "마이그레이션 파일을 찾지 못했습니다: 요청한 파일 중 하나" >&2; exit 2; }
  # 주석 줄(-- ...)은 빼고 검사한다("use" 같은 일반 단어가 설명 글에 있어도 거절하지 않게)
  code_only="$(printf '%s' "$content" | grep -v '^[[:space:]]*--')"
  if printf '%s' "$code_only" | grep -Eiq '(^|[^[:alnum:]_])(use|create[[:space:]]+database|drop[[:space:]]+database)[[:space:]`]' \
     || printf '%s' "$code_only" | grep -Eiq '(^|[^[:alnum:]_])srpfreaks[[:space:]]*\.'; then
    echo "마이그레이션에 DB를 바꾸거나 DB 이름을 붙인 문장이 있어 거절합니다." >&2
    exit 2
  fi
done

# 5) 여기서부터 임시 DB를 만든다. 어떻게 끝나든 지운다.
trap 'drop_drill; echo "임시 DB 정리 완료"' EXIT
trap 'exit 1' HUP INT TERM
started=$SECONDS
drop_drill
if ! mysql_root -e "CREATE DATABASE \`$DRILL_DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci" >/dev/null 2>&1; then
  echo "임시 DB를 만들지 못했습니다." >&2
  exit 1
fi

# 6) 복구. 덤프에는 USE가 없으므로 다른 이름의 DB에 그대로 들어간다. 오류 문장은 버리고 성공 여부만 본다.
if ! nice -n 19 gzip -dc "$newest" | mysql_root --default-character-set=utf8mb4 "$DRILL_DB" >/dev/null 2>&1; then
  echo "복구 실패" >&2
  exit 1
fi
echo "복구 성공 ($((SECONDS - started))초)"

count_of() { # 표 이름 → 행 수 또는 "없음"
  local n
  if n="$(mysql_root -N -B "$DRILL_DB" -e "SELECT COUNT(*) FROM \`$1\`" 2>/dev/null)" && [ -n "$n" ]; then echo "$n"; else echo "없음"; fi
}

report() { # 검증 숫자만 낸다
  echo "표 개수: $(mysql_root -N -B -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DRILL_DB'" 2>/dev/null)"
  for t in users option_records songs song_difficulties skill_snapshots skill_snapshot_entries setlist_items audit_logs; do
    echo "행 수 $t: $(count_of "$t")"
  done
  echo "마이그레이션 최신 버전: $(mysql_root -N -B "$DRILL_DB" -e "SELECT version FROM flyway_schema_history WHERE success=1 ORDER BY installed_rank DESC LIMIT 1" 2>/dev/null)"
  echo "마이그레이션 실패 기록: $(mysql_root -N -B "$DRILL_DB" -e "SELECT COUNT(*) FROM flyway_schema_history WHERE success=0" 2>/dev/null)"
}

echo "== 복구한 사본 검증 =="
report

# 7) 마이그레이션 리허설: 임시 DB에만, 적은 순서대로, 하나라도 실패하면 거기서 멈춘다.
status=0
for f in "$@"; do
  step=$SECONDS
  err="$(git -C "$REPO_DIR" show "origin/main:$MIGRATION_DIR/$f" | mysql_root --default-character-set=utf8mb4 "$DRILL_DB" 2>&1 >/dev/null)"
  rc=$?
  if [ "$rc" -eq 0 ]; then
    echo "리허설 성공: ${f%%__*} ($((SECONDS - step))초)"
  else
    # MySQL 오류 문장은 값이 섞일 수 있어 번호만 낸다
    code="$(printf '%s' "$err" | sed -n 's/^ERROR \([0-9][0-9]*\).*/\1/p' | head -n 1)"
    echo "리허설 실패: ${f%%__*} (MySQL 오류 번호 ${code:-알 수 없음})" >&2
    status=1
    break
  fi
done
if [ "$#" -gt 0 ] && [ "$status" -eq 0 ]; then
  echo "== 리허설 후 사본 =="
  report
fi
echo "전체 ${SECONDS}초"
exit "$status"
