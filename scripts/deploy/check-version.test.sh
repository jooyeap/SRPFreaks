#!/usr/bin/env bash
# check-version.sh 테스트. 사용: bash scripts/deploy/check-version.test.sh
# 진짜 사이트 대신 응답을 순서대로 돌려주는 가짜 curl을 PATH 앞에 둔다(jq는 진짜를 쓴다).
# 핵심 확인: (1) 처음부터 같으면 바로 성공 (2) 몇 번 다르다가 같아지면 성공 (3) 끝까지 다르면 실패하고 시도 횟수만큼만 부른다 (4) 이상한 인자는 거절한다.
set -uo pipefail

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/check-version.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fail=0
pass=0

check() { # 이름, 조건 결과(0이면 통과)
  if [ "$2" -eq 0 ]; then pass=$((pass + 1)); else echo "FAIL [$1]"; fail=$((fail + 1)); fi
}

# 가짜 curl: FAKE_CURL_REPLIES(공백으로 구분한 sha 목록)를 호출 순서대로 하나씩 JSON으로 돌려준다. 목록이 끝나면 마지막 값을 반복한다.
mkdir -p "$TMP/bin"
cat > "$TMP/bin/curl" <<'FAKE'
#!/usr/bin/env bash
n=$(cat "$FAKE_CURL_COUNT" 2>/dev/null || echo 0)
n=$((n + 1)); echo "$n" > "$FAKE_CURL_COUNT"
read -r -a replies <<< "$FAKE_CURL_REPLIES"
idx=$((n - 1)); [ "$idx" -ge "${#replies[@]}" ] && idx=$((${#replies[@]} - 1))
sha="${replies[$idx]}"
if [ "$sha" = "none" ]; then echo "not json"; else printf '{"sha":"%s"}\n' "$sha"; fi
FAKE
chmod +x "$TMP/bin/curl"

run() { # 가짜 응답 목록, 나머지 인자는 스크립트에 그대로. 출력은 $OUT, 종료 코드는 $CODE, curl 호출 수는 $CALLS
  local replies="$1"; shift
  : > "$TMP/count"
  OUT="$(PATH="$TMP/bin:$PATH" FAKE_CURL_REPLIES="$replies" FAKE_CURL_COUNT="$TMP/count" bash "$SCRIPT" "$@" 2>&1)"
  CODE=$?
  CALLS=$(cat "$TMP/count" 2>/dev/null); CALLS=${CALLS:-0}
}

# 1) 처음부터 같으면 한 번만 확인하고 성공
run "abc1234" https://example.test abc1234 5 0
[ "$CODE" -eq 0 ]; check "바로 일치: 종료 코드 0" "$?"
[ "$CALLS" -eq 1 ]; check "바로 일치: curl을 한 번만 부른다" "$?"

# 2) 옛 커밋이 두 번 나오다 새 커밋으로 바뀌면 성공
run "old0001 old0001 abc1234" https://example.test abc1234 5 0
[ "$CODE" -eq 0 ]; check "나중에 일치: 종료 코드 0" "$?"
[ "$CALLS" -eq 3 ]; check "나중에 일치: 세 번째에 멈춘다" "$?"

# 3) 끝까지 옛 커밋이면 실패하고, 시도 횟수만큼만 부른다
run "old0001" https://example.test abc1234 4 0
[ "$CODE" -eq 1 ]; check "끝까지 불일치: 종료 코드 1" "$?"
[ "$CALLS" -eq 4 ]; check "끝까지 불일치: 4번만 부른다" "$?"
printf '%s' "$OUT" | grep -Fq "배포 버전 불일치"; check "끝까지 불일치: 오류 안내가 나온다" "$?"

# 4) JSON이 아닌 응답(점검 화면 등)도 불일치로 본다
run "none" https://example.test abc1234 2 0
[ "$CODE" -eq 1 ]; check "응답이 JSON이 아니면 불일치" "$?"
printf '%s' "$OUT" | grep -Fq "'없음'"; check "응답이 JSON이 아니면 '없음'으로 보인다" "$?"

# 5) 이상한 인자는 curl을 부르기 전에 거절한다(종료 코드 2)
run "abc1234" ftp://example.test abc1234 5 0
[ "$CODE" -eq 2 ] && [ "$CALLS" -eq 0 ]; check "http/https가 아닌 주소 거절" "$?"
run "abc1234" https://example.test 'abc123;rm' 5 0
[ "$CODE" -eq 2 ] && [ "$CALLS" -eq 0 ]; check "형식이 틀린 커밋 거절" "$?"
run "abc1234" https://example.test abc1234 0 0
[ "$CODE" -eq 2 ]; check "시도 횟수 0 거절" "$?"
run "abc1234" https://example.test abc1234 x 0
[ "$CODE" -eq 2 ]; check "시도 횟수가 숫자가 아니면 거절" "$?"

if [ "$fail" -eq 0 ]; then echo "check-version 테스트 통과 ($pass개)"; exit 0; else echo "check-version 테스트 실패 ($fail개 실패, $pass개 통과)"; exit 1; fi
