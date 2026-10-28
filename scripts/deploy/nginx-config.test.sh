#!/usr/bin/env bash
# nginx 경로 규칙(nginx/locations.conf) 점검. 운영과 같은 nginx 이미지로 로컬 설정(HTTP)을 띄워 확인한다.
#  - 설정 문법이 맞다(nginx -t)
#  - 프론트에 연결되지 않으면(배포 중) 빈 502 대신 503 + 안내 화면(한국어·일본어)이 나온다
#  - API는 안내 화면을 쓰지 않는다(화면이 JSON이 아닌 응답을 일반 오류 문구로 바꾼다)
#  - 재킷(D54): /jackets/{숫자}.webp만 image/webp로 내보내고, 다른 이름·폴더 목록은 404
# backend·frontend 이름은 컨테이너 안의 127.0.0.1(아무것도 듣지 않음)로 돌려 "연결 안 됨"을 만든다.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IMAGE="nginx:1.27-alpine"
NAME="srpfreaks-nginx-test-$$"
PORT="${NGINX_TEST_PORT:-18080}"
fail=0
JACKETS="$(mktemp -d)"
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; rm -rf "$JACKETS"; }
trap cleanup EXIT
printf 'RIFFtestWEBP' > "$JACKETS/12.webp"
printf 'secret' > "$JACKETS/upload-1.tmp"
chmod -R a+rX "$JACKETS"

MOUNTS=(--add-host backend:127.0.0.1 --add-host frontend:127.0.0.1
  -v "$ROOT/nginx/local.conf.template:/etc/nginx/conf.d/default.conf:ro"
  -v "$ROOT/nginx/locations.conf:/etc/nginx/snippets/locations.conf:ro"
  -v "$JACKETS:/srv/jackets:ro")

if docker run --rm "${MOUNTS[@]}" "$IMAGE" nginx -t >/dev/null 2>&1; then
  echo "OK   nginx -t"
else
  echo "FAIL nginx -t"; docker run --rm "${MOUNTS[@]}" "$IMAGE" nginx -t || true; exit 1
fi

docker run -d --name "$NAME" -p "127.0.0.1:$PORT:80" "${MOUNTS[@]}" "$IMAGE" >/dev/null
for i in $(seq 1 20); do curl -s -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.5; done

body="$(curl -s -w '\n%{http_code}' "http://127.0.0.1:$PORT/table")"
code="${body##*$'\n'}"
check() { if eval "$2"; then echo "OK   $1"; else echo "FAIL $1"; fail=1; fi; }
check "화면 요청은 503" '[ "$code" = 503 ]'
check "한국어 안내" '[[ "$body" == *"잠시 후 다시 시도해 주세요"* ]]'
check "일본어 안내" '[[ "$body" == *"しばらくしてからもう一度お試しください"* ]]'
api="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/v1/notices")"
check "API는 안내 화면 없이 502 그대로" '[ "$api" = 502 ]'
actuator="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/actuator/health")"
check "헬스체크 경로는 바깥에서 404" '[ "$actuator" = 404 ]'
jk="$(curl -s -o /dev/null -w '%{http_code} %{content_type}' "http://127.0.0.1:$PORT/jackets/12.webp?v=abcd1234")"
check "재킷은 image/webp로 내보낸다" '[ "$jk" = "200 image/webp" ]'
jk_cache="$(curl -s -D - -o /dev/null "http://127.0.0.1:$PORT/jackets/12.webp" | tr -d '\r' | grep -i '^cache-control:' || true)"
check "재킷은 7일 캐시" '[[ "$jk_cache" == *"max-age=604800"* ]]'
check "없는 재킷은 404" '[ "$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/jackets/99.webp")" = 404 ]'
check "임시 파일은 404" '[ "$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/jackets/upload-1.tmp")" = 404 ]'
check "재킷 폴더 목록은 404" '[ "$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/jackets/")" = 404 ]'
exit $fail
