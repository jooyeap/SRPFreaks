#!/usr/bin/env bash
# summarize-errors.sh 테스트. 사용: bash scripts/deploy/summarize-errors.test.sh
# 핵심 확인: (1) 건수가 맞다 (2) 메시지에 섞인 이메일·토큰·SQL·값이 출력에 절대 나오지 않는다.
set -uo pipefail

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/summarize-errors.sh"
fail=0
pass=0

assert_contains() { # 이름, 출력, 찾을 글자
  if printf '%s' "$2" | grep -Fq -- "$3"; then pass=$((pass + 1)); else echo "FAIL [$1] '$3' 이(가) 없습니다. 출력:"; printf '%s\n' "$2"; fail=$((fail + 1)); fi
}
assert_absent() { # 이름, 출력, 있으면 안 되는 글자
  if printf '%s' "$2" | grep -Fq -- "$3"; then echo "FAIL [$1] 출력에 '$3' 이(가) 새어 나왔습니다. 출력:"; printf '%s\n' "$2"; fail=$((fail + 1)); else pass=$((pass + 1)); fi
}

# ---- app: Spring 로그 ----
APP_LOG='2026-10-21T10:00:00.123Z  INFO 1 --- [app] [exec-1] c.s.b.controller.NoticeController : 정상 요청 user@example.com
2026-10-21T10:00:01.123Z ERROR 1 --- [app] [exec-2] c.s.b.service.RecordService : 저장 실패 user@example.com token=eyJhbGciOiJIUzI1NiJ9.abc.def
java.lang.IllegalStateException: SELECT * FROM users WHERE email = '"'"'user@example.com'"'"'
	at com.srpfreaks.backend.service.RecordService.save(RecordService.java:10)
Caused by: org.hibernate.exception.SQLGrammarException: could not execute statement password=hunter2
2026-10-21T10:00:02.123Z ERROR 1 --- [app] [exec-3] c.s.b.service.RecordService : 또 실패
2026-10-21T10:00:03.123Z  WARN 1 --- [app] [exec-4] c.s.b.security.RateLimitFilter : 제한 초과 192.168.0.7'

out="$(printf '%s\n' "$APP_LOG" | bash "$SCRIPT" app)"
assert_contains "app 에러 로거 2건" "$out" "2	ERROR c.s.b.service.RecordService"
assert_contains "app 경고 로거" "$out" "1	WARN c.s.b.security.RateLimitFilter"
assert_contains "app 예외 종류" "$out" "1	예외 java.lang.IllegalStateException"
assert_contains "app 원인 예외 종류" "$out" "1	예외 org.hibernate.exception.SQLGrammarException"
assert_absent "app INFO 줄은 세지 않는다" "$out" "NoticeController"
assert_absent "app 이메일 비노출" "$out" "user@example.com"
assert_absent "app 토큰 비노출" "$out" "eyJhbGci"
assert_absent "app SQL 비노출" "$out" "SELECT"
assert_absent "app 비밀번호 비노출" "$out" "hunter2"
assert_absent "app IP 비노출" "$out" "192.168"
assert_absent "app 스택 프레임 비노출" "$out" "RecordService.java"

# 건수가 많은 순서
first="$(printf '%s\n' "$out" | head -n 1)"
assert_contains "app 많은 순서" "$first" "2	ERROR c.s.b.service.RecordService"

# 오류가 없으면 안내 문구
out="$(printf '2026-10-21T10:00:00.123Z  INFO 1 --- [app] [exec-1] c.s.b.Foo : ok\n' | bash "$SCRIPT" app)"
assert_contains "app 오류 없음" "$out" "오류 없음"
out="$(printf '' | bash "$SCRIPT" app)"
assert_contains "app 빈 입력" "$out" "오류 없음"

# 로거 자리에 이상한 글자(값이 섞인 경우)가 오면 로거 이름을 쓰지 않는다
out="$(printf '2026-10-21T10:00:01.123Z ERROR 1 --- [app] [exec-2] user@example.com : x\n' | bash "$SCRIPT" app)"
assert_absent "app 로거 자리 값 비노출" "$out" "user@example.com"
assert_contains "app 로거 알 수 없음" "$out" "로거 알 수 없음"

# ---- web: 프론트 로그 ----
WEB_LOG=' ⨯ TypeError: Cannot read properties of undefined (reading '"'"'secret-id-123'"'"')
GET /songs/5 200 in 30ms
 ⨯ TypeError: another one user@example.com'
out="$(printf '%s\n' "$WEB_LOG" | bash "$SCRIPT" web)"
assert_contains "web 종류 2건" "$out" "2	오류 TypeError"
assert_absent "web 메시지 비노출" "$out" "secret-id-123"
assert_absent "web 이메일 비노출" "$out" "user@example.com"

# ---- nginx: 접속 로그 ----
NGINX_LOG='203.0.113.9 - - [21/Oct/2026:10:00:00 +0000] "GET /api/v1/me?token=abc HTTP/1.1" 502 150 "-" "curl/8"
203.0.113.9 - - [21/Oct/2026:10:00:01 +0000] "GET /api/v1/me HTTP/1.1" 502 150 "-" "curl/8"
203.0.113.9 - - [21/Oct/2026:10:00:02 +0000] "GET / HTTP/1.1" 200 1500 "-" "curl/8"
203.0.113.9 - - [21/Oct/2026:10:00:03 +0000] "GET /x HTTP/1.1" 504 0 "-" "curl/8"'
out="$(printf '%s\n' "$NGINX_LOG" | bash "$SCRIPT" nginx)"
assert_contains "nginx 502 2건" "$out" "2	HTTP 502"
assert_contains "nginx 504 1건" "$out" "1	HTTP 504"
assert_absent "nginx 200은 세지 않는다" "$out" "HTTP 200"
assert_absent "nginx IP 비노출" "$out" "203.0.113.9"
assert_absent "nginx 주소·쿼리 비노출" "$out" "token=abc"

# ---- 잘못된 모드 ----
bash "$SCRIPT" unknown </dev/null >/dev/null 2>&1
code=$?
if [ "$code" -eq 2 ]; then pass=$((pass + 1)); else echo "FAIL [모드 검사] 종료 코드 $code (기대 2)"; fail=$((fail + 1)); fi

# ---- 30줄 제한 ----
many="$(for i in $(seq 1 40); do printf '2026-10-21T10:00:00.123Z ERROR 1 --- [app] [e] c.s.b.Logger%d : x\n' "$i"; done)"
lines="$(printf '%s\n' "$many" | bash "$SCRIPT" app | wc -l | tr -d ' ')"
if [ "$lines" -eq 30 ]; then pass=$((pass + 1)); else echo "FAIL [30줄 제한] $lines 줄"; fail=$((fail + 1)); fi

echo "통과 $pass, 실패 $fail"
[ "$fail" -eq 0 ]
