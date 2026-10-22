#!/usr/bin/env bash
# 컨테이너 로그에서 "어디서 어떤 오류가 몇 번 났는지"만 집계해 보여 준다. 표준 입력으로 로그를 받는다.
#
# 왜 메시지를 통째로 버리나 (중요)
# - 이 저장소는 공개라서 GitHub Actions의 로그·주석을 누구나 읽을 수 있다. 예외 메시지에는 값, SQL, 이메일,
#   토큰 조각이 섞일 수 있어서 마스킹으로는 완전히 막을 수 없다. 그래서 메시지는 아예 출력하지 않는다.
# - 남기는 것은 로거 이름(코드 클래스 이름)과 예외 종류, 건수뿐이다. 코드는 이미 공개라 클래스 이름은 비밀이 아니다.
#
# 사용:  docker compose logs --since 24h --no-color --no-log-prefix backend | summarize-errors.sh app
#   app   : Spring Boot 기본 로그 형식. ERROR/WARN 줄은 "LEVEL 로거", 예외 줄은 "예외 클래스"로 센다.
#   web   : 프론트(Next.js) 로그. "XxxError"/"XxxException" 종류만 센다.
#   nginx : 접속 로그. 5xx 응답을 상태 코드별로만 센다(주소·IP·쿼리는 출력하지 않는다).
# 출력: "건수<탭>항목" 한 줄씩, 건수가 많은 순서로 최대 30줄. 오류가 없으면 "오류 없음".
set -euo pipefail

mode="${1:-app}"

case "$mode" in
  app)
    awk '
      {
        # Spring 로그 줄: "2026-10-21T10:00:00.123Z  WARN 1 --- [app] [exec-1] c.s.b.Foo : 메시지"
        if (match($0, /^[0-9][0-9T:.+Z-]* +(ERROR|WARN) +[0-9]+ --- /)) {
          head = substr($0, 1, RLENGTH)
          level = (head ~ / ERROR /) ? "ERROR" : "WARN"
          rest = $0
          sep = index(rest, " : ")
          if (sep > 0) {
            before = substr(rest, 1, sep - 1)
            n = split(before, parts, " +")
            logger = parts[n]
          } else {
            logger = "(로거 알 수 없음)"
          }
          # 로거 이름은 영문·숫자·점·밑줄만 남긴다 (그 밖의 글자가 있으면 값이 섞인 것으로 보고 버린다)
          if (logger !~ /^[A-Za-z0-9_.$]+$/) logger = "(로거 알 수 없음)"
          counts[level " " logger]++
        }
        # 예외 줄: "java.lang.IllegalStateException: 메시지" 또는 "Caused by: x.y.FooException: 메시지"
        line = $0
        sub(/^Caused by: /, "", line)
        if (match(line, /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)+(Exception|Error)/)) {
          cls = substr(line, 1, RLENGTH)
          after = substr(line, RLENGTH + 1, 1)
          if (after == "" || after == ":") counts["예외 " cls]++
        }
      }
      END { for (k in counts) printf "%d\t%s\n", counts[k], k }
    '
    ;;
  web)
    awk '
      {
        line = $0
        # "TypeError: 메시지" 같은 줄에서 종류 이름만 꺼낸다
        if (match(line, /[A-Z][A-Za-z0-9]*(Error|Exception)(:| |$)/)) {
          cls = substr(line, RSTART, RLENGTH)
          sub(/[: ]$/, "", cls)
          counts["오류 " cls]++
        }
      }
      END { for (k in counts) printf "%d\t%s\n", counts[k], k }
    '
    ;;
  nginx)
    awk '
      {
        # 접속 로그: ... "GET /경로 HTTP/1.1" 502 1234 ...  → 상태 코드(5xx)만 센다
        if (match($0, /" [0-9][0-9][0-9] /)) {
          status = substr($0, RSTART + 2, 3)
          if (status ~ /^5/) counts["HTTP " status]++
        }
      }
      END { for (k in counts) printf "%d\t%s\n", counts[k], k }
    '
    ;;
  *)
    echo "알 수 없는 모드입니다: app, web, nginx 중 하나여야 합니다." >&2
    exit 2
    ;;
esac | { sort -t "$(printf '\t')" -k1,1nr -k2,2 | head -n 30; } | {
  # 한 줄도 없으면 "오류 없음"을 출력한다
  out="$(cat)"
  if [ -z "$out" ]; then echo "오류 없음"; else printf '%s\n' "$out"; fi
}
