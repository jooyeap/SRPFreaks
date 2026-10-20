#!/usr/bin/env bash
# DB 백업 (서버 EC2에서 cron으로 실행한다). mysqldump → gzip → ~/backups 에 날짜별로 보관하고 오래된 것은 지운다.
#
# 지켜야 할 것
# - 비밀번호를 명령줄에 쓰지 않는다: db 컨테이너 안의 환경변수(MYSQL_ROOT_PASSWORD)를 컨테이너 안에서 읽는다(`ps`에 안 보인다).
# - 백업 파일은 소유자만 읽게(600) 둔다. 사용자 이메일 등 개인정보가 들어 있다.
# - 실패하면(덤프 오류, 빈 파일, 압축 손상) 0이 아닌 값으로 끝낸다. 성공한 척하지 않는다.
# - `down -v`, 볼륨 삭제 같은 위험한 명령은 쓰지 않는다. 이 스크립트는 읽기만 한다(옛 백업 파일 삭제 제외).
#
# 사용 (서버에서):
#   chmod +x ~/gitalog/scripts/deploy/backup-db.sh
#   crontab -e  →  17 19 * * * ~/gitalog/scripts/deploy/backup-db.sh >> ~/backups/backup.log 2>&1   # 매일 04:17 KST(= 19:17 UTC)
# 선택: 환경변수 BACKUP_S3_BUCKET(예: s3://my-bucket/srpfreaks)을 주면 aws cli로 같이 올린다(서버에 aws cli와 권한이 있어야 한다).
#      BACKUP_KEEP_DAYS(기본 14): 이 일수보다 오래된 로컬 백업을 지운다.
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/gitalog}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
COMPOSE=(docker compose --env-file "$REPO_DIR/.env.prod" -f "$REPO_DIR/docker-compose.prod.yml")

umask 077                       # 새로 만드는 파일은 소유자만 읽고 쓴다
mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y%m%d-%H%M%S)"
out="$BACKUP_DIR/srpfreaks-$stamp.sql.gz"
tmp="$out.partial"

echo "[$(date -u +%FT%TZ)] 백업 시작 → $out"

# --single-transaction: 서비스를 멈추지 않고 일관된 시점의 사본을 만든다(InnoDB). --routines/--triggers: 빠짐없이.
# 비밀번호는 컨테이너 안에서 환경변수로 읽는다. 호스트의 명령줄·로그에 남지 않는다.
"${COMPOSE[@]}" exec -T db sh -c \
  'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers --set-gtid-purged=OFF srpfreaks' \
  | gzip -9 > "$tmp"

# 검증: 압축이 온전하고, 덤프가 끝까지 쓰였는지(마지막 줄의 "Dump completed") 확인한다
if ! gzip -t "$tmp"; then
  echo "압축 파일이 손상되었습니다." >&2; rm -f "$tmp"; exit 1
fi
if ! gzip -dc "$tmp" | tail -n 5 | grep -q "Dump completed"; then
  echo "덤프가 끝까지 완료되지 않았습니다." >&2; rm -f "$tmp"; exit 1
fi
size="$(stat -c %s "$tmp")"
if [ "$size" -lt 2048 ]; then
  echo "백업 파일이 비정상적으로 작습니다 ($size bytes)." >&2; rm -f "$tmp"; exit 1
fi
mv "$tmp" "$out"
echo "[$(date -u +%FT%TZ)] 백업 완료: $out ($size bytes)"

# 선택: S3에 올린다
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  aws s3 cp "$out" "${BACKUP_S3_BUCKET%/}/$(basename "$out")" --only-show-errors
  echo "S3 업로드 완료"
fi

# 오래된 로컬 백업 삭제 (방금 만든 파일은 항상 남는다)
find "$BACKUP_DIR" -maxdepth 1 -name 'srpfreaks-*.sql.gz' -type f -mtime +"$KEEP_DAYS" -print -delete
