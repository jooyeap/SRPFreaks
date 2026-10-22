#!/usr/bin/env bash
# DB 백업이 잘 쌓이고 있는지 점검한다 (서버에서 실행. 아무것도 바꾸거나 지우지 않는다. 읽기만 한다).
#
# 확인하는 것
# - 백업 파일(srpfreaks-*.sql.gz)이 있는지
# - 가장 최근 백업이 MAX_AGE_HOURS(기본 30시간)보다 오래되지 않았는지 (백업은 하루 한 번이라 30시간이면 하루를 놓친 것이다)
# - 가장 최근 백업이 너무 작지 않은지(MIN_SIZE_BYTES, 기본 2048)와 압축이 온전한지(gzip -t)
# 하나라도 어긋나면 종료 코드 1이다(GitHub Actions가 빨갛게 되어 알림이 온다).
#
# 출력은 공개 저장소의 실행 로그에 남는다. 그래서 개수·나이·크기 같은 숫자만 내고, 경로·파일 이름·내용은 내지 않는다.
#
# 환경변수: BACKUP_DIR(기본 ~/backups), MAX_AGE_HOURS(기본 30), MIN_SIZE_BYTES(기본 2048), CHECK_NOW(테스트용 현재 시각, 초)
set -uo pipefail

DIR="${BACKUP_DIR:-$HOME/backups}"
MAX_AGE_HOURS="${MAX_AGE_HOURS:-30}"
MIN_SIZE="${MIN_SIZE_BYTES:-2048}"
NOW="${CHECK_NOW:-$(date +%s)}"

# 숫자가 아닌 설정값은 거절한다(잘못된 값으로 "정상"이라고 잘못 알리는 것보다 낫다)
for v in "$MAX_AGE_HOURS" "$MIN_SIZE" "$NOW"; do
  case "$v" in
    ''|*[!0-9]*) echo "설정값이 숫자가 아닙니다." >&2; exit 2 ;;
  esac
done

shopt -s nullglob
files=("$DIR"/srpfreaks-*.sql.gz)
count=${#files[@]}
if [ "$count" -eq 0 ]; then
  echo "백업 파일이 없습니다."
  exit 1
fi

newest=""; newest_mtime=0; total=0
for f in "${files[@]}"; do
  mtime="$(stat -c %Y "$f")"
  size="$(stat -c %s "$f")"
  total=$((total + size))
  if [ "$mtime" -gt "$newest_mtime" ]; then newest="$f"; newest_mtime="$mtime"; fi
done

age_hours=$(( (NOW - newest_mtime) / 3600 ))
newest_size="$(stat -c %s "$newest")"
echo "백업 ${count}개, 합계 $((total / 1024 / 1024))MB"
echo "가장 최근 백업: ${age_hours}시간 전, ${newest_size} bytes"

# 예전에 손으로 만든 압축 안 된 덤프(.sql)와 중단된 작업 파일(.partial)은 알리기만 한다(정리 스크립트가 지우지 않는다)
legacy=("$DIR"/*.sql)
partial=("$DIR"/*.partial)
[ "${#legacy[@]}" -gt 0 ] && echo "참고: 압축 안 된 옛 덤프(.sql) ${#legacy[@]}개가 남아 있습니다(자동으로 지워지지 않습니다)."
[ "${#partial[@]}" -gt 0 ] && echo "참고: 끝나지 않은 백업 작업 파일(.partial) ${#partial[@]}개가 있습니다."

status=0
if [ "$age_hours" -gt "$MAX_AGE_HOURS" ]; then
  echo "문제: 가장 최근 백업이 ${MAX_AGE_HOURS}시간보다 오래되었습니다. 크론이 도는지 확인하세요." >&2
  status=1
fi
if [ "$newest_size" -lt "$MIN_SIZE" ]; then
  echo "문제: 가장 최근 백업이 비정상적으로 작습니다." >&2
  status=1
fi
if ! gzip -t "$newest" 2>/dev/null; then
  echo "문제: 가장 최근 백업의 압축이 손상되었습니다." >&2
  status=1
fi
[ "$status" -eq 0 ] && echo "정상"
exit "$status"
