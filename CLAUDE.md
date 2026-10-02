# CLAUDE.md — SRPFreaks

GITADORA(Guitar/Bass) 플레이 기록을 **노트 옵션별로** 저장하고, SRN+ 기준의 **레이팅 목록**(단일 15 + 그 외 25곡)을 계산하는 비공식 팬 웹 서비스.
상세 설계와 결정 기록은 `docs/DESIGN.md`, 화면/시각 규칙은 `docs/DESIGN-UI.md`를 따른다. 결정(D1~D18)을 번복하거나 설계와 충돌하는 요청이 오면 **코드를 쓰기 전에 알리고 확인**한다.

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
- 배포: GitHub Actions → AWS EC2 (로컬 검증 후)

## 폴더 구조
- `backend/` Spring Boot. 현재 **계층형 패키지**: `com.srpfreaks.backend.{config, controller, service, repository, mapper, entity, dto, security, common}`
- `frontend/` Next.js
- `docs/` 설계 문서 (`DESIGN.md` 데이터·API·보안, `DESIGN-UI.md` 화면·색·표시 규칙). `docs/table.sql`은 폐기 대상이며 참고하지 않는다.
- 스키마의 기준은 **Flyway 마이그레이션**(`backend/src/main/resources/db/migration`)이다.

## 개발 명령어 (backend 폴더에서)
- 실행: `./gradlew bootRun` (Windows: `gradlew.bat bootRun`)
- 테스트: `./gradlew test`
- 환경변수: `DB_PASSWORD`, `JWT_SECRET` (값은 저장소에 두지 않는다)
- 로컬 DB: `docker compose up -d` (루트 `docker-compose.yml`, MySQL 8.4. `.env.example`을 `.env`로 복사해 `DB_ROOT_PASSWORD`, `DB_PASSWORD` 입력). 초기화: `docker compose down -v`
- 프론트(생성 후): `npm run dev`, `npm run lint`, `npm run build`

## DB / Flyway 규칙
- **첫 배포 전까지는 `V1__init_schema.sql` 한 파일을 직접 고친다.** 고친 뒤에는 로컬 DB를 비우고(`docker compose down -v`) 다시 적용한다. **첫 배포 이후부터** 적용된 파일은 수정하지 않고 새 `V{n}__설명.sql`로 추가한다.
- `ddl-auto: validate`를 유지한다. 엔티티와 스키마가 다르면 마이그레이션을 고친다.
- 테이블/컬럼 이름: `users.google_sub`, `song_difficulties`(= 채보), `option_records`. **PK는 `{테이블 단수형}_id`** (`user_id`, `song_id`, `song_difficulty_id`, `option_record_id`, `difficulty_table_id`…), **FK는 참조하는 PK와 같은 이름**으로 쓴다. 시간 컬럼은 모두 `DATETIME(6)` UTC. 공식 기록 테이블(`official_records`)은 만들지 않는다 (D18).
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

## 스킬 계산 규칙 (D18, 상수표 방식. 임의로 바꾸지 않는다)
- **레이팅상수 R** = 채보의 서열표 기준 난이도 ✋에서 구한다. ✋ > 6.0 이면 `5×✋ − 15`, 아니면 `10×✋ − 45`.
- **채보 값 V** = `R × min(A,80)/100 + 3.2 × min(max(A−80,0),15)/15` (A = 달성률). 화면 점수 = V × 20. 레벨은 계산에 쓰지 않는다. 공식 `레벨 × 달성률 × 20`은 쓰지 않는다.
- **✋이 없는 채보(미정)는 계산하지 않고** 목록에서 제외한다. 화면에는 `미정`.
- 계수(80, 95, 3.2, 20, 기준점 6.0)는 `app_settings`의 `rating.*`로 두고 수식 모양은 코드에 둔다.
- **목록은 SRN+ 하나만** (ALL·SRN 없음). 속성(`pattern_type`)이 단일인 채보 상위 **15** + 그 외(복합·이중·삼중) 상위 **25** = 40채보를 합산한다. **곡당 1채보로 거르지 않는다** (같은 곡의 다른 채보도 각각 센다). 개수는 `rating.list_single`, `rating.list_other` 설정. HOT은 쓰지 않는다. Guitar와 Bass는 한 목록.
- **서열표에 ✋이 없는 채보와 서열표에 없는 채보는 레이팅에서 제외**하고 기록만 남긴다.
- 속성이 `레이팅 제외`(또는 NULL)인 채보는 어느 그룹에도 넣지 않는다. 레이팅 대상 = ✋과 속성이 모두 있는 채보.
- 옵션 기록은 5가지 옵션 모두 저장하지만 레이팅은 `SUPER_RANDOM_PLUS` 기록만 쓴다. scope는 값으로 확장 가능해야 한다.
- 스킬 값은 **저장하지 않고 계산**한다. **플레이어 티어**는 점수 합계(V×20의 합)의 정수부로 `player_tiers` 구간(DESIGN.md 7장 표, 0~9,500+ 20단계)에서 찾는다. 티어는 저장하지 않고 계산한다.
- 소수 처리와 동점 처리는 구현 시 정하고 `docs/DESIGN.md` 7장에 기록한다. 테스트는 직접 계산한 예시값으로 한다 (7장).

## 달성 표시 / 서열표 규칙 (D8, D9)
- 달성 단계는 **S < SS < FC < EXC 중 가장 높은 하나만** 표시한다. 단계는 저장하지 않고 계산한다. 판정 순서는 EXC(100.00) → FC(`is_full_combo`) → 95 → S.
- FC는 달성률로 알 수 없다. 기록 저장 시 `is_full_combo`를 받고, 달성률 100.00이면 true로 저장한다.
- 서열표는 **기준 난이도(✋, 0.1 단위)** 로 묶고, 비어 있으면 "미정" 묶음. 달성률은 **사용자 본인 기록**을 (곡, 난이도, 파트)로 연결해서 보여준다.
- 서열표의 CSV 달성률 일괄 입력은 **ADMIN 지정 1명 + ROOT만** 쓸 수 있다. 일반 USER에게 열지 않는다. 미리보기 후 저장, 실행 내역은 `audit_logs`.
- 곡/서열표 CSV 일괄 등록은 ROOT(서열표는 ADMIN 포함). 곡명은 NFKC 정규화·줄바꿈 제거 후 비교한다. 시트의 달성률 열은 마스터에 넣지 않는다.

## 곡 마스터 규칙 (D13, 가져오기는 D18로 보류)
- 곡 정보의 **아티스트는 `songs.artist` 하나**(게임 표기). 작곡가 컬럼은 두지 않는다. 곡명 표기(로마자/가타카나/한국어/별칭)는 `song_titles`에 둔다. 곡명 비교는 `normalized_title`(NFKC, 공백/줄바꿈 제거, 소문자)로 한다.
- 마스터는 **ROOT가 CSV를 올려서만** 늘린다 (미리보기 → 확정, 멱등 업서트). 가져오기와 `import_unmatched`는 보류했다 (D18, DESIGN.md 18.4). **자동 등록 금지.**
- 노트 수·메타데이터는 비어 있어도 기능이 돌아가야 한다 (nullable).

## 프론트 규칙
- TypeScript 사용. **`any` 금지.** 타입이 막히면 설명을 요청한다. (나는 TS 입문자)
- 서버 데이터는 TanStack Query, 폼은 React Hook Form + Zod.
- **모바일 우선** 디자인. 360px 폭에서 먼저 확인한다.
- 달성률 표시: 100.00은 `MAX`, 그 외 소수점 둘째 자리까지. 파트 표기는 `Guitar` / `Bass`.
- **다크/라이트 두 테마.** 색은 CSS 변수(또는 Tailwind 테마)로 관리하고 색 값을 컴포넌트에 직접 쓰지 않는다. 값 표는 `docs/DESIGN-UI.md` 4장.
- 색만으로 의미를 전달하지 않는다. 달성 단계는 글자(`S`/`SS`/`FC`/`EXC`)를 같이 표시한다. 본문 글자 대비 4.5 이상.
- 재킷 자리는 단색 칸 → 생성 타일. 이미지는 `songs.image_url`이 있고 설정 `ui.show_song_images`가 켜졌을 때만 쓴다. 외부 주소에서 직접 불러오지 않는다.
- 시안의 값(곡 이름, 점수, FC, 작곡가, BPM, 노트 수)은 임시 샘플이다. 코드에 하드코딩하지 않는다.
- Access Token은 메모리에만 둔다. localStorage/sessionStorage에 토큰을 저장하지 않는다.

## 보안 원칙 (타협하지 않는다)
- **로그인은 Google 로그인만 쓴다(D19). 비밀번호를 저장하지 않는다.** 로그에 비밀번호/토큰/개인정보/요청 본문 원문을 남기지 않는다.
- **Access 토큰과 Refresh 토큰은 종류(`typ`)로 구분**한다. API 인증에는 Access 토큰만 받는다.
- Refresh Token은 httpOnly + Secure + SameSite=Strict 쿠키. DB에는 **해시만** 저장하고 **Rotation + 재사용 탐지**를 적용한다.
- 기본 정책은 deny all. 공개 경로만 명시적으로 허용한다.
- CORS는 허용 Origin 화이트리스트(환경변수). `*` 금지.
- 로그인/재발급/사진 인식에는 Rate Limit을 둔다. Google 토큰 검증 실패 메시지는 통일한다. 탈퇴는 사용자와 기록을 완전히 삭제한다(D20).
- **비밀값(DB 비밀번호, JWT 키, `GOOGLE_CLIENT_ID`, `ROOT_EMAIL`, API 키)은 코드/저장소에 넣지 않는다.** 환경변수만 사용한다. `.env`, `application-local.yml`은 `.gitignore`에 있어야 한다.
- 타인의 기록에 접근하면 404로 응답한다. (존재 여부 비노출)
- ROOT/ADMIN의 관리 작업은 `audit_logs`에 기록한다.

## 공식 사이트와의 관계 (D18)
- **공식 기록·곡 목록 가져오기는 보류했다.** 확장 프로그램, 북마클릿, 가져오기 토큰, 공식 페이지 읽기 코드를 만들지 않는다. 설계 원문은 `docs/DESIGN.md` 18.4.
- 서버는 **Konami 계정, 세션, 쿠키를 받지도 저장하지도 않고**, 공식 사이트와 통신하지 않는다.
- 기록은 직접 입력하거나 사진 입력(D16)으로 넣는다. 사진은 저장하지 않고, 플레이어 이름·ID는 읽지 않는다.

## 범위와 기록 규칙 (D15)
- **보류 추가(D18)**: 공식 사이트 가져오기 전체 (D5, D17, `official_records`, `import_tokens`, `import_unmatched`). 다시 켤 때까지 만들지 않는다.
- **보류(만들지 않는다)**: 랭킹·유저 간 비교, 증빙 사진·인증·이의제기·신고(D14), 노트 성향 그래프(D11). 설계 원문은 `docs/DESIGN.md` 18장, 화면 규칙은 `docs/DESIGN-UI.md` 13장. 다시 켤 때까지 `source`·`verification` 컬럼, `record_evidence`·`record_disputes`·`difficulty_profiles` 테이블, 관련 API·설정을 만들지 않는다.
- 기록은 **본인이 직접 입력**하고 **본인만 수정·삭제**한다 (수정에 제한 없음). 다른 사용자의 기록은 ADMIN/ROOT도 고치지 않는다. 모든 기록은 같은 취급이고 인증 구분이 없다.
- 화면 문구는 짧은 명사형이나 `~다`체가 기본이다. `~다`가 너무 딱딱하면 `~요`를 쓴다 (예: "곡명이 없으니 직접 골라 주세요."). 문구는 사용자가 직접 쓰기도 하므로 임의로 다듬지 않는다.

## 권한
- **ROOT**: 1명. 곡/채보 등록, 역할 변경, 설정 변경, 모든 권한. 초기 계정은 환경변수로 생성. API로 ROOT를 새로 지정하는 기능은 만들지 않는다.
- **ADMIN**: 난이도표(서열표) 설계/수정. 그중 지정된 1명은 CSV 달성률 일괄 입력도 가능.
- **USER**: 본인 기록 CRUD, 조회.

## 하지 않는 것
- Konami 계정 정보 수집, 서버의 공식 사이트 자동 로그인/스크래핑
- 음원, 채보, 게임 로고 사용. **재킷 이미지는 허락 없이 쓰지 않는다.** 공식 데이터를 통째로 복사해 곡 DB를 만들지 않는다. 곡 데이터는 직접 정리한 시트 기준이고 `songs.source`에 출처를 남긴다. (`docs/DESIGN.md` 15장)
- 공식 서비스처럼 보이는 표현. 화면에 "비공식 팬 프로젝트" 고지를 유지한다.

## 테스트
- 서비스: JUnit5 + Mockito
- 쿼리: Testcontainers MySQL로 실제 DB에서 검증. 집계/스킬 계산 쿼리는 필수.
- 스킬 계산: 직접 계산한 예시값(달성률 0/80/95/100, ✋6.0 전후), 단일 15 / 그 외 25 그룹 분리, SRN+ 기록만 사용, 목록이 모자랄 때, ✋·속성 없는 채보 제외.
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
