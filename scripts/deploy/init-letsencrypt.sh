#!/usr/bin/env bash
# HTTPS 인증서(Let's Encrypt) 최초 발급 스크립트. 서버에서 저장소 루트의 .env.prod가 있는 상태로 한 번 실행한다.
#
# 사용법:
#   scripts/deploy/init-letsencrypt.sh 내이메일@example.com            # 진짜 인증서 발급
#   STAGING=1 scripts/deploy/init-letsencrypt.sh 내이메일@example.com  # 연습용(한도에 안 걸림). 성공하면 STAGING 없이 다시 실행
#
# 왜 이런 단계가 필요한가:
#   nginx(HTTPS 설정)는 인증서 파일이 있어야 시작되고, 인증서 발급은 nginx가 80포트로 확인 파일을 보여 줘야 된다.
#   서로 먼저 있어야 하는 구조라서, 임시(자체서명) 인증서로 nginx를 먼저 띄우고 → 진짜 인증서를 받은 뒤 → nginx를 다시 읽게 한다.
#
# 선행 조건: 도메인의 A 레코드(@, www)가 이 서버 IP를 가리키고, 80/443 포트가 열려 있어야 한다.
set -euo pipefail

EMAIL="${1:?사용법: $0 내이메일@example.com}"
cd "$(dirname "$0")/../.."

ENV_FILE=".env.prod"
[ -f "$ENV_FILE" ] || { echo "$ENV_FILE 이 없습니다. .env.prod.example을 복사해서 값을 채워 주세요." >&2; exit 1; }

DOMAIN="$(grep -E '^DOMAIN=' "$ENV_FILE" | head -n1 | cut -d= -f2- | tr -d '\r')"
[ -n "$DOMAIN" ] || { echo "$ENV_FILE 에 DOMAIN 이 비어 있습니다." >&2; exit 1; }
[ "$DOMAIN" != "localhost" ] || { echo "DOMAIN=localhost 로는 인증서를 받을 수 없습니다. 실제 도메인을 넣어 주세요." >&2; exit 1; }

COMPOSE=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE")
# compose의 name: srpfreaks 때문에 볼륨 이름은 srpfreaks_letsencrypt 이다
VOLUME="srpfreaks_letsencrypt"
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"

echo "== 1/5 임시(자체서명) 인증서 만들기: nginx가 일단 시작되게 한다"
docker volume create "$VOLUME" > /dev/null
docker run --rm -v "$VOLUME:/etc/letsencrypt" --entrypoint sh alpine/openssl -c "
  rm -rf /etc/letsencrypt/live/$DOMAIN /etc/letsencrypt/archive/$DOMAIN /etc/letsencrypt/renewal/$DOMAIN.conf &&
  mkdir -p $CERT_DIR &&
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 -subj '/CN=$DOMAIN' \
    -keyout $CERT_DIR/privkey.pem -out $CERT_DIR/fullchain.pem"

echo "== 2/5 전체 서비스 시작 (db → backend/frontend → nginx)"
"${COMPOSE[@]}" up -d --build

echo "== 3/5 임시 인증서 삭제: certbot이 같은 자리에 진짜 인증서를 만들 수 있게 비운다"
docker run --rm -v "$VOLUME:/etc/letsencrypt" alpine sh -c "
  rm -rf /etc/letsencrypt/live/$DOMAIN /etc/letsencrypt/archive/$DOMAIN /etc/letsencrypt/renewal/$DOMAIN.conf"

echo "== 4/5 인증서 발급 요청 (80포트의 /.well-known/acme-challenge 로 도메인 소유 확인)"
STAGING_FLAG=()
if [ "${STAGING:-0}" = "1" ]; then
  STAGING_FLAG=(--staging)
  echo "   (연습용 STAGING 모드: 브라우저가 신뢰하지 않는 인증서가 발급됩니다)"
fi
"${COMPOSE[@]}" run --rm --entrypoint certbot certbot certonly \
  --webroot -w /var/www/certbot \
  -d "$DOMAIN" -d "www.$DOMAIN" \
  --email "$EMAIL" --agree-tos --no-eff-email --non-interactive \
  "${STAGING_FLAG[@]}"

echo "== 5/5 nginx가 새 인증서를 읽게 한다"
"${COMPOSE[@]}" exec nginx nginx -s reload

echo
echo "완료. https://$DOMAIN 으로 접속해 확인하세요."
