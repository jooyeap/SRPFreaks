#!/usr/bin/env bash
# Flyway 마이그레이션 상태를 숫자로만 보여 준다 (서버에서 실행). Server Ops의 "마이그레이션 상태 보기"가 부른다. 아무것도 바꾸지 않는다.
#
# 왜 필요한가: 배포에서 마이그레이션이 실패하면 Flyway가 "실패" 기록 때문에 백엔드를 띄우지 않는다. SSH 없이도
# "적용된 마지막 버전이 몇이고, 실패 기록이 있는지"를 바로 알 수 있어야 다음 조치(사용자에게 알리기)를 정할 수 있다.
# 실패 기록을 지우는(repair) 기능은 DB를 바꾸는 일이라 일부러 만들지 않는다.
#
# 지켜야 할 것
# - 읽기만 한다: READ ONLY 트랜잭션, 질의는 이 파일에 고정. 공개 로그라 버전 번호·개수·성공 여부만 낸다(스크립트 이름·SQL·오류 문장은 내지 않는다).
# - 비밀번호는 명령줄에 쓰지 않는다(db 컨테이너 안의 환경변수). 종료 코드: 0 정상 / 1 실패 기록 있음 / 2 확인 실패
set -uo pipefail

REPO_DIR="${REPO_DIR:-$HOME/gitalog}"
COMPOSE=(docker compose --env-file "$REPO_DIR/.env.prod" -f "$REPO_DIR/docker-compose.prod.yml")

query() {
  local sql="START TRANSACTION READ ONLY; $1; COMMIT;"
  "${COMPOSE[@]}" exec -T db sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -B -D "$MYSQL_DATABASE" -e "$1"' _ "$sql" 2>/dev/null
}
num() { case "$1" in '' | *[!0-9]*) return 1 ;; *) return 0 ;; esac; }

applied="$(query "SELECT COUNT(*) FROM flyway_schema_history WHERE success = 1" | head -n 1 | tr -d '[:space:]')"
failed="$(query "SELECT COUNT(*) FROM flyway_schema_history WHERE success = 0" | head -n 1 | tr -d '[:space:]')"
latest="$(query "SELECT version FROM flyway_schema_history WHERE success = 1 AND version IS NOT NULL ORDER BY installed_rank DESC LIMIT 1" | head -n 1 | tr -d '[:space:]')"

if ! num "$applied" || ! num "$failed" || ! printf '%s' "$latest" | grep -Eq '^[0-9]+(\.[0-9]+)*$'; then
  echo "마이그레이션 기록을 확인하지 못했습니다."
  exit 2
fi
echo "== 마이그레이션 =="
echo "적용 성공 ${applied}개 · 마지막 버전 V${latest} · 실패 기록 ${failed}개"
if [ "$failed" -gt 0 ]; then
  failed_versions="$(query "SELECT version FROM flyway_schema_history WHERE success = 0 ORDER BY installed_rank" | grep -E '^[0-9]+(\.[0-9]+)*$' | sed 's/^/V/' | tr '\n' ' ')"
  echo "실패한 버전: ${failed_versions:-(확인 실패)}"
  echo "실패 기록이 있으면 백엔드가 시작되지 않습니다. 서버에서 직접 정리가 필요합니다(이 작업은 고치지 않습니다)."
  exit 1
fi
exit 0
