#!/usr/bin/env bash
# 사이트가 알려 주는 프론트 빌드 커밋(/version)이 기대한 커밋과 같아질 때까지 기다린다.
# 사용: check-version.sh <사이트 주소> <기대 커밋(7자리 16진수)> [시도 횟수=12] [간격(초)=10]
# 같아지면 0, 끝까지 다르면 1(원인 줄을 ::error 로 남긴다), 인자가 이상하면 2.
# deploy.yml 의 "배포 버전 확인"과 "프론트 자동 복구" 두 곳이 같은 확인을 쓰려고 한 파일로 뺐다.
set -uo pipefail

SITE="${1:-}"
WANT="${2:-}"
TRIES="${3:-12}"
INTERVAL="${4:-10}"

# 값은 모두 서버/러너 명령 줄에 섞이므로 형태를 먼저 확인한다
case "$SITE" in https://*|http://*) ;; *) echo "사이트 주소가 올바르지 않습니다." >&2; exit 2 ;; esac
printf '%s' "$WANT" | grep -Eq '^[0-9a-f]{7}$' || { echo "기대 커밋은 7자리 16진수여야 합니다." >&2; exit 2; }
printf '%s' "$TRIES" | grep -Eq '^[0-9]+$' && [ "$TRIES" -ge 1 ] || { echo "시도 횟수가 올바르지 않습니다." >&2; exit 2; }
printf '%s' "$INTERVAL" | grep -Eq '^[0-9]+$' || { echo "간격이 올바르지 않습니다." >&2; exit 2; }

got=""
for i in $(seq 1 "$TRIES"); do
  got=$(curl -s --max-time 10 "$SITE/version" | jq -r '.sha // empty' 2>/dev/null || true)
  if [ "$got" = "$WANT" ]; then echo "OK   $SITE/version -> $got"; exit 0; fi
  echo "WAIT $SITE/version -> '${got:-없음}' (기대 $WANT, 시도 $i/$TRIES)"
  [ "$i" -lt "$TRIES" ] && sleep "$INTERVAL"
done
echo "::error title=배포 버전 불일치::사이트의 프론트 커밋이 '${got:-없음}'입니다. 기대값은 $WANT 입니다."
exit 1
