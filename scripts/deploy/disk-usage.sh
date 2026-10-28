#!/usr/bin/env bash
# 서버 디스크 사용량을 숫자로만 보여 준다. Server Ops의 "상태 확인"이 부른다. 읽기만 하고 아무것도 지우거나 바꾸지 않는다.
#
# 왜 필요한가: 디스크가 20~30GB로 작은데 백업·도커 이미지·빌드 캐시가 쌓인다. 가득 차면 DB 쓰기와 배포가 같이 멈춘다.
# 출력: 사용률(%)과 용량(GB), 백업 폴더 크기·개수, 도커가 쓰는 용량. 파일 이름·경로·내용은 내지 않는다(이 저장소는 공개라 실행 로그를 누구나 읽는다).
# 판정: 사용률이 DISK_WARN_PERCENT(기본 80) 이상이면 "주의", DISK_CRIT_PERCENT(기본 90) 이상이면 "위험"으로 표시한다. 종료 코드는 항상 0이다(점검용).
set -uo pipefail

TARGET="${DISK_PATH:-/}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
WARN="${DISK_WARN_PERCENT:-80}"
CRIT="${DISK_CRIT_PERCENT:-90}"
for v in "$WARN" "$CRIT"; do
  case "$v" in '' | *[!0-9]*) echo "기준값은 숫자여야 합니다: $v" >&2; exit 2 ;; esac
done

# df -P: 한 줄 형식(POSIX). 1K 블록 기준으로 total used avail 와 사용률을 읽는다.
read -r total_k used_k avail_k _ < <(df -Pk "$TARGET" 2>/dev/null | awk 'NR==2 {print $2, $3, $4, $5}')
if [ -z "${total_k:-}" ] || [ "$total_k" -le 0 ] 2>/dev/null; then
  echo "디스크 정보를 읽지 못했습니다."
  exit 0
fi
# 사용률은 df가 올림해서 주는 값 대신 직접 계산한다(used / total, 소수 버림).
percent=$(( used_k * 100 / total_k ))
gb() { awk -v k="$1" 'BEGIN { printf "%.1f", k / 1024 / 1024 }'; }

status="정상"
if [ "$percent" -ge "$CRIT" ]; then status="위험"; elif [ "$percent" -ge "$WARN" ]; then status="주의"; fi
echo "== 디스크 =="
echo "사용률 ${percent}% (${status}) · 전체 $(gb "$total_k")GB · 사용 $(gb "$used_k")GB · 남음 $(gb "$avail_k")GB"

echo "== 백업 폴더 =="
if [ -d "$BACKUP_DIR" ]; then
  backup_k="$(du -sk "$BACKUP_DIR" 2>/dev/null | awk '{print $1}')"
  count="$(find "$BACKUP_DIR" -maxdepth 1 -name 'srpfreaks-*.sql.gz' -type f 2>/dev/null | wc -l | tr -d ' ')"
  echo "크기 $(gb "${backup_k:-0}")GB · 백업 ${count}개"
else
  echo "백업 폴더가 없습니다."
fi

echo "== 도커 용량 =="
# 종류별(이미지/컨테이너/볼륨/빌드 캐시) 개수와 크기만 나온다. 이름은 나오지 않는다.
docker system df 2>/dev/null || echo "(도커 용량을 읽지 못했습니다)"
exit 0
