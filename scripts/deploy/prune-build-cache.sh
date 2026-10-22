#!/usr/bin/env bash
# 서버의 도커 "빌드 캐시" 중 오래된 것만 지운다. 배포 직후 deploy.yml이 부른다.
#
# 왜 필요한가: 서버에서 이미지를 직접 빌드하므로 배포할 때마다 빌드 중간 결과가 쌓인다(10일 만에 약 10GB).
# 지우는 것 / 지우지 않는 것
# - 지우는 것: 빌드 캐시뿐이다. 최근 PRUNE_KEEP_HOURS(기본 168시간 = 7일) 안에 쓴 캐시는 남겨서 다음 배포가 느려지지 않게 한다.
# - 지우지 않는 것: 실행 중인 컨테이너, 이미지, 볼륨(DB·인증서). `--all`, `system prune`, `volume prune`은 쓰지 않는다.
# - 실패해도 0으로 끝낸다(디스크 정리는 부가 작업이라 배포를 실패로 만들지 않는다). 단 설정값이 숫자가 아니면 2로 끝낸다.
set -uo pipefail

KEEP_HOURS="${PRUNE_KEEP_HOURS:-168}"
case "$KEEP_HOURS" in
  '' | *[!0-9]*) echo "PRUNE_KEEP_HOURS는 숫자여야 합니다: $KEEP_HOURS" >&2; exit 2 ;;
esac

if docker builder prune --force --filter "until=${KEEP_HOURS}h"; then
  echo "빌드 캐시 정리 완료 (${KEEP_HOURS}시간이 넘은 것만)"
else
  echo "빌드 캐시 정리에 실패했습니다. 배포에는 영향이 없어 계속합니다." >&2
fi
exit 0
