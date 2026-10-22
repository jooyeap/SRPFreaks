#!/usr/bin/env bash
# prune-build-cache.sh 테스트. 사용: bash scripts/deploy/prune-build-cache.test.sh
# 진짜 docker 대신 인자를 기록하는 가짜 docker를 PATH 앞에 둔다.
# 핵심 확인: (1) 빌드 캐시 정리만 부른다 (2) 이미지·볼륨·전체 정리 옵션이 절대 붙지 않는다 (3) 실패해도 배포를 막지 않는다 (4) 이상한 설정값은 docker를 부르기 전에 거절한다.
set -uo pipefail

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/prune-build-cache.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fail=0
pass=0

check() { # 이름, 조건 결과(0이면 통과)
  if [ "$2" -eq 0 ]; then pass=$((pass + 1)); else echo "FAIL [$1]"; fail=$((fail + 1)); fi
}

# 가짜 docker: 받은 인자를 한 줄로 기록하고, FAKE_DOCKER_EXIT 값으로 끝난다.
mkdir -p "$TMP/bin"
cat > "$TMP/bin/docker" <<'FAKE'
#!/usr/bin/env bash
echo "$*" >> "$FAKE_DOCKER_LOG"
exit "${FAKE_DOCKER_EXIT:-0}"
FAKE
chmod +x "$TMP/bin/docker"

run() { # 환경변수는 호출 쪽에서 앞에 붙인다. 출력은 $OUT, 종료 코드는 $CODE
  : > "$TMP/log"
  OUT="$(PATH="$TMP/bin:$PATH" FAKE_DOCKER_LOG="$TMP/log" "$@" bash "$SCRIPT" 2>&1)"
  CODE=$?
}

# 1) 기본값: 7일(168시간) 넘은 빌드 캐시만
run env
check "기본: 종료 코드 0" "$CODE"
grep -Fxq "builder prune --force --filter until=168h" "$TMP/log"; check "기본: builder prune을 168시간 필터로 부른다" "$?"
[ "$(wc -l < "$TMP/log")" -eq 1 ]; check "기본: docker를 한 번만 부른다" "$?"

# 2) 위험한 옵션은 어떤 경우에도 붙지 않는다
for bad in "--all" " -a" "system" "volume" "image" "container" "--volumes"; do
  if grep -Fq -- "$bad" "$TMP/log"; then echo "FAIL [위험 옵션 '$bad' 이(가) 붙었습니다]"; fail=$((fail + 1)); else pass=$((pass + 1)); fi
done

# 3) 보관 시간 바꾸기
run env PRUNE_KEEP_HOURS=24
grep -Fxq "builder prune --force --filter until=24h" "$TMP/log"; check "PRUNE_KEEP_HOURS=24 반영" "$?"

# 4) docker가 실패해도 배포를 막지 않는다(0으로 끝나고 안내가 나온다)
run env FAKE_DOCKER_EXIT=1
check "docker 실패해도 종료 코드 0" "$CODE"
printf '%s' "$OUT" | grep -Fq "실패했습니다"; check "docker 실패 안내가 나온다" "$?"

# 5) 숫자가 아닌 값은 docker를 부르기 전에 거절한다(명령에 끼어드는 값 방지)
for badval in "abc" "24; rm -rf /" "-1" "1.5" '$(echo x)'; do
  run env PRUNE_KEEP_HOURS="$badval"
  [ "$CODE" -eq 2 ]; check "이상한 값 거절 [$badval]" "$?"
  [ ! -s "$TMP/log" ]; check "이상한 값이면 docker를 부르지 않는다 [$badval]" "$?"
done

echo "통과 $pass, 실패 $fail"
[ "$fail" -eq 0 ]
