# 로컬 검증 점검 목록 (첫 실행, 2026-10-08 목요일)

지금까지의 백엔드 코드는 **클라우드 환경에서 컴파일·테스트를 한 번도 돌리지 못했다**(구문 검사만 함).
아래 순서대로 확인하고, 막히면 **에러 로그 전체**를 그대로 붙여서 알려 준다.

## 0. 준비
- [ ] Docker Desktop 실행, `.env.example` -> `.env` 복사 후 `DB_ROOT_PASSWORD`, `DB_PASSWORD` 입력
- [ ] `docker compose down -v` -> `docker compose up -d` (MySQL 8.4, 포트 3307)
- [ ] 환경변수: `DB_PASSWORD`, `JWT_SECRET`(32바이트 이상), `GOOGLE_CLIENT_ID`, `ROOT_EMAIL`, `CORS_ALLOWED_ORIGINS`, `COOKIE_SECURE=false`(로컬 http일 때만)
- [ ] 줄바꿈 정리 커밋을 먼저 할지 확인 (CLAUDE.md 유의사항: 작업 트리 수정 다수가 줄바꿈 차이)
- [ ] JDK 17 설치 확인 (`build.gradle` toolchain 17. 21만 있으면 `No matching toolchains found`)
- [ ] **Docker를 켜 둔다**: Testcontainers 테스트 4개(`SchemaMappingTest`, `SongRepositoryTest`, `SkillMapperTest`, `BackendApplicationTests`)는 Docker가 없으면 건너뛰지 않고 실패한다

## 1. 컴파일 (`cd backend && ./gradlew compileJava compileTestJava`)
컴파일 오류가 나기 쉬운 곳(코드는 기억 기반이라 확인되지 않은 부분):
- [ ] 의존성 해석: `mybatis-spring-boot-starter:4.1.0`, `springdoc-openapi-starter-webmvc-ui:3.1.1` 버전이 **실제로 존재하는지**(없으면 `Could not find ...`로 빌드가 멈춤. 알려진 Boot 4 호환 기준은 mybatis 4.0.x, springdoc 3.0.x)
- [ ] (2026-10-05 수정함, 확인만) `SecurityConfig.roleHierarchy` 등 3개 static 메서드를 public으로 바꿔 `compileTestJava` 오류 해소
- [ ] **MyBatis** `mybatis-spring-boot-starter:4.1.0`이 Spring Boot 4.1.1과 호환되는지, `SkillMapper`(`@Mapper`)가 인식되는지
- [ ] **springdoc** `springdoc-openapi-starter-webmvc-ui:3.1.1` 호환
- [ ] **Boot 4 테스트 패키지 이름**: `DataJpaTest`(`org.springframework.boot.data.jpa.test.autoconfigure`), `AutoConfigureTestDatabase`(`org.springframework.boot.jdbc.test.autoconfigure`), Testcontainers 2.x `org.testcontainers.mysql.MySQLContainer`
- [ ] `SkillMapperTest`의 `@ImportAutoConfiguration(MybatisAutoConfiguration.class)` 구성
- [ ] Lombok 어노테이션 처리, `RecordBest` 생성자 두 개(JPQL 생성자 식)

## 2. 테스트
- [ ] Docker 없이 도는 테스트 먼저: `./gradlew test --tests "*ServiceTest" --tests "*Test"` 중 Docker 필요한 것 제외
- [ ] Docker 필요(Testcontainers): `SchemaMappingTest`, `SongRepositoryTest`, `SkillMapperTest`
- [ ] 전체 `./gradlew test` 통과

- [ ] `BackendApplicationTests.contextLoads`가 Testcontainers로 기동되는지 (2026-10-05 변경: 환경변수 없이 돌도록 더미 값 사용)

## 3. 실행과 스키마
- [ ] `./gradlew bootRun` 기동, Flyway `V1__init_schema.sql` 적용, `ddl-auto: validate` 통과(엔티티와 스키마 일치)
- [ ] 의심 지점(실제 MySQL에서 처음 실행되는 JPQL):
  - `OptionRecordRepository.findMine` — `:noteOption is null or ...` (null enum 파라미터)
  - `OptionRecordRepository.findBestByTable` — `sum(case when ... then 1L else 0L end)`와 생성자 식 `new RecordBest(...)`
  - `DifficultyTableEntryRepository.findAllForView` — fetch join
  - `SongRepository.search` — `escape '!'`
  - MyBatis `SkillMapper.findRatingCandidates` — record 결과 매핑(`-parameters`)

## 4. 시드 데이터 (D23, 1회성)
- [ ] `seed.sql`(받은 파일, 또는 `python3 scripts/seed/generate_seed_sql.py <시드.csv>`)
- [ ] 백엔드를 한 번 실행해 Flyway를 적용한 뒤 `docker exec -i <컨테이너> mysql -u srpfreaks -p srpfreaks < seed.sql`
- [ ] 건수: songs 465, song_difficulties 669, difficulty_tables 1, difficulty_table_entries 669
- [ ] 값: `tier_label IS NULL` 220, `tier_uncertain` 5, `pattern_type = '레이팅 제외'` 274
- [ ] 같은 파일을 한 번 더 실행하면 PK 중복으로 실패하고 아무것도 늘지 않아야 함(전체 롤백)
- [ ] 한글이 깨지지 않는지(곡명, `상/중/하`, `단일/복합`)

## 5. API 동작 (Swagger 또는 curl)
- [ ] `POST /api/v1/auth/google` 로그인(실제 구글 ID 토큰 필요) -> access 토큰, refresh 쿠키(httpOnly, Path=/api/v1/auth)
- [ ] `ROOT_EMAIL` 계정이 ROOT, 그 외는 USER
- [ ] `GET /api/v1/users/me`, `GET /api/v1/songs?q=`, `GET /api/v1/songs/{id}`
- [ ] `GET /api/v1/difficulty-tables`, `GET /api/v1/difficulty-tables/1/entries?mine=true` (묶음 순서 높은 난이도 먼저, 미정 묶음 맨 뒤)
- [ ] `POST /api/v1/records` : SRN+ 저장 성공 / 옵션 비움 -> SRN+ / 다른 옵션 400 / 달성률 100.01, -0.01, 95.555 -> 400 / 100.00 -> FC 자동
- [ ] 기록 후 서열표 `mine=true`의 단계 칩(EXC/FC/SS/S/S 미만)과 평균 확인
- [ ] `GET /api/v1/skills/me` : 단일 15 / 그 외 25 분리, 합계, 플레이어 티어
- [ ] 레이팅 손계산 대조: 기준 난이도 6.0, 달성률 95 -> 점수 304.00
- [ ] `PATCH /api/v1/users/me` (2026-10-05 추가, 컴파일 미확인): `{"nickname":"たろう"}` -> 200과 바뀐 닉네임 / `ﾀﾛｳ` -> `タロウ`로 정규화 / `""`·`null` -> 닉네임 null / 한글·공백·이모지·1자·13자 -> 400 / 토큰 없이 -> 401. 요청 본문에 사용자 ID를 넣어도 영향이 없는지(토큰의 사용자만 바뀜)

## 6. 보안
- [ ] USER 토큰으로 `POST /api/v1/admin/difficulty-tables`, 곡 등록 -> 403
- [ ] 로그인 없이 보호 API -> 401, 기본은 deny all
- [ ] **refresh 토큰을 Authorization으로 보내 API 호출 -> 거부**
- [ ] refresh 재발급(Rotation), 이전 토큰 재사용 시 해당 계열 전체 폐기
- [ ] 다른 사용자의 기록 id로 조회·수정·삭제 -> 404
- [ ] 회원 탈퇴 `DELETE /api/v1/users/me`(테스트 계정으로): 204와 `Set-Cookie: refresh_token=; Max-Age=0`, 이후 DB에서 `users`·`option_records`·`refresh_tokens`의 해당 행이 없고 `audit_logs.actor_id`는 NULL, 같은 토큰으로 `/users/me` -> 401
- [ ] `/api/v1/auth/**` 1분에 11번째 요청 -> 429
- [ ] CORS: 허용 Origin만, 그 외 거부. 응답 헤더(CSP, Referrer-Policy 등)
- [ ] 로그에 토큰·비밀번호·요청 본문이 남지 않는지

## 7. 프론트 (`cd frontend`, 백엔드와 DB를 띄운 뒤)
프론트 코드는 클라우드에서 타입 검사·린트·Vitest(`npm run typecheck`, `npm run lint`, `npm test`)만 통과했고,
**실제 브라우저로 본 적이 없다**. 구글 폰트는 클라우드에서 받을 수 없어 `next build`도 돌려 보지 못했다.
- [ ] 환경변수 파일: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`(백엔드와 같은 값), `BACKEND_URL`(기본 `http://localhost:8080`). `frontend/.env.example`을 `frontend/.env.local`로 복사해서 값을 채운다 (`.env.local`은 `.gitignore`로 제외돼 있다)
- [ ] 구글 클라이언트의 "승인된 JavaScript 원본"에 `http://localhost:3000` 추가
- [ ] `npm install` 후 `npm run dev`, `npm run build` (폰트 다운로드가 되는 환경에서 통과하는지)
- [ ] 글꼴: 본문 Noto Sans KR, 숫자·영문 Chakra Petch가 적용되는지
- [ ] 화면 폭 360px에서 먼저 확인 (헤더 줄바꿈, 서열표 4열 카드, 기록 창이 아래 시트로 올라오는지), 데스크톱 980px에서 서열표가 표형으로 바뀌는지
- [ ] 다크/라이트 전환, 새로고침해도 선택 유지, 첫 화면에서 깜빡임 없음. 색: 서열표 단계 막대/틴트, 레이팅 티어 칩 (C/B/A 단계 색과 티어 20단계 색은 **임시 값**이라 마음에 드는지 확인)
- [ ] 로그인: `/login`의 구글 버튼 -> 로그인 -> 헤더에 이름/이메일과 로그아웃, 새로고침해도 로그인 유지(Refresh 쿠키로 복구)
- [ ] 개발자 도구 Application 탭: **localStorage/sessionStorage에 토큰이 없는지**, refresh 쿠키가 httpOnly인지
- [ ] 로그아웃 후 `/table`, `/rating`이 로그인 안내를 보여 주고, 다른 계정으로 로그인했을 때 이전 계정의 기록이 보이지 않는지
- [ ] 서열표 `/table`: 묶음 순서(높은 난이도 먼저, 미정 맨 뒤), 칩 5개 합 = 기록 수, 평균 `0% 미포함/포함` 토글(서버 재호출 없음), 파트/추천/속성 필터, 페이지 이동
- [ ] 기록 등록: 줄의 `기록` 버튼 -> 달성률 입력 시 단계 미리보기, 100.00이면 풀콤보 자동, 100.01/-0.01/95.555/빈 값은 오류 문구, 저장 후 서열표 칩·평균이 바뀜
- [ ] 기록 수정·삭제: 목록의 `수정` -> 값이 채워짐 -> 저장, `이 기록 삭제`는 한 번 더 확인
- [ ] 레이팅 `/rating`: 합계·소계·티어 칩·다음 티어까지 남은 점수, 단일 15 / 그 외 25 구역, 기록이 없을 때 안내. 기록 저장 후 바로 반영되는지
- [ ] 헤더(360px): 윗줄 = 이름 + 로그아웃/테마, 아랫줄 = 서열표/레이팅 탭 두 칸. 이름(이메일)은 `sm`(640px) 이상에서만 보임
- [ ] 서열표 필터(모바일): `필터` 버튼으로 패널이 접히고 펼쳐지는지, 접었을 때 요약 문구가 현재 선택(파트/추천/속성/0% 포함)과 맞는지. 768px 이상에서는 항상 펼쳐짐
- [ ] 파트 뱃지: Guitar(분홍 계열) / Bass(청록 계열)가 서열표 카드·줄, 곡 상세, 레이팅, 기록 창에서 글자와 함께 보이는지 (색은 **임시 값**, 다크/라이트 둘 다 대비 확인)
- [ ] 추천 뱃지 `상`: 주황 계열이 단계 칩(EXC/FC)과 헷갈리지 않는지 (임시 값)
- [ ] 재킷 칸: 이미지 없이 단색 칸으로 나오는지 (카드/줄/곡 상세/레이팅/기록 창). 외부 이미지 요청이 네트워크 탭에 없는지
- [ ] 서열표 카드의 `+` 버튼: 누르면 해당 채보의 기록 창이 열리고, 곡 상세로 가는 제목 링크와 겹치지 않는지
- [ ] 곡 상세 `/songs/{id}`: 제목 줄바꿈(긴 제목), BPM 등 정보 카드 잘림, 서열표에서 들어왔을 때 같은 묶음/이전·다음 채보 이동, 목록에서 들어왔을 때와 차이
- [ ] 기록 창(모바일): 아래 시트 + 손잡이 막대, 큰 달성률 입력과 `달성 표시` 미리보기, 풀콤보(0 miss) 줄 전체 토글, 취소/저장 버튼 배치
- [ ] 닉네임(2026-10-05 추가): 로그인 직후 닉네임이 없으면 헤더 아래 `닉네임을 설정해 주세요. 설정하기` 안내가 뜨고(다른 화면은 막지 않음), `/settings`에서 저장하면 안내가 사라지고 헤더 이름이 바뀌는지. 모바일에서는 헤더에 이름 대신 `설정`이 보임. 한글 입력 시 오류 문구, 반각 가타카나 입력 후 저장하면 전각으로 바뀌는지
- [ ] 설정·탈퇴(2026-10-05 추가): `/settings`에 계정·닉네임·로그아웃·탈퇴 카드가 보이고, `탈퇴하기` -> `/settings/withdraw`에서 체크 전에는 버튼이 꺼져 있는지. 테스트 계정으로 탈퇴하면 첫 화면으로 가고 로그아웃 상태가 되며 같은 구글 계정으로 다시 로그인하면 새 계정(기록 없음)인지
- [ ] 의심 지점: 서열표 줄의 모바일 카드/데스크톱 줄은 둘 다 그려지고 CSS로 숨기므로(`md:hidden`) 화면 폭에 따라 한쪽만 보이는지, `<dialog>`의 Esc 닫기와 바깥 클릭 닫기

- [ ] 로그인이 자꾸 풀리면: `CORS_ALLOWED_ORIGINS`에 **접속한 주소와 똑같은 값**이 있는지 (`localhost:3000`과 `127.0.0.1:3000`은 다르다). 재발급이 403(`ORIGIN_NOT_ALLOWED`)이어도 화면에는 로그아웃처럼만 보인다. 네트워크 탭에서 `/auth/refresh` 상태 코드 확인
- [ ] 첫 기동 로그: `JSON` 컬럼(`option_records`, `audit_logs`) 매핑 오류 여부 (jjwt-jackson이 Jackson 2를 끌어오고 Boot 4는 Jackson 3를 씀)

## 8. 끝나면
- [ ] 통과한 항목 체크, 실패한 항목은 로그를 알려 주기 (수정은 한 가지씩 별도 커밋)
- [ ] 별개 알림: 2026-10-09 금요일 10:00 `claude/push-test` 원격 브랜치 삭제

## 9. 배포 전에 필요한 것
배포 방향과 비용 합의는 `docs/DEPLOY-PLAN.md`(t3.small 1대, 1차 범위, 나중 단계)를 따른다. (2026-10-05 전체 검토 결과, 검증 통과 후 기능별로 진행)
- [x] 회원 탈퇴 `DELETE /users/me` 구현(D20, 사용자·기록·refresh 완전 삭제, 쿠키 삭제 응답 포함). **로컬 검증은 아직**: 7장의 확인 목록에 아래 항목을 더해 확인한다
- [ ] `application-prod.yml`: DB URL 환경변수화, `useSSL`/`allowPublicKeyRetrieval` 정리, SQL 디버그 로그 끄기, `CORS_ALLOWED_ORIGINS` 기본값 제거, springdoc 끄기
- [ ] 헬스체크(actuator `/actuator/health`만 공개). **의존성 추가이므로 먼저 확인**
- [ ] Dockerfile(백엔드·프론트), 운영 compose, nginx(HTTPS, `/api`는 백엔드로 직접, `X-Forwarded-For`/`Origin` 전달, 프론트 보안 헤더·CSP), GitHub Actions
- [ ] 프론트 `next.config` `output: "standalone"`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`는 빌드 시점에 주입 (`BACKEND_URL`도 빌드에 고정될 수 있어 운영은 nginx가 `/api` 처리)
- [ ] 구글 OAuth 클라이언트에 운영 도메인을 승인된 JavaScript 원본으로 추가, `COOKIE_SECURE=true`
- [x] 프론트 개선 (2026-10-05 완료): 재발급 실패 중 401만 로그아웃 처리(500/429/403은 구분), 로그아웃 시 구글 `disableAutoSelect()` 호출. 실제 브라우저에서 동작 확인만 남음
- [ ] 정리 후보: `frontend/public/*.svg` 5개, `docs/table.sql`, 중복 `docs/CLAUDE.md`, README의 `&amp;`·Bass 누락, `.gitignore`에 `.env.*`·`*.pem`·`application-prod.yml` 추가
