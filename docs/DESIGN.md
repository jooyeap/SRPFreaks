# Gitalog 설계 문서

> 비공식 팬 프로젝트. GITADORA(Guitar/Bass) 플레이 기록을 **노트 옵션별로** 저장하고,
> 전체 / SRN / SRN+ 기준의 **스킬 목록(HOT 25 + 그 외 25)** 을 계산해서 보여주는 웹 서비스.
> 살아있는 문서다. 결정이 바뀌면 "결정 기록"과 "변경 이력"에 남기고 본문을 고친다.

---

## 0. 결정 기록

| # | 날짜 | 결정 |
|---|---|---|
| D1 | 2026-10-01 | `users.eagate_session`, `manual_records.evidence_image_url`, `manual_records.ocr_extracted_json` 제거. **이미지는 저장하지 않는다.** 이미지로 도출된 기록이라는 사실은 `input_type`으로만 표시 |
| D2 | 2026-10-01 | **A안**: 공식 최고 기록(`official_records`)과 옵션 기록(`option_records`)을 분리한다. 옵션별로 테이블을 나누지 않고 `note_option` 컬럼으로 구분한다 |
| D3 | 2026-10-01 | 스킬 값은 **저장하지 않고 계산**한다. 공식 사이트에서 가져온 스킬 값은 검증용으로만 저장 |
| D4 | 2026-10-01 | 스킬 규칙: 곡당 **1채보만** 반영(파트/난이도 무관, **스킬 값이 가장 높은 것**), HOT = 현재 버전 신곡, HOT 25 + 그 외 25, 감산 없음. 소수 처리 방식은 테스트로 확정 |
| D5 | 2026-10-01 | 공식 기록 가져오기는 **서버가 Konami 계정/세션을 보관하지 않는** 방식(브라우저 확장 + 북마클릿 보조). Phase 2 |
| D6 | 2026-10-01 | 스택: Spring Boot + JPA(쓰기/일반 조회) + MyBatis(복잡한 읽기) + MySQL, Next.js + TypeScript. 곡/채보 등록은 ROOT만. 배포는 로컬 검증 후 GitHub Actions → AWS EC2 |

---

## 1. 목적과 범위

### 문제
공식 기록은 곡/난이도별 **최고 달성률만** 남고, 어떤 노트 옵션으로 달성했는지 정보가 없다.
최고보다 낮은 기록은 어디에도 남지 않아서 옵션별 기록을 보려면 직접 저장해야 한다.

### 해결
- 유저가 옵션별 기록을 저장한다. (MVP: 수동 입력, 이후: 스크린샷 인식)
- 공식 최고 기록은 브라우저에서 가져와서 기준선으로 쓴다. (Phase 2)
- 곡 + 채보 + **옵션별** 최고 기록과, 옵션 기준 **스킬 목록**을 보여준다. (핵심 화면)

### 범위
| 항목 | 내용 |
|---|---|
| 파트 | GUITAR, BASS |
| 노트 옵션 | NORMAL, RANDOM, SUPER_RANDOM(SRN), RANDOM_PLUS, SUPER_RANDOM_PLUS(SRN+) |
| 달성률 | 0.00 ~ 100.00 (화면에서 100.00은 MAX로 표기) |
| 스킬 목록 | 전체 / SRN / SRN+ 세 가지 (이후 다른 옵션도 추가 가능) |
| 곡 정보 | 곡명, 아티스트 등 텍스트 메타데이터만. 음원/채보/이미지/로고는 다루지 않음 |
| 사용자 | 여러 명이 로그인해서 사용 |

### 비범위 (하지 않는 것)
- Konami 계정 정보/세션 수집·보관, 서버의 공식 사이트 자동 로그인/스크래핑
- 음원, 채보, 재킷 이미지, 게임 로고 사용
- 스크린샷 원본 저장 (인식 후 폐기)
- 공식 서비스로 오인될 수 있는 표현 (화면에 "비공식 팬 프로젝트" 고지)

---

## 2. 현재 코드 상태와 목표의 차이 (2026-10-01 기준)

현재 저장소(`feature/db-schema` 브랜치)에는 인증(회원가입/로그인, JWT)과 V1 스키마, 엔티티/리포지토리가 있다.
`frontend/`, `docker-compose.yml`, `.github/workflows/`는 비어 있다.

| 항목 | 현재 | 목표 / 처리 |
|---|---|---|
| 빌드 | Gradle, Spring Boot 4.1.1, Java 17 | **유지** (문서도 Gradle 기준) |
| 패키지 | 계층형 (`controller/service/repository/entity/dto/config/security`) | **유지**. 도메인이 커지면 도메인별로 전환 검토 |
| 로그인 ID 컬럼 | `users.username` | **유지** (`login_id`로 바꾸지 않음) |
| 채보 테이블 | `song_difficulties` (`instrument_part`, `difficulty_type`, `level`) | **유지** (이 문서의 "채보"는 이 테이블) |
| 공식 기록 | `play_records` | `official_records`로 이름 변경 (V2) |
| 옵션 기록 | `manual_records` | `option_records`로 이름 변경 (V2) |
| 제거 대상 컬럼 | `eagate_session`, `evidence_image_url`, `ocr_extracted_json` | V2에서 제거 (D1) |
| 스킬 값 컬럼 | `play_records.skill_point`, `manual_records.skill_point` | 옵션 기록 쪽은 제거(D3). 공식 쪽은 `official_skill_point`(검증용)로 이름 변경 |
| `OptionType` | RANDOM, SUPER_RANDOM, RANDOM_PLUS, SUPER_RANDOM_PLUS | `NORMAL` 추가 (enum은 VARCHAR 저장이라 스키마 변경 없음) |
| 시간 | `LocalDateTime`, JDBC `serverTimezone=Asia/Seoul` | UTC 저장으로 전환 (`Instant`, JDBC 시간대 UTC). 배포 전인 지금이 가장 싸다 |
| 사용자 | username, password_hash, created_at | role, status, nickname, failed_login_count, locked_until, updated_at 추가 |
| 소프트 삭제 | 없음 | `is_deleted` 추가 |
| 인증 | Access/Refresh 토큰 구분 없음 | **아래 9.1 보안 선행 작업 참고** |
| 에러 처리 | 공통 처리 없음 | `@RestControllerAdvice` 추가 |
| API 경로 | `/api/auth/**` | `/api/v1/auth/**` |
| 의존성 | JPA, Security, Validation, Flyway, JJWT, Lombok | MyBatis, springdoc, Testcontainers 추가 (**Boot 4.1.1과 호환되는 버전 확인 후**) |
| 설정 | access 토큰 360000ms(6분), `show-sql` + SQL debug 로그 중복 | 값 확인 후 조정, 로그는 한쪽만 |
| `docs/table.sql` | V1보다 오래됨 | **폐기**. 스키마의 기준은 Flyway 마이그레이션 파일 |
| 줄바꿈 | 작업 트리에 CRLF 차이로 보이는 수정 다수 | 루트 `.gitattributes`(`* text=auto eol=lf`)로 정리 |

> **마이그레이션 원칙**: 이미 적용된 `V1__init_schema.sql`은 수정하지 않는다(Flyway 체크섬 오류). 모든 변경은 새 `V2__...sql`부터 추가한다.

---

## 3. 기술 스택

| 영역 | 스택 |
|---|---|
| 백엔드 | Java 17, Spring Boot 4.1.1(Gradle), Spring Web MVC, Spring Security, JJWT, Spring Validation, Spring Data JPA, Flyway, Lombok, MyBatis(추가 예정), springdoc(추가 예정) |
| DB | MySQL 8.x (로컬은 Docker) |
| 프론트 | React, Next.js(App Router), TypeScript, TanStack Query, React Hook Form + Zod, Tailwind CSS |
| 확장 프로그램 (Phase 2) | Chrome/Edge Manifest V3, TypeScript |
| 테스트 | JUnit5, Mockito, Testcontainers(MySQL) |
| 인프라 | Docker, GitHub, GitHub Actions(CI/CD), AWS EC2 |

### JPA와 MyBatis 역할 분리
- **JPA**: 모든 쓰기와 단순 조회
- **MyBatis**: 집계/스킬 계산/통계 등 복잡한 **읽기 전용** 쿼리
- 규칙
  - MyBatis로 쓰기를 하지 않는다.
  - 같은 트랜잭션에서 JPA 쓰기 직후 MyBatis로 읽어야 하면 `flush()`를 먼저 호출한다. 가능하면 피한다.
  - MyBatis는 `#{}`만 쓴다. `${}` 금지. 정렬 컬럼 등 불가피하면 화이트리스트 검증.

---

## 4. 아키텍처

### 4.1 패키지 (현재 계층형 유지)
```
com.gitalog.backend
├── config        Security, JWT 설정, CORS, Swagger, MyBatis
├── controller    API 진입점
├── service       비즈니스 로직 (권한/소유자 검증 포함)
├── repository    JPA 리포지토리
├── mapper        MyBatis 매퍼 (읽기 전용 집계/스킬 계산)
├── entity        JPA 엔티티, enum
├── dto           요청/응답 DTO
├── security      JWT 필터, UserDetails
└── common        공통 예외, 에러 응답, 유틸
```

### 4.2 확장을 위한 원칙
1. Enum은 DB에 **VARCHAR**로 저장한다. (`@Enumerated(EnumType.STRING)`) 새 옵션/파트/난이도가 생겨도 스키마 변경이 필요 없다.
2. 옵션별로 **테이블을 나누지 않는다.** `note_option` 컬럼과 인덱스로 구분한다.
3. 스킬 목록의 기준은 `scope` 값(ALL, SRN, SRN_PLUS ...)으로 구분한다. 새 기준은 값 추가로 끝나야 한다.
4. API는 `/api/v1/` 접두사로 버전을 둔다.
5. 확장 가능성이 큰 값은 nullable 컬럼 또는 JSON 컬럼으로 열어둔다. (`option_records.extra_options`, `platform`)
6. 권한은 `Role` enum + **RoleHierarchy**(ROOT > ADMIN > USER).
7. 설정값(HOT 버전, 토큰 만료, 허용 Origin 등)은 코드에 박지 않는다. 운영 중 바뀌는 값은 `app_settings`, 배포 설정은 환경변수.
8. 새 파트(DRUM 등)는 enum 값 추가 + 데이터 등록으로 가능해야 한다.

---

## 5. 권한

| 역할 | 설명 | 인원 |
|---|---|---|
| ROOT | 서비스 운영자. 곡/채보 등록, 역할 변경, 설정 변경, 모든 권한 | 1명 |
| ADMIN | 난이도표 설계/수정/보완 | 소수 |
| USER | 기록 입력/조회 | 다수 |

| 기능 | ROOT | ADMIN | USER |
|---|:-:|:-:|:-:|
| 회원가입/로그인 | O | O | O |
| 내 기록 CRUD, 가져오기, 스킬 조회 | O | O | O |
| 곡/채보 조회 | O | O | O |
| 곡/채보 등록·수정·삭제 | O | X | X |
| 난이도표 조회 | O | O | O |
| 난이도표 생성·수정 | O | O | X |
| 유저 역할 변경, 설정(`app_settings`) 변경 | O | X | X |
| 감사 로그 조회 | O | X | X |

- ROOT 계정은 **환경변수로 초기 생성**한다. 코드/DB 시드에 비밀번호를 하드코딩하지 않는다.
- ROOT는 1명 유지. API로 ROOT를 새로 지정하는 기능은 만들지 않는다.
- 본인 기록만 수정/삭제 가능. 소유자 검증은 서비스 계층에서 한다.

---

## 6. 데이터 모델 (목표)

공통 컬럼: `created_at`, `updated_at`, `is_deleted`(소프트 삭제). 시간은 **UTC로 저장**한다.
표기는 목표 스키마이며, 현재와의 차이는 2장 표를 따른다. 컬럼 추가/변경은 `V2__...sql` 이후 마이그레이션으로 한다.

### users
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | BIGINT PK AI | |
| username | VARCHAR(50) | UNIQUE (로그인 ID) |
| password_hash | VARCHAR(255) | BCrypt |
| nickname | VARCHAR(30) | 표시용. 랭킹 전까지는 NULL 허용 |
| role | VARCHAR(20) | ROOT / ADMIN / USER, 기본 USER |
| status | VARCHAR(20) | ACTIVE / LOCKED / WITHDRAWN |
| failed_login_count | INT | 로그인 실패 누적 |
| locked_until | DATETIME NULL | 일시 잠금 |

### refresh_tokens
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | BIGINT PK AI | |
| user_id | BIGINT FK | |
| family_id | CHAR(36) | 로그인 1회당 1개. 재사용 탐지용 |
| token_hash | CHAR(64) | **원문이 아닌 SHA-256 해시**, UNIQUE |
| expires_at | DATETIME | |
| revoked_at | DATETIME NULL | 로테이션/로그아웃 시 기록 |

### songs
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | BIGINT PK AI | |
| title | VARCHAR(255) | |
| artist | VARCHAR(255) NULL | |
| added_version | VARCHAR(30) | 곡이 추가된 게임 버전. **HOT 판정에 사용** |
| created_by | BIGINT FK(users) | ROOT |

- 중복 검사(title + artist, 공백/대소문자 정규화)는 서비스 계층에서 한다. (소프트 삭제 때문에 DB UNIQUE만으로는 부족)

### song_difficulties (채보)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | BIGINT PK AI | |
| song_id | BIGINT FK | |
| instrument_part | VARCHAR(10) | GUITAR / BASS |
| difficulty_type | VARCHAR(20) | BASIC / ADVANCED / EXTREME / MASTER |
| level | DECIMAL(3,2) | 예: 5.50 |

- UNIQUE(song_id, instrument_part, difficulty_type)
- 레벨은 현재 값만 저장한다. 버전별 레벨 이력이 필요해지면 컬럼/테이블을 추가한다.

### official_records (공식 최고 기록, 기존 `play_records`)
공식 사이트에서 가져온 곡별 최고 달성률. **옵션 정보가 없다.** 유저와 채보당 1행이며 가져올 때마다 갱신한다.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | BIGINT PK AI | |
| user_id | BIGINT FK | |
| difficulty_id | BIGINT FK | |
| achievement_rate | DECIMAL(5,2) | |
| official_skill_point | DECIMAL(6,2) NULL | 공식 값. **계산 검증용** |
| clear_rank | VARCHAR(10) NULL | |
| synced_at | DATETIME | 마지막으로 가져온 시각 |

- UNIQUE(user_id, difficulty_id)
- 가져온 값이 이전보다 올랐는지 비교해서 "새 최고 기록" 알림을 만든다. (Phase 2, 이력 테이블은 필요해질 때 추가)

### option_records (옵션 기록, 기존 `manual_records`)
유저가 입력한 옵션별 기록. 플레이할 때마다 **계속 쌓인다.**

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | BIGINT PK AI | |
| user_id | BIGINT FK | |
| difficulty_id | BIGINT FK | |
| note_option | VARCHAR(20) | NORMAL / RANDOM / SUPER_RANDOM / RANDOM_PLUS / SUPER_RANDOM_PLUS |
| achievement_rate | DECIMAL(5,2) | CHECK 0.00 ~ 100.00 |
| played_at | DATETIME(6) | UTC. 입력하지 않으면 저장 시각 |
| input_type | VARCHAR(10) | MANUAL / IMAGE |
| platform | VARCHAR(10) NULL | ARCADE / KONASTE (확장용) |
| memo | VARCHAR(255) NULL | |
| extra_options | JSON NULL | 하이스피드 등 이후 추가될 옵션용 |

- 인덱스
  - `(user_id, difficulty_id, note_option, achievement_rate DESC)` : 내 옵션별 최고 기록, 스킬 계산
  - `(difficulty_id, note_option, achievement_rate DESC)` : 곡별 랭킹 (Phase 3)
  - `(user_id, played_at DESC)` : 최근 기록 목록
- 달성률 검증은 **3중**: 프론트(Zod) → 백엔드(Validation) → DB(CHECK, MySQL 8.0.16+)
- `input_type = IMAGE`는 **서버가 직접 인식한 값 그대로 저장했을 때만** 서버가 찍는다. 클라이언트가 보낸 값을 믿지 않는다. 인식 후 유저가 수정한 경우의 표기는 구현 단계에서 확정한다.
- 화면 표기: 100.00은 `MAX`, 그 외 소수점 둘째 자리까지.

### app_settings
| 컬럼 | 타입 | 비고 |
|---|---|---|
| setting_key | VARCHAR(50) PK | 예: `skill.hot_versions` |
| setting_value | VARCHAR(500) | 예: `GALAXY WAVE DELTA` (여러 개면 콤마 구분) |
| updated_by / updated_at | | ROOT만 변경, 감사 로그 기록 |

### Phase 2 이후 테이블
| 테이블 | 용도 |
|---|---|
| skill_snapshots | 스킬 성장 추이. user_id, scope, hot_total, other_total, total, calculated_at |
| import_tokens | 가져오기 전용 토큰. user_id, token_hash, last_used_at, revoked_at |
| import_unmatched | 가져온 데이터 중 DB에 없는 곡. ROOT가 등록할 목록 |
| difficulty_tables / difficulty_table_entries | ADMIN이 관리하는 난이도표 (id, name, part, status, revision / table_id, difficulty_id, tier_label, tier_order, comment) |
| audit_logs | ROOT/ADMIN 관리 작업 기록 (actor_id, action, target_type, target_id, detail JSON) |

---

## 7. 스킬 계산 규칙

### 확정된 규칙 (D3, D4)
- 채보 하나의 스킬 값 = `달성률 × 레벨 × 20` (감산 없음. 모든 옵션 동일하게 계산)
- **곡당 1채보만** 반영한다. Guitar/Bass, 난이도에 상관없이 그 곡의 채보 중 **스킬 값이 가장 높은 것** 하나
- HOT = **현재 버전 신곡**. `songs.added_version`이 `app_settings`의 `skill.hot_versions`에 포함되면 HOT
- 목록 = HOT 곡 상위 25 + 그 외 곡 상위 25. 점수 = 50개 스킬 값의 합
- Guitar와 Bass는 **하나의 목록**으로 합친다.

### scope (목록 기준)
| scope | 집계 대상 기록 |
|---|---|
| ALL | 공식 최고 기록과 모든 옵션 기록 중 채보별 최고 (※ 정의는 구현 전 재확인) |
| SRN | `SUPER_RANDOM`으로 기록한 것만 |
| SRN_PLUS | `SUPER_RANDOM_PLUS`로 기록한 것만 |

### 계산 순서 (MyBatis 읽기 쿼리)
1. scope에 맞는 기록만 모아 **채보별 최고 달성률**을 구한다.
2. 채보별 스킬 값을 계산한다.
3. **곡 단위로** 스킬 값이 가장 높은 채보 1개만 남긴다. (`ROW_NUMBER() OVER (PARTITION BY song_id ORDER BY 스킬값 DESC)`)
4. HOT / 그 외로 나눠 각각 상위 25개를 뽑아 합산한다.

### 검증
- 스킬 값의 **소수 처리(내림/반올림)** 는 공식 문서에서 확인하지 못했다. 가져온 `official_skill_point`와 계산값을 비교하는 테스트로 규칙을 확정한다. (확정되면 이 문서에 기록)
- 동점 처리(같은 스킬 값)는 구현 시 정하고 문서에 남긴다.

---

## 8. 공식 기록 가져오기 (Phase 2)

### 원칙
- 서버는 Konami 계정/세션/쿠키를 **받지도, 저장하지도 않는다.**
- 유저 본인의 브라우저(이미 공식 사이트에 로그인한 상태)가 공식 페이지를 읽고, **파싱된 값만** Gitalog API로 보낸다.
- 타 서비스의 스크립트/API를 복사하지 않고 **직접 작성**한다.

### 방식
| 방식 | 용도 |
|---|---|
| **브라우저 확장 프로그램 (MV3)** | 주 방식. 공식 기록 페이지에 [Gitalog로 보내기] 버튼 표시. 코드는 설치 시점에 고정되어 원격 코드 실행이 없다. 권한은 공식 사이트 도메인과 Gitalog API로 한정 |
| 북마클릿 | 보조(모바일/비Chrome). Gitalog에서 토큰이 들어간 링크를 북마크바로 끌어다 놓는 방식 |
| 연동 | Gitalog의 [공식 기록 가져오기] 버튼 → 공식 사이트 새 탭 → 확장이 감지해서 버튼 표시. 토큰은 확장으로 자동 전달 |

### 가져오기 API 보안
- **가져오기 전용 토큰**: 가져오기 권한만 있고, 해시로 저장하며, 유저가 폐기할 수 있다. 일반 로그인 토큰과 별개.
- 토큰은 요청 본문이 아닌 `Authorization` 헤더로 보낸다. 요청 크기 제한, Rate Limit 적용.
- 서버가 값을 다시 검증한다. (달성률 범위, enum, 개수 상한) 클라이언트를 믿지 않는다.
- 요청 본문/원본 HTML을 로그에 남기지 않는다.
- DB에 없는 곡은 버리지 않고 `import_unmatched`에 모아 ROOT가 등록한다.

### 한계와 활용
- 공식 사이트는 **최고 달성률만** 준다. 옵션 정보는 없다.
- 가져온 최고 기록이 이전보다 올랐으면 "이번 갱신은 어떤 옵션이었나요?"를 물어 옵션 기록으로 이어준다.
- 공식 사이트 페이지 구조(URL의 버전 경로, 셀렉터)는 바뀔 수 있다. 버전/셀렉터는 설정으로 분리하고, 실패하면 유저에게 알린다.
- **약관 확인이 필요하다.** (자동 접근 관련 조항을 아직 확인하지 못했다)

---

## 9. 보안 설계

### 9.1 인증
- 비밀번호: **BCrypt**. 최소 길이/복잡도 정책 적용.
- **Access Token (JWT)**: 짧게(예: 15분). 프론트 **메모리**에만 보관, `Authorization: Bearer`.
- **Refresh Token**: 길게(예: 14일). **httpOnly + Secure + SameSite=Strict 쿠키**. DB에는 **해시만** 저장.
- **Refresh Rotation**: 재발급마다 새 토큰 발급, 기존 토큰 폐기. 폐기된 토큰이 다시 오면 같은 `family_id` 전체를 폐기한다.
- JWT 서명 키는 환경변수. 알고리즘을 고정한다.

**현재 코드에서 먼저 고칠 것 (보안 선행 작업)**
1. Access/Refresh 토큰이 같은 키와 형식이라 **refresh 토큰으로 API 호출이 가능하다.** 토큰에 종류(`typ`) 클레임을 넣고, 필터는 access 토큰만 받는다.
2. Refresh 토큰이 JSON 본문으로 내려간다. httpOnly 쿠키로 옮긴다.
3. 재발급 API와 로테이션이 없다.
4. 공통 에러 처리가 없다. (아이디 중복, 로그인 실패 시 응답 형태 통제)
5. CORS, Rate Limit, 로그인 실패 잠금, Role이 없다.

### 9.2 접근 제어
- 기본 정책은 **deny all**, 공개 경로만 `permitAll`.
- 메서드 보안(`@PreAuthorize`) + 서비스 계층 소유자 검증을 함께 쓴다.
- 본인 기록이 아니면 **404**로 응답해 존재 여부를 숨긴다.

### 9.3 입력/출력
- 모든 요청 DTO에 Validation. 엔티티를 직접 요청/응답에 쓰지 않는다.
- MyBatis `${}` 금지, 정렬/필터 값은 화이트리스트.
- 응답에 `password_hash` 등 민감 정보 노출 금지. 에러 응답에 스택트레이스/SQL 노출 금지.

### 9.4 공격 대응
- 로그인/재발급/회원가입/가져오기에 **Rate Limit**. (IP + 계정 기준)
- 로그인 실패 누적 시 일시 잠금. 실패 메시지는 "아이디 또는 비밀번호 오류"로 통일.
- **CORS**: 허용 Origin을 환경변수 화이트리스트로. `*` 금지.
- **CSRF**: access token은 헤더 방식이라 영향이 작고, refresh 쿠키는 SameSite=Strict + POST 전용으로 제한.
- 보안 헤더: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`(배포 시), CSP(프론트).

### 9.5 비밀 관리
- DB 비밀번호(`DB_PASSWORD`), JWT 키(`JWT_SECRET`), ROOT 초기 비밀번호, Claude API 키는 **환경변수**. 저장소에 올리지 않는다.
- `.env`, `application-local.yml` 등은 `.gitignore`에 등록한다.
- 로그에 토큰, 비밀번호, 개인정보를 남기지 않는다.
- 배포 시 시크릿은 GitHub Actions Secrets / EC2 환경변수로 주입한다.

### 9.6 개인정보
- 수집 항목: 로그인 ID, 닉네임(선택), 비밀번호 해시. 이메일은 수집하지 않는다.
- 가입 화면에 수집 항목과 목적을 안내한다. 탈퇴 시 기록 처리 정책은 구현 단계에서 확정한다.

---

## 10. API 초안 (`/api/v1`)

에러 형식: `{ code, message, timestamp, path, fieldErrors[] }`. 목록은 **페이지네이션** 필수(`page`, `size` 상한, `sort` 화이트리스트).

| 영역 | 메서드 / 경로 | 권한 |
|---|---|---|
| 인증 | POST `/auth/signup`, `/auth/login`, `/auth/refresh`, `/auth/logout` | 공개/인증 |
| 내 정보 | GET/PATCH `/users/me` | USER+ |
| 곡 | GET `/songs`(검색), GET `/songs/{id}` | USER+ |
| 곡/채보 관리 | POST/PATCH/DELETE `/songs`, `/difficulties` | ROOT |
| 옵션 기록 | POST/GET/PATCH/DELETE `/records` | USER+ (본인) |
| 옵션별 최고 | GET `/difficulties/{id}/my-bests` | USER+ |
| 스킬 목록 | GET `/skills/me?scope=ALL\|SRN\|SRN_PLUS` (50개 + 합계) | USER+ |
| 스킬 추이 | GET `/skills/me/history` (Phase 2) | USER+ |
| 가져오기 토큰 | POST/DELETE `/import-tokens` (Phase 2) | USER+ |
| 공식 기록 가져오기 | POST `/imports/official` (Phase 2, 가져오기 토큰) | 토큰 |
| 난이도표 | GET `/difficulty-tables` / POST·PATCH | USER+ / ADMIN+ |
| 설정 | GET/PATCH `/admin/settings` | ROOT |
| 역할 | PATCH `/admin/users/{id}/role` | ROOT |
| 감사 로그 | GET `/admin/audit-logs` | ROOT |

- Swagger(springdoc)로 문서 자동 생성. 운영 환경에서는 노출 제한.
- 프론트 타입은 OpenAPI 스펙에서 생성하는 방식을 검토한다. (TypeScript 학습 부담 완화)

---

## 11. 화면 (모바일 우선)

아케이드 옆에서 폰으로 바로 입력하는 상황을 기준으로 **모바일 우선**으로 설계한다.

1. 로그인 / 회원가입
2. **빠른 기록 입력**: 곡 검색 → 파트/난이도 → 옵션 → 달성률. 직전 옵션/파트를 기본값으로 유지
3. 내 기록 목록: 파트, 옵션, 기간 필터 + 정렬 + 페이지네이션
4. **곡 상세**: 채보별로 옵션별 최고 기록 표
5. **스킬 목록**: 전체 / SRN / SRN+ 탭. HOT 25 + 그 외 25, 합계
6. 내 통계, 스킬 추이 (Phase 2)
7. 공식 기록 가져오기 / 확장 연동 (Phase 2)
8. 난이도표 (조회)
9. 관리: 곡/채보 등록(ROOT), 설정(ROOT), 난이도표 편집(ADMIN), 유저 역할(ROOT)

---

## 12. 스크린샷 자동 입력 (Phase 2)

- 결과 화면 이미지를 올리면 **백엔드가 Claude API(비전)** 를 호출해 곡명, 난이도, 달성률(옵션이 표시되면 옵션까지)을 추출한다.
- 결과는 **입력 폼을 채우기만** 하고, 유저가 확인/수정 후 저장한다. 자동 저장하지 않는다.
- 이미지는 **인식 직후 폐기**하고 저장하지 않는다. 인식 결과 JSON도 저장하지 않는다. (D1)
- 업로드 검증: 실제 콘텐츠 기준 파일 타입, 크기 상한, 유저당 호출 횟수 제한.
- API 키는 서버에만 둔다. 인식된 곡명은 DB의 곡 목록과 매칭하고, 실패하면 유저가 직접 선택한다.

---

## 13. 개발/배포 단계

| 단계 | 내용 |
|---|---|
| Phase 0 | 줄바꿈/`.gitattributes` 정리, `docker-compose.yml`(MySQL), **V2 마이그레이션**(D1·D2 반영, 컬럼 추가), 공통 에러 처리, CI 기본 |
| Phase 1 | 인증 보안 보강(9.1 선행 작업, Role, 재발급), 곡/채보 등록(ROOT), 옵션 기록 CRUD, 옵션별 최고 기록 조회, 모바일 UI |
| Phase 1.5 | **스킬 목록 계산(전체/SRN/SRN+)**, `app_settings`, 역할 관리, 난이도표(ADMIN), 감사 로그 |
| Phase 2 | 공식 기록 가져오기(확장 + 북마클릿), 스크린샷 인식, 스킬 추이, 통계 |
| Phase 3 | 곡별 랭킹, 유저 간 비교/공유, 곡 등록 요청 |
| 배포 | **로컬 검증 → GitHub Actions CI → AWS EC2 배포(CD)**. Phase 1 완료 후 첫 배포 |

### 배포 개요 (구현 시 구체화)
- EC2에 Docker로 백엔드 + MySQL, 프론트는 같은 서버 또는 별도 배포를 검토한다.
- HTTPS(도메인 + 인증서), 보안 그룹은 필요한 포트만. MySQL 포트는 외부에 열지 않는다.
- DB 백업 방안을 정한다.

---

## 14. 테스트 방침
- 서비스 로직: JUnit5 + Mockito
- 리포지토리/MyBatis 쿼리: **Testcontainers MySQL**로 실제 MySQL에서 검증 (집계/스킬 계산 쿼리 필수)
- 스킬 계산: 곡당 1채보 선택, HOT/그 외 25개 제한, scope별 필터, 25개 미만일 때, 소수 처리를 **공식 스킬 값과 비교**하는 테스트
- 보안: 권한별 접근 테스트(USER가 ROOT API → 403), 타인 기록 접근 테스트, **refresh 토큰으로 API 호출 시 거부**
- 달성률 경계값: 0.00, 100.00, -0.01, 100.01, 소수 셋째 자리

---

## 15. 확인이 필요한 항목 (미정)
- [ ] 스킬 값의 소수 처리 방식 → 계산 테스트로 확정 (D4)
- [ ] scope ALL의 정확한 정의 (공식 최고 + 옵션 기록 최고가 맞는지)
- [ ] 스킬 동점 처리
- [ ] 결과 화면에 노트 옵션이 표시되는지 (스크린샷 인식 범위)
- [ ] 공식 사이트 기록 페이지의 현재 URL/구조 (버전 경로, 셀렉터)
- [ ] e-amusement 이용약관의 자동 접근 관련 조항
- [ ] MyBatis, springdoc의 Spring Boot 4.1.1 호환 버전
- [ ] access 토큰 만료 시간 (현재 360000ms = 6분, 목표 15분 여부)
- [ ] 인식 후 유저가 수정한 기록의 `input_type` 표기
- [ ] 탈퇴 시 기록 처리 정책
- [ ] 프론트 배포 위치 (EC2 동일 서버 vs 별도)

## 16. 변경 이력
| 날짜 | 내용 |
|---|---|
| 2026-10-01 | 최초 작성 |
| 2026-10-01 | 현재 코드(Gradle, Boot 4.1.1, 계층형 패키지, Flyway)에 맞춰 개정. D1~D6 결정 반영, 스킬 계산 규칙과 공식 기록 가져오기 설계 추가 |
