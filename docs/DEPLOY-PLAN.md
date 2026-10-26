# 배포 계획 (2026-10-07 합의, 내일 검증 뒤 이 방향으로 구현)

## 결정
- **서버**: AWS 서울 리전 **t3.small 1대**(x86, 2vCPU, 2GB). x86이라 Docker 이미지를 arm64로 따로 빌드하지 않는다. 같은 서버, 같은 도메인(D20). 구성: nginx(https, `/api` → 백엔드) + 백엔드 + 프론트(Next.js standalone) + MySQL(같은 서버 컨테이너).
- **디스크**: gp3 20~30GB. 공인 IP 1개.
- **월 예상 (환율 1,490원/$, 도메인·부가세 제외)**: EC2 약 28,300원 + IPv4 약 5,400원 + 디스크 약 2,700~4,100원 = **약 3.7만 원**. 도메인 포함 약 3.9~4.0만 원, 부가세 10%가 붙으면 약 4.3~4.4만 원. 가격은 집계 사이트의 서울 값이라 **배포 직전에 AWS Pricing Calculator로 재확인**한다.
- 새 계정이면 가입 크레딧($100~200, 6개월)으로 초반 몇 달은 청구가 없을 수 있다. 이 플랜에서 쓸 수 있는 인스턴스 종류 제한은 가입할 때 확인한다.

## 1차 배포 범위 (이미 있는 것만)
로그인, 서열표, 기록 입력·수정·삭제, 레이팅, 설정과 탈퇴. 곡·채보는 시드 SQL로 넣고(D23) 관리자 화면 없이 시작한다. 곡 목록·사진 입력·관리자 화면은 배포해서 돌려 본 뒤 하나씩 추가한다.

## 돈 안 들이는 운영 항목 (직접 운영 경험용)
스왑 설정(JVM 힙 512MB 안팎 제한), `mysqldump` 정기 백업을 S3에 보관, CloudWatch 기본 지표와 알람(CPU 크레딧 잔량 포함), GitHub Actions 자동 배포, 로그 확인 습관.

## 나중 단계 (필요해지면)
1. 운영 구조 한 단계: DB를 RDS(db.t4g.micro, Single-AZ)로 분리. 월 약 2.5만 원 추가(서울 RDS 단가는 미확인 추정). 합계 약 6.3만 원.
2. 메모리 부족 지표가 보일 때만 인스턴스 확대: t3.medium 약 6.6만 원, t4g.medium 약 5.5만 원(추정).
3. 안정되면 t4g.small로 전환(월 약 5,700원 절약, arm64 빌드 필요) 또는 1년 약정 검토.

## 구현할 때 지킬 것
- 푸시는 사용자가 말할 때만 한다. 파일 삭제는 사용자가 요청할 때만 한다.
- 상태 점검(health) 엔드포인트는 actuator 의존성이 늘어나므로 **먼저 물어본다**. springdoc 같은 추가 의존성은 Spring Boot 4.1.1 호환을 확인한 뒤 넣는다.
- 만들 것: `application-prod.yml`, 백엔드·프론트 Dockerfile(x86), `docker-compose`(운영용), nginx 설정, GitHub Actions 워크플로, Next.js `standalone` 출력 설정, 구글 OAuth 운영 주소 등록 안내, `COOKIE_SECURE=true`, `CORS_ALLOWED_ORIGINS` 운영 도메인.
- 순서: 내일 로컬 검증(`docs/CHECKLIST.md`) 통과 → 위 파일들을 한 가지씩 커밋 → 서버에 배포 → 첫 주 메모리·CPU 크레딧 확인.

## 자동 배포 사용법 (2026-10-13)
`.github/workflows/deploy.yml`은 **수동 실행 전용**이다. 푸시해도 배포되지 않는다.
1. GitHub 저장소 → Settings → Secrets and variables → Actions에 `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`, `EC2_KNOWN_HOSTS`를 등록한다 (설명은 워크플로 파일 맨 위).
2. Actions 탭(또는 GitHub 모바일 앱) → Deploy → Run workflow → 브랜치와 대상(frontend / backend / frontend + backend)을 고른다.
3. 서버에서는 `git pull --ff-only` 후 선택한 서비스만 `up -d --build` 한다. DB 컨테이너·볼륨과 `.env.prod`는 건드리지 않는다.
- 주의: 서버 보안 그룹의 22번 포트가 "내 IP만"이면 GitHub 러너가 접속하지 못한다. 그때는 포트 허용 범위를 조정하거나 SSM 방식으로 바꾼다.
- 백엔드를 배포하면 Flyway가 새 마이그레이션을 적용한다. 스키마를 바꾸는 배포는 먼저 서버 DB 백업(`mysqldump`)을 확인한다.

## DB 백업·복구 (2026-10-20)

**백업 설정 (서버에서 한 번)**
1. `chmod +x ~/gitalog/scripts/deploy/backup-db.sh`
2. 한 번 손으로 실행해 본다: `~/gitalog/scripts/deploy/backup-db.sh` → `~/backups/srpfreaks-날짜.sql.gz`가 생기고 `백업 완료`가 나오면 성공이다.
3. cron 등록(`crontab -e`): `17 19 * * * ~/gitalog/scripts/deploy/backup-db.sh >> ~/backups/backup.log 2>&1` (매일 04:17 KST = 19:17 UTC)
4. 보관: 기본 14일(`BACKUP_KEEP_DAYS`로 변경). 서버 디스크가 작으니 `du -sh ~/backups`를 가끔 확인한다.
5. **자동 점검(2026-10-22)**: `.github/workflows/backup-check.yml`이 매일 06:00 KST에 서버의 가장 최근 백업을 확인한다(`scripts/deploy/check-backups.sh`, 읽기만 함). 최근 백업이 30시간보다 오래됐거나, 없거나, 너무 작거나, 압축이 깨졌으면 실패해서 GitHub 알림이 온다. Actions 화면에서 `Backup Check`를 `Run workflow`로 눌러 언제든 직접 확인할 수도 있다. 실행 로그는 공개라서 개수·나이·크기만 출력하고 파일 이름은 내지 않는다. 정리 스크립트는 `.sql.gz`만 지우므로, 예전에 손으로 만든 `.sql`은 점검 결과에 "참고"로만 나온다(직접 지워야 한다).
   - **빌드 캐시 자동 정리(2026-10-22)**: 서버에서 이미지를 직접 빌드해서 캐시가 쌓인다(10일에 약 10GB). 배포가 끝날 때마다 `scripts/deploy/prune-build-cache.sh`가 **7일 넘은 빌드 캐시만** 지운다(`PRUNE_KEEP_HOURS`로 변경). 컨테이너·이미지·볼륨(DB·인증서)은 건드리지 않고, 실패해도 배포는 성공으로 둔다. 손으로 지울 때는 `docker builder prune -f`(이미지·볼륨은 지우지 않음)만 쓰고 `system prune -a`, `--volumes`는 쓰지 않는다.
5. (선택) S3에도 올리려면 서버에 aws cli와 쓰기 권한을 준 뒤 cron 줄 앞에 `BACKUP_S3_BUCKET=s3://버킷/경로`를 붙인다. 서버 디스크가 망가져도 남는 사본이 필요하면 이 단계가 중요하다.

스크립트가 하는 일과 안전장치: 비밀번호를 명령줄에 쓰지 않고(db 컨테이너 안 환경변수), 파일은 소유자만 읽게(600) 두며, 압축 손상·덤프 미완료·비정상적으로 작은 파일이면 실패로 끝낸다(성공한 척하지 않음). 서비스를 멈추지 않는다(`--single-transaction`).

**복구 (장애 때만, 신중하게)**
1. 먼저 지금 상태를 한 번 더 백업해 둔다(복구가 잘못될 때를 대비).
2. 복구할 파일 확인: `ls -lh ~/backups`
3. 백엔드를 멈춘다: `docker compose --env-file .env.prod -f docker-compose.prod.yml stop backend`
4. 복구: `gzip -dc ~/backups/srpfreaks-날짜.sql.gz | docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T db sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" srpfreaks'`
5. 백엔드를 다시 켠다: `... up -d backend` → Flyway가 스키마 상태를 확인한다. 화면에서 로그인과 레이팅이 보이는지 확인한다.
- 복구 연습은 따로 만든 빈 DB(예: `srpfreaks_restore`)에 먼저 해 보면 안전하다. 백업은 한 번도 복구해 보지 않으면 있는 것이 아니다.

## 장애 알림과 오류 요약 (2026-10-21)
- **장애 이슈 자동 생성**: `uptime.yml`이 점검에 실패하면 `장애` 라벨의 GitHub 이슈를 하나 열고(이미 열려 있으면 새로 만들지 않음), 다시 성공하면 댓글을 남기고 닫는다. 이슈는 메일 알림이 오고, Claude가 읽고 원인을 분석할 수 있는 기록이 된다.
- **최근 오류 보기**: Server Ops의 새 작업. 최근 24시간 로그에서 `backend`(로거·예외 종류별 ERROR/WARN 건수), `frontend`(오류 종류별 건수), `nginx`(5xx 상태 코드별 건수)만 집계한다(`scripts/deploy/summarize-errors.sh`). 결과는 실행 Summary와 검사 결과 주석으로 남는다.
- **로그 원문과 예외 메시지는 출력하지 않는다.** 이 저장소는 공개라서 Actions의 로그·주석을 누구나 읽을 수 있고, 예외 메시지에는 값·SQL·이메일이 섞일 수 있어 마스킹으로는 완전히 막을 수 없기 때문이다. 코드가 공개라 클래스 이름은 비밀이 아니다. 테스트(`summarize-errors.test.sh`, CI의 '배포 스크립트 테스트')가 이메일·토큰·SQL이 출력에 나오지 않는 것을 확인한다.
- 처음 쓰기 전에 이 PR이 `main`에 머지돼 있어야 한다(서버는 `origin/main`의 스크립트를 읽는다).

## 사이트 감시 (2026-10-20)
- `.github/workflows/uptime.yml`: 10분마다 홈(200)과 인증 없는 API(401)를 확인하고, HTTPS 인증서 만료가 14일 아래로 남으면 실패한다. 실패하면 GitHub가 저장소 소유자에게 알림을 보낸다(GitHub 앱의 알림을 켜 두면 모바일로 온다).
- 배포 직후에는 `deploy.yml`의 `배포 후 점검`이 같은 확인을 한 번 더 한다.

## 배포 반영 확인과 서버 점검 (2026-10-20)
- **배경**: 프론트를 다시 빌드하지 않은 채(`target`을 `backend`로만 고른 경우 등) 워크플로가 성공으로 끝나, 화면이 옛 버전인 채로 모르고 지나간 적이 있다.
- **빌드 커밋 표시**: 배포 때 서버가 `git rev-parse --short=7 HEAD`를 `GIT_SHA`로 넘기고(`docker-compose.prod.yml`의 빌드 인자), `frontend/Dockerfile`이 `NEXT_PUBLIC_GIT_SHA`로 코드에 고정한다. 푸터의 `build abc1234`와 `GET /version`(`{"sha":"abc1234"}`, 캐시 안 함)에서 볼 수 있다. 비밀값이 아니다. 값이 없으면 `dev`(로컬·테스트), 직접 compose를 실행하면 `unknown`.
- **자동 검증**: `deploy.yml`의 `배포 버전 확인`이 방금 배포한 브랜치의 커밋과 `/version`의 값을 비교한다(최대 약 2분 재시도). 다르면 실패하고 GitHub 알림이 온다. 프론트를 배포하는 경우(`frontend`, `frontend + backend`)에만 확인한다. **백엔드 버전은 아직 확인하지 않는다.**
- **자동 복구(2026-10-27)**: `배포 버전 확인`이 "끝까지 커밋이 달랐다"로 실패하면, 같은 배포 안에서 **딱 1회** 프론트를 캐시 없이 다시 빌드하고 컨테이너를 강제 재생성한 뒤(Server Ops의 `프론트 강제 재생성`과 같은 순서) nginx를 다시 띄우고 버전을 한 번 더 확인한다. 그래도 다르면 더 시도하지 않고 작업을 실패로 끝낸다. 롤백·DB·서버 중지는 하지 않는다. 확인 로직은 `scripts/deploy/check-version.sh`(테스트 `check-version.test.sh`, CI `배포 스크립트 테스트`)에 있다. 커밋 불일치가 아닌 이유로 확인에 실패하면 복구하지 않고 실패로 끝낸다
- **서비스별 배포**: `frontend + backend`를 골라도 서버에서는 서비스를 한 개씩 차례로 `up -d --build` 한다(과거에 둘을 한 번에 넘겼을 때 프론트가 옛 커밋으로 남은 적이 있다. 원인은 확인하지 못했다). 배포가 끝나면 서버 로그(`서버에서 pull 후 재빌드` 단계)에 배포 대상·빌드 커밋·컨테이너 생성 시각과 이미지가 남는다. 버전이 어긋나면 이 줄과 `/version` 값을 먼저 비교한다.
- **서버 점검 워크플로** `.github/workflows/server-ops.yml`(수동 실행): `상태 확인`(서버 커밋, 컨테이너, 이미지 시각, 실행 중 프론트의 빌드 커밋, 프론트 로그 30줄, 읽기 전용) / `프론트 강제 재생성`(캐시 없이 다시 빌드 + nginx 재시작) / `nginx 재시작`. 결과는 실행 화면의 Summary에도 남는다. DB·`.env.prod`·백엔드 로그는 다루지 않는다.
