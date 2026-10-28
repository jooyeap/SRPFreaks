#!/usr/bin/env bash
# 서비스 집계 확인 (서버에서 실행). Server Ops의 "집계 확인"이 부른다. 숫자만 보여 주고 아무것도 바꾸지 않는다.
#
# 왜 필요한가: 같은 티어 유저 기록(D53)은 "공개 + 레이팅 기록(스냅샷)이 있는 유저"가 티어마다 5명 이상이어야 보인다.
# 실제로 몇 명인지 알아야 기준(peer.min_band_users)을 조정할지 판단할 수 있다. 백업 폴더의 옛 수동 .sql 파일 개수도 같이 본다.
#
# 지켜야 할 것
# - 읽기만 한다: 모든 질의를 READ ONLY 트랜잭션 안에서 돌린다. 질의는 이 파일에 고정돼 있고 바깥 입력을 받지 않는다.
# - 출력은 공개 저장소의 실행 로그에 남는다. 그래서 개수·크기·티어 이름(고정된 구간 이름)만 낸다.
#   이메일·닉네임·ID·파일 이름은 내지 않는다. MySQL 오류 문장도 내지 않는다(값이 섞일 수 있다).
# - 비밀번호는 명령줄에 쓰지 않는다: db 컨테이너 안의 환경변수(MYSQL_ROOT_PASSWORD, MYSQL_DATABASE)를 컨테이너 안에서 읽는다.
# 종료 코드는 항상 0이다(점검용). 못 읽은 값은 "(확인 실패)"로 보인다.
set -uo pipefail

REPO_DIR="${REPO_DIR:-$HOME/gitalog}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
HOME_DIR="${STATS_HOME_DIR:-$HOME}"
COMPOSE=(docker compose --env-file "$REPO_DIR/.env.prod" -f "$REPO_DIR/docker-compose.prod.yml")

# 질의 하나를 읽기 전용 트랜잭션으로 돌린다. -N -B: 머리글 없이 탭으로 나눈 값만. 오류 문장은 버린다.
query() {
  local sql="START TRANSACTION READ ONLY; $1; COMMIT;"
  "${COMPOSE[@]}" exec -T db sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -B -D "$MYSQL_DATABASE" -e "$1"' _ "$sql" 2>/dev/null
}

# 숫자 하나를 기대하는 질의. 숫자가 아니면(실패·이상한 출력) 값을 그대로 내지 않고 "(확인 실패)"로 바꾼다.
count() {
  local out
  out="$(query "$1" | head -n 1 | tr -d '[:space:]')"
  case "$out" in
    '' | *[!0-9]*) echo "(확인 실패)" ;;
    *) echo "$out" ;;
  esac
}

ACTIVE_PUBLIC="u.profile_public = 1 AND u.status = 'ACTIVE'"
# 같은 티어 통계(D53)가 세는 스냅샷: 곡별 상세가 있는 것만
HAS_ENTRIES="EXISTS (SELECT 1 FROM skill_snapshot_entries e WHERE e.skill_snapshot_id = s.skill_snapshot_id)"

echo "== 유저 =="
echo "전체 $(count "SELECT COUNT(*) FROM users")명 · 공개 $(count "SELECT COUNT(*) FROM users u WHERE $ACTIVE_PUBLIC")명 · 차단 $(count "SELECT COUNT(*) FROM users WHERE status = 'BLOCKED'")명"
echo "기록이 있는 유저 $(count "SELECT COUNT(DISTINCT user_id) FROM option_records")명 · 최근 7일 기록한 유저 $(count "SELECT COUNT(DISTINCT user_id) FROM option_records WHERE updated_at >= UTC_TIMESTAMP() - INTERVAL 7 DAY")명"
echo "기록 $(count "SELECT COUNT(*) FROM option_records")건"

echo "== 곡 =="
# 재킷 가져오기(D54 후보) 용량을 어림하려고 곡·채보 수와 이미 이미지 주소가 있는 곡 수를 센다(삭제된 것 제외).
echo "곡 $(count "SELECT COUNT(*) FROM songs WHERE is_deleted = FALSE")개 · 채보 $(count "SELECT COUNT(*) FROM song_difficulties WHERE is_deleted = FALSE")개 · 이미지 주소가 있는 곡 $(count "SELECT COUNT(*) FROM songs WHERE is_deleted = FALSE AND image_url IS NOT NULL")개"

echo "== 레이팅 기록(스냅샷) =="
echo "전체 $(count "SELECT COUNT(*) FROM skill_snapshots")줄 · 남긴 유저 $(count "SELECT COUNT(DISTINCT user_id) FROM skill_snapshots")명 · 최근 7일 $(count "SELECT COUNT(*) FROM skill_snapshots WHERE snapshot_date >= CURDATE() - INTERVAL 7 DAY")줄"
echo "공개 유저 중 곡별 상세가 있는 스냅샷을 남긴 유저 $(count "SELECT COUNT(DISTINCT s.user_id) FROM skill_snapshots s JOIN users u ON u.user_id = s.user_id WHERE $ACTIVE_PUBLIC AND $HAS_ENTRIES")명"

echo "== 같은 티어 통계 후보 (공개 + 상세 있는 스냅샷, 유저마다 가장 높은 스냅샷의 티어, 5명 이상이면 카드가 보일 수 있음) =="
# 유저마다 가장 높은 스냅샷 총점의 정수부로 티어 구간(min_score 이하 중 가장 큰 것)을 찾는다. 실제 카드는 "보는 사람의 현재 티어 구간 안의 스냅샷"을 쓰므로 대략적인 값이다.
tiers="$(query "SELECT t.display_name, COUNT(*) FROM (SELECT s.user_id, MAX(s.total_score) AS m FROM skill_snapshots s JOIN users u ON u.user_id = s.user_id WHERE $ACTIVE_PUBLIC AND $HAS_ENTRIES GROUP BY s.user_id) x JOIN player_tiers t ON t.min_score = (SELECT MAX(p.min_score) FROM player_tiers p WHERE p.min_score <= FLOOR(x.m)) GROUP BY t.display_name, t.min_score ORDER BY t.min_score")"
if [ -z "$tiers" ]; then
  echo "(해당 유저가 없거나 확인하지 못했습니다)"
else
  # 티어 이름은 고정된 구간 이름이지만, 혹시 다른 글자가 섞이면 내지 않는다
  printf '%s\n' "$tiers" | while IFS=$'\t' read -r name n; do
    if printf '%s' "$name" | grep -Eq '^[A-Za-z0-9 +.-]{1,30}$' && printf '%s' "$n" | grep -Eq '^[0-9]+$'; then
      echo "$name: ${n}명"
    else
      echo "(읽을 수 없는 줄 1개)"
    fi
  done
fi

mb() { awk -v b="$1" 'BEGIN { printf "%.1f", b / 1024 / 1024 }'; }
size_sum() { # 파일 목록(표준입력, 줄마다 하나)의 바이트 합
  local total=0 f s
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    s="$(stat -c %s "$f" 2>/dev/null || echo 0)"
    total=$((total + s))
  done
  echo "$total"
}

echo "== 백업 파일 =="
if [ -d "$BACKUP_DIR" ]; then
  gz_count="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'srpfreaks-*.sql.gz' 2>/dev/null | wc -l | tr -d ' ')"
  newest="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'srpfreaks-*.sql.gz' -printf '%T@\n' 2>/dev/null | sort -n | tail -n 1)"
  oldest="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'srpfreaks-*.sql.gz' -printf '%T@\n' 2>/dev/null | sort -n | head -n 1)"
  now="$(date +%s)"
  if [ -n "$newest" ]; then
    echo "자동 백업(.sql.gz) ${gz_count}개 · 가장 최근 $(( (now - ${newest%.*}) / 3600 ))시간 전 · 가장 오래된 것 $(( (now - ${oldest%.*}) / 86400 ))일 전"
  else
    echo "자동 백업(.sql.gz) 0개"
  fi
  plain_bytes="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.sql' 2>/dev/null | size_sum)"
  plain_count="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.sql' 2>/dev/null | wc -l | tr -d ' ')"
  echo "백업 폴더의 압축 안 된 .sql ${plain_count}개 · $(mb "$plain_bytes")MB"
else
  echo "백업 폴더가 없습니다."
fi
# 예전에 손으로 뜬 덤프가 홈 폴더 바로 아래에 남아 있을 수 있다(이름은 내지 않는다)
home_bytes="$(find "$HOME_DIR" -maxdepth 1 -type f \( -name '*.sql' -o -name '*.sql.gz' \) 2>/dev/null | size_sum)"
home_count="$(find "$HOME_DIR" -maxdepth 1 -type f \( -name '*.sql' -o -name '*.sql.gz' \) 2>/dev/null | wc -l | tr -d ' ')"
echo "홈 폴더 바로 아래의 .sql/.sql.gz ${home_count}개 · $(mb "$home_bytes")MB"
exit 0
