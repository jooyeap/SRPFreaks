# CLAUDE.md — Gitalog

GITADORA(Guitar/Bass) 플레이 기록을 **노트 옵션별로** 저장하고, 전체 / SRN / SRN+ 기준의 **스킬 목록**을 계산하는 비공식 팬 웹 서비스.
상세 설계와 결정 기록은 `docs/DESIGN.md`를 따른다. 결정(D1~D6)을 번복하거나 설계와 충돌하는 요청이 오면 **코드를 쓰기 전에 알리고 확인**한다.

## 작업 방식 (가장 중요)
- **코드를 쓰기 전에 계획을 먼저 설명**한다. 어떤 파일을 만들고 바꿀지, 왜 그렇게 하는지 짧게 적는다.
- 한 번에 **기능 하나**만 구현한다. 한 기능 = 한 커밋 단위.
- 구현할 때 **테스트를 같이** 작성한다. 테스트 없이 완료라고 하지 않는다.
- 내가 코드를 이해해야 한다. 어려운 부분(JPA 연관관계, Security 필터, 집계/스킬 쿼리)은 **왜 이렇게 했는지** 주석 또는 설명을 남긴다.
- 요구사항이 모호하면 추측해서 만들지 말고 **먼저 질문**한다.
- 요청하지 않은 리팩터링, 의존성 추가, 파일 삭제를 하지 않는다. 필요하면 제안만 한다. 기존 코드는 요청 없이 스타일을 바꾸지 않는다.
- 막히면 에러 로그를 그대로 보여주고 원인 후보를 좁혀 설명한다.

## 기술 스택
- 백엔드: Java 17, Spring Boot 4.1.1 (**Gradle**), Spring Web MVC, Spring Security + JJWT, Spring Validation, Spring Data JPA, Flyway, Lombok
- 추가 예정: MyBatis, springdoc(Swagger), Testcontainers. **Spring Boot 4.1.1과 호환되는 버전인지 확인한 뒤** 추가한다. 호환이 불확실하면 추가하기 전에 알린다.
- DB: MySQL 8.x (로컬은 Docker)
- 프론트: React, Next.js(App Router), TypeScript, TanStack Query, React Hook Form + Zod, Tailwind CSS
- 확장 프로그램(Phase 2): Chrome/Edge Manifest V3, TypeScript
- 배포: GitHub Actions → AWS EC2 (로컬 검증 후)

## 폴더 구조
- `backend/` Spring Boot. 현재 **계층형 패키지**: `com.gitalog.backend.{config, controller, service, repository, mapper, entity, dto, security, common}`
- `frontend/` Next.js
- `extension/` 브라우저 확장 (Phase 2)
- `docs/` 설계 문서 (`DESIGN.md`). `docs/table.sql`은 폐기 대상이며 참고하지 않는다.
- 스키마의 기준은 **Flyway 마이그레이션**(`backend/src/main/resources/db/migration`)이다.

## 개발 명령어 (backend 폴더에서)
- 실행: `./gradlew bootRun` (Windows: `gradlew.bat bootRun`)
- 테스트: `./gradlew test`
- 환경변수: `DB_PASSWORD`, `JWT_SECRET` (값은 저장소에 두지 않는다)
- 로컬 DB: `docker compose up -d` (루트 `docker-compose.yml`, 작성 예정)
- 프론트(생성 후): `npm run dev`, `npm run lint`, `npm run build`

## DB / Flyway 규칙
- 이미 적용된 마이그레이션(`V1__init_schema.sql` 등)은 **절대 수정하지 않는다.** 변경은 새 `V{n}__설명.sql`로 추가한다.
- `ddl-auto: validate`를 유지한다. 엔티티와 스키마가 다르면 마이그레이션을 고친다.
- 테이블/컬럼 이름은 기존 코드 기준: `users.username`, `song_difficulties`(= 채보), `official_records`, `option_records`. (`play_records`/`manual_records`는 V2에서 이름 변경 예정)
- 옵션별로 테이블을 나누지 않는다. `note_option` 컬럼으로 구분한다.

## 백엔드 규칙
- **JPA = 쓰기와 단순 조회, MyBatis = 복잡한 읽기 전용 쿼리**(집계, 스킬 계산). MyBatis로 쓰기를 하지 않는다.
- MyBatis는 `#{}`만 쓴다. **`${}` 금지.** 정렬/필터 값은 화이트리스트로 검증한다.
- 엔티티를 API 요청/응답에 직접 쓰지 않는다. DTO를 쓴다. 새 엔티티는 `@Setter` 대신 의미 있는 메서드로 변경한다.
- Enum은 `@Enumerated(EnumType.STRING)`, DB 컬럼은 VARCHAR. (확장 대비)
- 삭제는 소프트 삭제(`is_deleted`). 연관관계는 기본 LAZY, 필요한 곳에서만 fetch join. N+1을 의식한다.
- 시간은 **UTC로 저장**한다. (`Instant`, 화면에서 Asia/Seoul 변환)
- 달성률은 `DECIMAL(5,2)`, 0.00~100.00. 프론트(Zod) / 백엔드(Validation) / DB(CHECK) 모두 검증한다.
- API는 `/api/v1/` 접두사. 목록은 반드시 페이지네이션.
- 에러는 `@RestControllerAdvice`의 **공통 에러 형식**으로 응답한다. 스택트레이스/SQL을 노출하지 않는다.
- 권한은 `Role`(ROOT > ADMIN > USER) + RoleHierarchy. `@PreAuthorize`와 **서비스 계층의 소유자 검증**을 함께 쓴다.

## 스킬 계산 규칙 (확정, 임의로 바꾸지 않는다)
- 채보 스킬 값 = `달성률 × 레벨 × 20`. 감산 없음, 모든 옵션 동일.
- **곡당 1채보만** 반영한다. Guitar/Bass, 난이도 무관하게 곡의 채보 중 **스킬 값이 가장 높은 것** 하나.
- HOT = 현재 버전 신곡 (`songs.added_version` ∈ `app_settings`의 `skill.hot_versions`).
- 목록 = HOT 상위 25 + 그 외 상위 25. Guitar와 Bass는 한 목록.
- scope: ALL / SRN / SRN_PLUS. scope는 값으로 확장 가능해야 한다.
- 스킬 값은 **저장하지 않고 계산**한다. 소수 처리(내림/반올림)는 공식 스킬 값과 비교하는 테스트로 확정하고, 확정되면 `docs/DESIGN.md`에 기록한다.

## 프론트 규칙
- TypeScript 사용. **`any` 금지.** 타입이 막히면 설명을 요청한다. (나는 TS 입문자)
- 서버 데이터는 TanStack Query, 폼은 React Hook Form + Zod.
- **모바일 우선** 디자인. 360px 폭에서 먼저 확인한다.
- 달성률 표시: 100.00은 `MAX`, 그 외 소수점 둘째 자리까지.
- Access Token은 메모리에만 둔다. localStorage/sessionStorage에 토큰을 저장하지 않는다.

## 보안 원칙 (타협하지 않는다)
- 비밀번호는 BCrypt. 로그에 비밀번호/토큰/개인정보/요청 본문 원문을 남기지 않는다.
- **Access 토큰과 Refresh 토큰은 종류(`typ`)로 구분**한다. API 인증에는 Access 토큰만 받는다.
- Refresh Token은 httpOnly + Secure + SameSite=Strict 쿠키. DB에는 **해시만** 저장하고 **Rotation + 재사용 탐지**를 적용한다.
- 기본 정책은 deny all. 공개 경로만 명시적으로 허용한다.
- CORS는 허용 Origin 화이트리스트(환경변수). `*` 금지.
- 로그인/재발급/가입/가져오기에는 Rate Limit과 실패 잠금을 둔다. 로그인 실패 메시지는 통일한다.
- **비밀값(DB 비밀번호, JWT 키, ROOT 초기 비밀번호, API 키)은 코드/저장소에 넣지 않는다.** 환경변수만 사용한다. `.env`, `application-local.yml`은 `.gitignore`에 있어야 한다.
- 타인의 기록에 접근하면 404로 응답한다. (존재 여부 비노출)
- ROOT/ADMIN의 관리 작업은 `audit_logs`에 기록한다.

## 공식 기록 가져오기 / 스크린샷 규칙
- 서버는 **Konami 계정, 세션, 쿠키를 받지도 저장하지도 않는다.** 공식 사이트를 서버에서 스크래핑하지 않는다.
- 가져오기는 브라우저(확장/북마클릿)가 읽은 **파싱된 값만** 받는다. 가져오기 **전용 토큰**(권한 제한, 해시 저장, 폐기 가능)을 쓰고, 서버가 값을 다시 검증한다.
- 타 서비스의 스크립트/API를 **복사하지 않고 직접 작성**한다.
- 스크린샷 원본과 인식 결과 JSON은 **저장하지 않는다.** 이미지 출처는 `input_type`으로만 표시하며, `IMAGE`는 서버가 직접 인식한 값 그대로 저장했을 때만 서버가 지정한다.

## 권한
- **ROOT**: 1명. 곡/채보 등록, 역할 변경, 설정 변경, 모든 권한. 초기 계정은 환경변수로 생성. API로 ROOT를 새로 지정하는 기능은 만들지 않는다.
- **ADMIN**: 난이도표 설계/수정.
- **USER**: 본인 기록 CRUD, 조회.

## 하지 않는 것
- Konami 계정 정보 수집, 서버의 공식 사이트 자동 로그인/스크래핑
- 음원, 채보, 재킷 이미지, 게임 로고 사용. 공식 데이터를 통째로 복사해 곡 DB를 만들지 않는다.
- 공식 서비스처럼 보이는 표현. 화면에 "비공식 팬 프로젝트" 고지를 유지한다.

## 테스트
- 서비스: JUnit5 + Mockito
- 쿼리: Testcontainers MySQL로 실제 DB에서 검증. 집계/스킬 계산 쿼리는 필수.
- 스킬 계산: 곡당 1채보, HOT/그 외 25개 제한, scope 필터, 25개 미만, 공식 스킬 값 대조.
- 보안: 권한별 접근(USER가 ROOT API → 403), 타인 기록 접근, **refresh 토큰으로 API 호출 시 거부**
- 달성률 경계값: 0.00, 100.00, -0.01, 100.01, 소수 셋째 자리

## Git 규칙
- `main`은 항상 동작하는 상태. 기능은 `feature/<이름>` 브랜치에서 작업한다.
- 커밋 메시지: `type: 요약` (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`)
- 한 커밋에 한 가지 변경. AI가 만든 큰 변경은 쪼개서 커밋한다.
- 줄바꿈은 LF로 통일한다. (루트 `.gitattributes`: `* text=auto eol=lf`)
- 비밀값이 커밋에 들어가지 않았는지 커밋 전에 확인한다.
- 이미 푸시한 커밋은 `reset`/`force push`로 되돌리지 않는다. (`revert` 사용)

## 유의사항 (진행하면서 추가)
<!-- 작업 중 생기는 규칙이나 주의점을 여기에 한 줄씩 추가한다. -->
- 현재 작업 트리의 수정 다수는 줄바꿈 차이로 보인다. 기능 작업 전에 줄바꿈 정리를 별도 커밋으로 먼저 한다.
