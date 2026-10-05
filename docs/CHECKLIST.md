# 로컬 검증 점검 목록 (첫 실행, 2026-10-08 목요일)

지금까지의 백엔드 코드는 **클라우드 환경에서 컴파일·테스트를 한 번도 돌리지 못했다**(구문 검사만 함).
아래 순서대로 확인하고, 막히면 **에러 로그 전체**를 그대로 붙여서 알려 준다.

## 0. 준비
- [ ] Docker Desktop 실행, `.env.example` -> `.env` 복사 후 `DB_ROOT_PASSWORD`, `DB_PASSWORD` 입력
- [ ] `docker compose down -v` -> `docker compose up -d` (MySQL 8.4, 포트 3307)
- [ ] 환경변수: `DB_PASSWORD`, `JWT_SECRET`(32바이트 이상), `GOOGLE_CLIENT_ID`, `ROOT_EMAIL`, `CORS_ALLOWED_ORIGINS`, `COOKIE_SECURE=false`(로컬 http일 때만)
- [ ] 줄바꿈 정리 커밋을 먼저 할지 확인 (CLAUDE.md 유의사항: 작업 트리 수정 다수가 줄바꿈 차이)

## 1. 컴파일 (`cd backend && ./gradlew compileJava compileTestJava`)
컴파일 오류가 나기 쉬운 곳(코드는 기억 기반이라 확인되지 않은 부분):
- [ ] **MyBatis** `mybatis-spring-boot-starter:4.1.0`이 Spring Boot 4.1.1과 호환되는지, `SkillMapper`(`@Mapper`)가 인식되는지
- [ ] **springdoc** `springdoc-openapi-starter-webmvc-ui:3.1.1` 호환
- [ ] **Boot 4 테스트 패키지 이름**: `DataJpaTest`(`org.springframework.boot.data.jpa.test.autoconfigure`), `AutoConfigureTestDatabase`(`org.springframework.boot.jdbc.test.autoconfigure`), Testcontainers 2.x `org.testcontainers.mysql.MySQLContainer`
- [ ] `SkillMapperTest`의 `@ImportAutoConfiguration(MybatisAutoConfiguration.class)` 구성
- [ ] Lombok 어노테이션 처리, `RecordBest` 생성자 두 개(JPQL 생성자 식)

## 2. 테스트
- [ ] Docker 없이 도는 테스트 먼저: `./gradlew test --tests "*ServiceTest" --tests "*Test"` 중 Docker 필요한 것 제외
- [ ] Docker 필요(Testcontainers): `SchemaMappingTest`, `SongRepositoryTest`, `SkillMapperTest`
- [ ] 전체 `./gradlew test` 통과

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

## 6. 보안
- [ ] USER 토큰으로 `POST /api/v1/admin/difficulty-tables`, 곡 등록 -> 403
- [ ] 로그인 없이 보호 API -> 401, 기본은 deny all
- [ ] **refresh 토큰을 Authorization으로 보내 API 호출 -> 거부**
- [ ] refresh 재발급(Rotation), 이전 토큰 재사용 시 해당 계열 전체 폐기
- [ ] 다른 사용자의 기록 id로 조회·수정·삭제 -> 404
- [ ] `/api/v1/auth/**` 1분에 11번째 요청 -> 429
- [ ] CORS: 허용 Origin만, 그 외 거부. 응답 헤더(CSP, Referrer-Policy 등)
- [ ] 로그에 토큰·비밀번호·요청 본문이 남지 않는지

## 7. 끝나면
- [ ] 통과한 항목 체크, 실패한 항목은 로그를 알려 주기 (수정은 한 가지씩 별도 커밋)
- [ ] 별개 알림: 2026-10-09 금요일 10:00 `claude/push-test` 원격 브랜치 삭제
