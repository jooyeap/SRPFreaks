# SRPFreaks 설계 문서

> 비공식 팬 프로젝트. GITADORA(Guitar/Bass) 플레이 기록을 **노트 옵션별로** 저장하고,
> SRN+ 기준의 **레이팅 목록(단일 15 + 그 외 25 = 40채보)** 을 계산해서 보여주는 웹 서비스.
> 살아있는 문서다. 결정이 바뀌면 "결정 기록"과 "변경 이력"에 남기고 본문을 고친다.

---

## 0. 결정 기록

| # | 날짜 | 결정 |
|---|---|---|
| D1 | 2026-10-01 | `users.eagate_session`, `manual_records.evidence_image_url`, `manual_records.ocr_extracted_json` 제거. **이미지는 저장하지 않는다.** 이미지로 도출된 기록이라는 사실은 `input_type`으로만 표시 → **D14에서 변경**: 증빙 사진은 30일간 보관하고, 출처는 `source`·`verification`으로 구분 |
| D2 | 2026-10-01 | **(D18에서 일부 변경: `official_records`는 보류)** **A안**: 공식 최고 기록(`official_records`)과 옵션 기록(`option_records`)을 분리한다. 옵션별로 테이블을 나누지 않고 `note_option` 컬럼으로 구분한다 |
| D3 | 2026-10-01 | 스킬 값은 **저장하지 않고 계산**한다. (계산식은 D18에서 상수표 방식으로 대체) 공식 사이트에서 가져온 스킬 값은 검증용으로만 저장 |
| D4 | 2026-10-01 | **(D18로 대체: 채보 값 공식, 목록 구조, HOT 모두 바뀜)** 스킬 규칙: 곡당 **1채보만** 반영(파트/난이도 무관, **스킬 값이 가장 높은 것**), HOT = 현재 버전 신곡, HOT 25 + 그 외 25, 감산 없음. 소수 처리 방식은 테스트로 확정 |
| D5 | 2026-10-01 | **(보류, D18)** 공식 기록 가져오기는 **서버가 Konami 계정/세션을 보관하지 않는** 방식(브라우저 확장 + 북마클릿 보조). Phase 2 |
| D6 | 2026-10-01 | 스택: Spring Boot + JPA(쓰기/일반 조회) + MyBatis(복잡한 읽기) + MySQL, Next.js + TypeScript. 곡/채보 등록은 ROOT만. 배포는 로컬 검증 후 GitHub Actions → AWS EC2 |
| D7 | 2026-10-02 | **이미지 정책**: 공식 재킷/로고는 허락 없이 쓰지 않는다. 화면은 단색 칸(임시) → 생성 타일로 표시한다. 이미지 칸(`songs.image_url`, 설정 `ui.show_song_images` 기본 꺼짐)은 열어 둔다. 허락을 받으면 켠다 (15장) |
| D8 | 2026-10-02 | **서열표**: SRN+ 전용 서열표를 둔다. 스프레드시트의 **기준 난이도** 열(0.1 단위)로 묶고, 서열표의 달성률은 **사용자 본인 기록**을 (곡, 난이도, 파트)로 연결해 보여준다. 타인이 정리한 CSV의 달성률 일괄 입력은 **ADMIN 권한을 준 1명에게만** 허용하는 기능이고, 일반 기능으로 만들지 않는다 |
| D9 | 2026-10-02 | **달성 표시**: S < SS < FC < EXC(80 / 95 / FC / 100.00) 중 **가장 높은 단계 하나만** 표시한다. FC는 달성률로 알 수 없어 `option_records.is_full_combo`를 추가한다. 달성률 100.00이면 FC도 켠다 (UI 규칙은 `DESIGN-UI.md`) |
| D10 | 2026-10-02 | **곡 데이터 출처**: 공식 사이트 데이터를 통째로 복사하지 않는다. 직접 정리한 스프레드시트(서열표 v1.1)를 기준으로 ROOT가 CSV로 일괄 등록하고, 곡별 출처(`source`)를 기록한다 (15장) |
| D11 | 2026-10-02 | **(보류, D15)** **곡 상세의 노트 성향 그래프**: 단일·고속·이중·삼중·지구력·테크닉 6축(0~100%)을 SRN/SRN+ 별로 보여준다. 축은 데이터로 받는다 (`difficulty_profiles`). 값은 **ROOT와 ADMIN이 직접 입력**한다 |
| D12 | 2026-10-02 | **다크/라이트 두 테마**를 지원한다. 색은 변수로 관리 (`DESIGN-UI.md` 4장) |
| D13 | 2026-10-02 | **곡 마스터 확장**: (1) 시트(465곡·669채보)를 ROOT가 CSV로 일괄 등록해 씨앗으로 쓴다 (2) **(보류, D18)** 가져오기 데이터에 마스터에 없는 곡이 있으면 버리지 않고 대기열(`import_unmatched`)에 모아, **ROOT가 승인한 것만** 곡/채보로 등록한다 (자동 등록 금지) (3) 아티스트·BPM·노트 수 등 메타데이터는 곡 목록 세팅 때 CSV로 넣고 비어 있어도 서비스가 동작한다. 노트 수는 직접 입력한다. `songs.composer`는 두지 않고 게임 표기인 `artist`로 통일하며, 곡명 표기(로마자/가타카나/한국어/별칭)는 `song_titles` 테이블로 둔다. 공식 사이트에서 서버가 곡 목록을 수집하지 않는다 (D10 유지) |
| D14 | 2026-10-02 | **(보류, D15)** **기록 인증 정책 (증빙 사진 + 이의제기)**: (1) 모든 기록을 비교·순위에 포함하고, 화면 상단에서 **전체 / 인증 / 미인증**을 고른다 (2) 기록에 **증빙 사진을 첨부하면 즉시 `인증`** 이다. 사전 승인은 없다 (3) **이의제기가 접수되면** 관리자가 사진을 확인한다. 확인된 기록은 `관리자 확인`으로 표시하고 **이의제기를 더 받지 않는다** (4) 이의가 인정되면 인증이 해제되고 사진은 삭제된다 (5) 증빙 사진은 **업로드 후 30일 보관 뒤 삭제**한다 (이의제기 처리 중이면 처리 완료까지 연장). **로그인한 사용자만 열람**한다(목록은 썸네일, 클릭 시 원본). 모든 사진에 **신고 버튼**을 두고 3건 신고되면 자동 숨김 후 관리자가 확인한다 (6) **자동 인식(비전 API)은 비용 문제로 제외**, 후속 과제로 남긴다 (12장) (7) 초기 대량 입력은 관리자 CSV(`ADMIN_IMPORT`, 미인증)로 처리한다 (8) **이의제기 가능 기간 = 사진 보관 기간(30일)** (9) 스킬 목록·합계에도 전체/인증/미인증 필터를 적용하고, 스킬 요약에 **인증 기록 비율**(예: `18 / 50곡 · 36%`, HOT·그 외 따로)을 표시한다 |
| D15 | 2026-10-02 | **범위 축소(보류)**: (1) **랭킹·유저 간 비교** (2) **증빙 사진·인증·이의제기·신고** (D14) (3) **노트 성향 그래프** (D11)를 MVP에서 **뺀다.** 설계와 시안은 지우지 않고 **18장**에 그대로 보존한다 (4) 기록은 **본인이 직접 입력하고 언제든 수정·삭제**한다. 모든 기록은 같은 신뢰도이고 인증 구분이 없다. 따라서 `option_records.source`·`verification`, `record_evidence`, `record_disputes`, `difficulty_profiles`, 관련 설정·API는 **만들지 않는다** |
| D16 | 2026-10-02 | **사진 입력 구현 결정**: 기록 등록에 **사진으로 입력** 탭을 추가한다 (직접 입력 탭은 그대로). 결과 화면 사진을 올리면 LLM 비전 모델이 읽어 **채보 난이도·레벨, 노트 옵션, 달성률, 곡별 SKILL, Miss 수**를 채우고, 사용자가 확인·수정한 뒤 저장한다. **인증·증빙(D14)은 하지 않는다**: 사진은 인식 직후 지우고 저장하지 않으며, 인식으로 들어온 기록도 직접 입력과 같은 기록이다. 플레이어 이름·ID는 읽지 않고 응답에도 담지 않는다. 곡명도 사진에서 읽어 곡을 찾고, 읽지 못하면 사용자가 직접 입력해 고른다. 자세한 내용은 12.1 |
| D17 | 2026-10-02 | **(보류, D18)** **(범위 정정) 공식 `music/index.html`은 전체 곡 목록이 아니라 `NEW MUSIC`(이벤트별 신곡 132곡)이라 마스터는 시트가 기준이다. 아래 내용은 신곡 보충에만 적용한다.** **곡 마스터 보충 (공식 곡 목록, 본인 계정 1회)**: 시트에 없는 하위 난이도 곡을 채우기 위해, 사용자(운영자) 본인이 본인 계정으로 공식 곡 목록을 한 번 열어 **곡명, 파트, 난이도, 레벨만** CSV로 내려받는다. 아티스트, 재킷, 이벤트 구분은 가져오지 않는다. 스크립트는 서버로 아무것도 보내지 않고 클립보드에만 복사한다. ROOT가 기존 CSV 일괄 등록(D10, D13)으로 올리고 `source`에 출처를 남긴다. **약관 (13)(복제·전재) 위험이 있고 위험 판단은 운영자 본인 몫이다** (8장 약관 확인 결과). 운영사가 요청하면 이 출처의 곡 데이터를 바로 내릴 수 있게 `source`로 구분해 둔다. 일반 사용자용 기능이나 서버의 자동 수집은 만들지 않는다 |
| D18 | 2026-10-02 | **공식 기록 가져오기를 모두 보류하고, 스킬은 상수표 방식으로 계산한다.** (1) 공식 사이트에서 기록·곡 목록을 가져오는 기능(확장 프로그램, 북마클릿, 가져오기 토큰, `official_records`, `import_unmatched`, D5·D17)을 만들지 않는다. 설계 원문은 18.4에 보존한다 (2) 기록은 **본인이 직접 입력하거나 사진으로 입력**(D16)하고, 서버는 Konami와 어떤 통신도 하지 않는다 (3) **스킬은 상수표 방식**으로 계산한다: 서열표의 기준 난이도를 레이팅상수로 바꾸고 달성률 구간(80% / 95%)으로 채보 값을 낸다 (7장). 공식 `레벨 × 달성률 × 20` 공식은 쓰지 않는다. **목록은 SRN+ 하나만** 다루고(ALL·SRN 제외), 속성이 단일인 채보 15개 + 그 외(복합·이중·삼중) 25채보 = **40채보**를 합산한다 (곡당 1채보로 거르지 않는다). HOT은 계산에 쓰지 않는다. **서열표에 기준 난이도가 없는 채보는 레이팅에서 제외하고 기록만 남긴다** (4) **티어는 두 가지**: 채보 티어는 서열표(기준 난이도), 플레이어 티어는 레이팅 합계 구간 (7장). 구간 경계는 미정 (5) 곡 마스터는 ROOT의 CSV 일괄 등록으로만 늘린다 |
| D19 | 2026-10-02 | **로그인은 Google 로그인만 쓴다.** 자체 아이디·비밀번호 가입은 만들지 않는다. 프론트가 Google ID 토큰을 받아 `POST /auth/google`로 보내면 서버가 검증하고(`google_sub`로 사용자 식별) 자체 Access/Refresh 토큰을 발급한다. 비밀번호 저장, 비밀번호 복구, 로그인 실패 잠금은 필요 없어진다. 이메일을 수집한다 (9.6) |
| D20 | 2026-10-02 | **운영 결정 묶음**: (1) access 토큰 만료 **15분** (2) **탈퇴 = 완전 삭제**(사용자, 옵션 기록, refresh 토큰. 감사 로그는 사용자 식별만 지움) (3) 배포는 **같은 서버, 같은 도메인**(리버스 프록시로 `/api`를 백엔드에) → refresh 쿠키는 SameSite=Strict 유지 (4) 스킬 동점은 **먼저 달성한 사람이 위** (7장) (5) 레이팅은 **SRN+ 옵션만**, 다른 옵션 기록은 저장만 한다 (6) 시트는 운영자가 직접 보관하고 저장소에 올리지 않는다 (7) 곡 등록 요청(Phase 3)도 구현한다 (8) 서열표 달성률 열 비교는 SRN+ 기준 (9) 기준 난이도는 **높을수록 어렵다** |
| D21 | 2026-10-02 | **재킷 이미지**: 운영자가 다른 사이트처럼 곡 재킷을 수집해 쓰기로 했다(사용자 결정). 다른 사이트가 쓴다고 해서 권리자 허락이 생기는 것은 아니므로 **위험을 알고 쓰는 선택**이다. 완화책: 설정 `ui.show_song_images`로 언제든 끌 수 있게 하고, 외부 주소 직접 불러오기는 하지 않으며, 삭제 요청이 오면 즉시 내린다. 15장 운영 원칙은 이 결정에 맞춰 고친다 |
| D22 | 2026-10-05 | **곡/채보 관리 권한을 ROOT와 ADMIN 둘 다에게 연다.** (1) 곡/채보 등록·수정·삭제, CSV 일괄 등록, 노트 수·메타데이터 입력, 곡 등록 요청 승인을 ROOT와 ADMIN이 한다 (D6의 "ROOT만" 개정) (2) 역할 변경, 설정 변경, 감사 로그 조회는 ROOT만 유지 (3) ROOT와 ADMIN도 USER 기능을 그대로 쓴다 (RoleHierarchy) (4) ADMIN의 관리 작업은 전부 감사 로그에 남긴다 |
| D23 | 2026-10-05 | **CSV 기능을 만들지 않는다.** 곡/서열표 CSV 일괄 등록·내려받기, 달성률 CSV 일괄 입력(D8의 "지정 1명" 기능, 일반 사용자 대상 확장 포함)은 고려할 것(중복·덮어쓰기·옵션 지정·권한)이 많아 모두 제외한다. (1) 시트(465곡·669채보)는 **1회성 시드 SQL**로 DB에 직접 넣는다. 시드 SQL은 `scripts/seed/generate_seed_sql.py`가 시드 CSV로 만들고, **데이터(CSV·SQL)는 저장소에 올리지 않는다**(D20-6) (2) 이후 곡/채보는 관리 API(D22)로 고친다. 서열표 값의 수정 API는 필요해지면 따로 설계한다 (3) D8·D10·D13의 CSV 관련 부분을 대체한다. 기록은 한 건씩 직접 입력한다 |
| D24 | 2026-10-05 | **달성 단계에 하위 단계 A/B/C를 추가한다 (D9 확장).** (1) 단계는 `C < B < A < S < SS < FC < EXC`. 달성률 구간: C 63.00 미만 / B 63.00~72.99 / A 73.00~79.99 / S 80.00~94.99 / SS 95.00 이상. FC 우선·EXC(100.00) 규칙은 그대로이고 판정 순서는 EXC → FC → SS → S → A → B → C (2) **기록이 있으면 항상 단계가 하나 있다.** 기록이 없는 채보만 단계 표시가 없다 (3) 서열표 묶음 머리의 칩은 EXC/FC/SS/S를 유지하고 **"S 미만" 칩 하나**를 추가한다. A/B/C 채보를 합친 개수이고, **기록 없는 채보(미플레이)는 세지 않는다**. 달성률 0.00 기록도 플레이한 기록이라 센다. 따라서 칩 합계 = 기록 수 (4) 단계는 저장하지 않고 계산한다. A/B/C의 색·글자 표시는 `DESIGN-UI.md` 2장에서 정한다 |
| D25 | 2026-10-05 | **기록은 노트 옵션 SRN+(`SUPER_RANDOM_PLUS`) 하나만 받는다.** D18·D20의 "옵션 기록은 5가지 모두 저장"을 대체한다. (1) 기록 등록·수정은 `SUPER_RANDOM_PLUS`만 허용하고, 요청에서 노트 옵션을 비우면 SRN+로 저장한다. 다른 옵션을 보내면 400 (2) **enum(`NoteOption` 5값)과 DB 컬럼 `note_option`은 그대로 둔다.** 옵션을 다시 늘릴 때 허용 집합(`OptionRecordService.RECORDABLE_OPTIONS`)에 값만 추가하면 되도록 확장성을 남긴 것이다 (3) **"옵션별 최고 기록" API(`GET /difficulties/{id}/my-bests`)와 곡 상세의 "옵션별 5줄"은 만들지 않는다.** 곡 상세의 내 기록은 SRN+ 최고 1줄이고, `GET /records?songDifficultyId=&sort=rate&size=1`로 가져온다 (4) 레이팅·서열표는 이미 SRN+만 쓰므로 계산은 바뀌지 않는다 (`rating.note_option` 설정은 유지) |
| D26 | 2026-10-08 | **유저 목록(플레이어 목록)과 유저 상세를 만든다(2026-10-08 구현). D15의 "랭킹·유저 간 비교 보류"를 일부 푼다.** (1) **공개는 본인이 선택**한다(옵트인, 기본 비공개). 설정 화면에서 켜고 끄며, 끄면 목록과 상세에서 바로 사라진다 (2) 목록에는 **닉네임, 플레이어 티어, 총점**만 보인다. 이메일·역할·Google ID·기록 개수 등은 어디에도 내보내지 않는다 (3) 목록에서 유저를 눌러 **유저 상세**로 들어간다. 상세는 **읽기 전용**이고 그 유저의 레이팅 목록(단일 15 + 복합·이중·삼중 25, 합계, 티어)을 보여 준다. 다른 사용자의 기록은 ADMIN/ROOT도 고치지 않는다는 규칙은 그대로다 (4) **닉네임이 있어야 공개할 수 있다** (5) **로그인한 사용자만** 목록과 상세를 본다 (6) 공개하지 않은 유저, 차단(BLOCKED)된 유저의 상세 요청은 **404**(존재 여부 비노출). 탈퇴하면 행이 지워져 목록에서도 사라진다 (D20) (7) **계속 보류**: 곡별 랭킹, 두 유저를 나란히 비교하는 화면, 인증 필터(D14). 자세한 내용은 18.2 |
| D27 | 2026-10-08 | **서열표 값(기준 난이도·추천도·속성) 수정 API를 만든다 (D23-2 "필요해지면 따로 설계"의 설계).** (1) `PUT /admin/difficulty-tables/{tableId}/entries/{songDifficultyId}` (ROOT·ADMIN). **보낸 값으로 통째로 교체**하고(비우면 미정/값 없음), **표에 그 채보가 없으면 새 줄로 추가**한다(upsert) (2) 값을 고치면 `*_uncertain`(?) 플래그는 모두 해제한다. 화면에서는 `?` 표시를 이미 없앴다 (3) 표가 한 파트만 다루면(`instrument_part`가 있으면) 다른 파트 채보는 400 (4) 변경마다 표의 `revision`을 올리고 `audit_logs`에 남긴다(`TABLE_ENTRY_CREATE`/`TABLE_ENTRY_UPDATE`, 전후 값 포함) (5) 화면은 곡 상세(서열표·곡 목록 어느 쪽에서 들어와도)에서 ROOT·ADMIN에게만 "서열표 값 수정"(표에 없으면 "서열표에 추가") 버튼을 보여 준다 (6) 표에서 줄을 지우는 기능은 아직 만들지 않는다 |
---

## 1. 목적과 범위

### 문제
공식 기록은 곡/난이도별 **최고 달성률만** 남고, 어떤 노트 옵션으로 달성했는지 정보가 없다.
최고보다 낮은 기록은 어디에도 남지 않아서 옵션별 기록을 보려면 직접 저장해야 한다.

### 해결
- 유저가 옵션별 기록을 저장한다. (MVP: **본인이 직접 입력하고 수정·삭제**. 증빙 사진·인증은 보류, 18장)
- 스킬은 서열표의 기준 난이도를 레이팅상수로 쓰는 **상수표 방식**으로 계산한다 (D18, 7장). 공식 사이트 가져오기는 보류 (18.4).
- 곡 + 채보 + 내 SRN+ 최고 기록과, SRN+ 기준 **스킬 목록**을 보여준다. (핵심 화면, D25)

### 범위
| 항목 | 내용 |
|---|---|
| 파트 | GUITAR, BASS |
| 노트 옵션 | NORMAL, RANDOM, SUPER_RANDOM(SRN), RANDOM_PLUS, SUPER_RANDOM_PLUS(SRN+). **기록으로 받는 값은 SRN+ 하나**(D25). 나머지 값은 확장용으로 enum·컬럼에만 남긴다 |
| 달성률 | 0.00 ~ 100.00 (화면에서 100.00은 MAX로 표기) |
| 레이팅 목록 | **SRN+ 하나** (D18, 이후 다른 옵션을 값 추가로 확장 가능). 기록도 SRN+ 하나만 받는다 (D25) |
| 곡 정보 | 곡명, 아티스트, BPM, 노트 수, 버전, 레벨 등 텍스트/숫자 메타데이터. 음원/채보/재킷 이미지/로고는 다루지 않음 (이미지 칸만 열어 둠, D7) |
| 사용자 | 여러 명이 로그인해서 사용 |

### 비범위 (하지 않는 것)
- Konami 계정 정보/세션 수집·보관, 서버의 공식 사이트 자동 로그인/스크래핑, 공식 사이트 기록·곡 목록 가져오기 (보류, D18)
- 음원, 채보, 재킷 이미지, 게임 로고 사용 (허락 없이는 쓰지 않는다. D7)
- 사용자 이미지(증빙 사진 등) 저장 (보류, 18장)
- 곡별 랭킹, 두 유저를 나란히 비교하는 화면 (보류, 18장). 유저 목록·유저 상세는 D26에서 만든다
- 노트 성향 그래프 (보류, 18장)
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
| 공식 기록 | `play_records` | **만들지 않는다** (D18 보류). 새 V1에서 제거 |
| 옵션 기록 | `manual_records` | `option_records`로 이름 변경 (새 V1) |
| 제거 대상 컬럼 | `eagate_session`, `evidence_image_url`, `ocr_extracted_json` | 새 V1에서 제거 (D1) |
| 스킬 값 컬럼 | `play_records.skill_point`, `manual_records.skill_point` | 모두 제거(D3). 스킬은 계산한다 |
| `OptionType` | RANDOM, SUPER_RANDOM, RANDOM_PLUS, SUPER_RANDOM_PLUS | `NORMAL` 추가 (enum은 VARCHAR 저장이라 스키마 변경 없음) |
| 시간 | `LocalDateTime`, JDBC `serverTimezone=Asia/Seoul` | UTC 저장으로 전환 (`Instant`, JDBC 시간대 UTC). 배포 전인 지금이 가장 싸다 |
| 사용자 | username, password_hash, created_at | Google 로그인(D19)으로 변경: google_sub, email, nickname, role, status, updated_at 추가 (비밀번호·잠금 컬럼 없음) |
| 소프트 삭제 | 없음 | `is_deleted` 추가 |
| 인증 | Access/Refresh 토큰 구분 없음 | **아래 9.1 보안 선행 작업 참고** |
| 에러 처리 | 공통 처리 없음 | `@RestControllerAdvice` 추가 |
| API 경로 | `/api/auth/**` | `/api/v1/auth/**` |
| 의존성 | JPA, Security, Validation, Flyway, JJWT, Lombok | MyBatis, springdoc, Testcontainers 추가 (**Boot 4.1.1과 호환되는 버전 확인 후**) |
| 설정 | access 토큰 360000ms(6분), `show-sql` + SQL debug 로그 중복 | access 토큰 900000ms(15분)으로 변경(적용됨, D20), 로그는 한쪽만 |
| `docs/table.sql` | V1보다 오래됨 | **폐기**. 스키마의 기준은 Flyway 마이그레이션 파일 |
| 줄바꿈 | 작업 트리에 CRLF 차이로 보이는 수정 다수 | 루트 `.gitattributes`(`* text=auto eol=lf`)로 정리 |

> **마이그레이션 원칙 (2026-10-02 개정)**: 첫 배포 전까지는 `V1__init_schema.sql` 한 파일을 직접 고치고, 로컬 DB를 비운 뒤(`docker compose down -v`) 다시 적용한다. **첫 배포 이후부터** 적용된 파일은 수정하지 않고 `V2__...sql`부터 추가한다.

---

## 3. 기술 스택

| 영역 | 스택 |
|---|---|
| 백엔드 | Java 17, Spring Boot 4.1.1(Gradle), Spring Web MVC, Spring Security, JJWT, Spring Validation, Spring Data JPA, Flyway, Lombok, MyBatis(추가 예정), springdoc(추가 예정) |
| DB | MySQL 8.x (로컬은 Docker) |
| 프론트 | React, Next.js(App Router), TypeScript, TanStack Query, React Hook Form + Zod, Tailwind CSS |
| 확장 프로그램 | (보류, 18.4) |
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
com.srpfreaks.backend
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
3. 레이팅 목록의 기준은 `scope` 값으로 구분한다. 지금은 `SRN_PLUS` 하나이고, 새 기준은 값 추가로 끝나야 한다.
4. API는 `/api/v1/` 접두사로 버전을 둔다.
5. 확장 가능성이 큰 값은 nullable 컬럼 또는 JSON 컬럼으로 열어둔다. (`option_records.extra_options`, `platform`)
6. 권한은 `Role` enum + **RoleHierarchy**(ROOT > ADMIN > USER).
7. 설정값(레이팅 계수, 토큰 만료, 허용 Origin 등)은 코드에 박지 않는다. 운영 중 바뀌는 값은 `app_settings`, 배포 설정은 환경변수.
8. 새 파트(DRUM 등)는 enum 값 추가 + 데이터 등록으로 가능해야 한다.

---

## 5. 권한

| 역할 | 설명 | 인원 |
|---|---|---|
| ROOT | 서비스 운영자. 역할 변경, 설정 변경, 감사 로그 조회, 모든 권한 | 1명 |
| ADMIN | 곡/채보 관리(D22), 난이도표 설계/수정/보완 | 소수 |
| USER | 기록 입력/조회 | 다수 |

| 기능 | ROOT | ADMIN | USER |
|---|:-:|:-:|:-:|
| 회원가입/로그인 | O | O | O |
| 내 기록 CRUD, 가져오기, 스킬 조회 | O | O | O |
| 곡/채보 조회 | O | O | O |
| 곡/채보 등록·수정·삭제 (D22) | O | O | X |
| 난이도표 조회 | O | O | O |
| 난이도표 생성·수정, 서열표 값(기준 난이도·추천도·속성) 수정과 채보 추가 (D27) | O | O | X |
| 노트 수·메타데이터 입력, 곡 등록 요청 승인 (D22) | O | O | X |
| 유저 역할 변경, 설정(`app_settings`) 변경 | O | X | X |
| 감사 로그 조회 | O | X | X |

- ROOT는 환경변수 `ROOT_EMAIL`의 이메일이 **처음 Google 로그인할 때** 만든다. 코드/DB 시드에 계정 정보를 넣지 않는다.
- ROOT는 1명 유지. API로 ROOT를 새로 지정하는 기능은 만들지 않는다.
- ROOT와 ADMIN도 USER의 기능(본인 기록 입력·수정·삭제, 곡 목록, 서열표, 레이팅)을 그대로 쓴다. RoleHierarchy로 상위 권한이 하위 권한을 포함한다 (D22).
- ADMIN의 곡/채보 관리(등록·수정·삭제)는 모두 `audit_logs`에 남기고, 삭제는 소프트 삭제라 ROOT가 되살릴 수 있다. 역할 변경과 ADMIN 지정은 ROOT만 한다 (권한 상승 방지).
- 본인 기록만 수정/삭제 가능. 소유자 검증은 서비스 계층에서 한다.

---

## 6. 데이터 모델 (목표)

공통 컬럼: `created_at`, `updated_at`, `is_deleted`(소프트 삭제). 시간은 **UTC로 저장**한다.
표기는 목표 스키마이며, 현재와의 차이는 2장 표를 따른다. 배포 전에는 새 `V1`을 직접 고친다 (2장 마이그레이션 원칙).

**이름 규칙 (2026-10-02):** PK 컬럼은 `{테이블 단수형}_id` (`user_id`, `song_id`, `song_difficulty_id`, `option_record_id`, `difficulty_table_id` …), FK는 **참조하는 PK와 같은 이름**이다. 아래 표의 `id`와 `difficulty_id`, `table_id`는 이 규칙으로 읽는다 (`difficulty_id` → `song_difficulty_id`, `table_id` → `difficulty_table_id`). 시간 컬럼은 모두 `DATETIME(6)` UTC이다. 새 `V1`은 `backend/src/main/resources/db/migration/V1__init_schema.sql`에 이 규칙으로 썼다(2026-10-02, 이 장 표와 같은 구조. `difficulty_tables`·`difficulty_table_entries`·`player_tiers`·`audit_logs` 포함, 티어 20행과 `app_settings` 기본값 시드 포함. `skill_snapshots`는 Phase 2라 아직 없다). 기록은 소프트 삭제하지 않고 완전 삭제한다(D20), `is_deleted`는 `songs`·`song_difficulties`에만 둔다.

### users
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | BIGINT PK AI | |
| google_sub | VARCHAR(64) | UNIQUE. Google 계정 고유 ID (로그인 식별자, D19) |
| email | VARCHAR(255) | Google 이메일. 표시와 연락용 (UNIQUE) |
| nickname | VARCHAR(30) | 표시용. NULL 허용(가입 직후는 NULL). 규칙은 아래 "닉네임 규칙" |
| role | VARCHAR(20) | ROOT / ADMIN / USER, 기본 USER |
| status | VARCHAR(20) | ACTIVE / BLOCKED (ADMIN이 막음). 탈퇴는 행을 지운다 (D20) |
| profile_public | BOOLEAN | 유저 목록·상세에 공개할지(D26). **기본 FALSE**. 닉네임이 NULL이면 TRUE로 바꿀 수 없다 |

**닉네임 규칙** (서버 `User.normalizeNickname`과 프론트 `lib/nickname.ts`가 같은 규칙을 쓴다)
- 길이는 **2~12자**이고 1자는 1로 센다(코드 포인트 기준. 히라가나·가타카나·한자·영문 모두 1자, 폭은 따지지 않는다). 12자 제한은 코드에서 검사하고 DB 컬럼은 30으로 둔다(스키마 변경 없이 제한을 바꿀 수 있게).
- 허용: 영문(A-Z a-z), 숫자, 히라가나, 가타카나, 한자와 기호 `ー` `・` `々` `〆` `〇` `_` `-`. **한글과 공백은 허용하지 않는다.**
- 저장 전에 NFKC로 정규화한다(반각 가타카나 → 전각, 전각 영문·숫자 → 반각). 앞뒤 공백은 지우고, 빈 값은 NULL(닉네임 없음)로 저장한다.
- 중복은 **허용**한다. 유저 목록(D26)에서도 `user_id`로 구분하므로 유니크로 바꾸지 않는다(2026-10-08 확정).
- 가입 직후 닉네임은 NULL이다. 로그인 후 설정을 **안내만** 하고 다른 화면을 막지 않는다. 닉네임이 없으면 화면에는 이메일을 보인다.
- 닉네임 변경 API(`PATCH /users/me`)와 설정 화면은 아직 없다.

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
| artist | VARCHAR(255) NULL | 게임이 표기하는 아티스트 (작곡가 컬럼은 두지 않는다) |
| added_version | VARCHAR(30) | 곡이 추가된 게임 버전. 표시·분류용 (D18부터 HOT 판정에는 쓰지 않는다) |
| title_folder | VARCHAR(5) NULL | 게임 안의 타이틀 폴더 위치(초성). 목록 정렬/묶음용 |
| bpm_min / bpm_max | INT NULL | BPM. 고정 BPM이면 두 값이 같다 |
| image_url | VARCHAR(500) NULL | **기본 NULL.** 이미지 칸 확장용 (D7). 값이 있어도 설정이 꺼져 있으면 쓰지 않는다 |
| source | VARCHAR(100) NULL | 곡 정보의 출처 (예: `own_sheet_v1.1`). 15장 |
| created_by | BIGINT FK(users) | ROOT 또는 ADMIN |

- 중복 검사(title + artist, 공백/대소문자 정규화)는 서비스 계층에서 한다. (소프트 삭제 때문에 DB UNIQUE만으로는 부족)

### song_titles (곡명 표기·별칭, D13)
검색(한국어로 "라면 메시아"), 가져오기 매칭, 시트 표기 차이를 이어 주는 테이블. `songs.title`은 원제 하나만 둔다.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | BIGINT PK AI | |
| song_id | BIGINT FK | |
| kind | VARCHAR(20) | ROMAJI / KANA / KO / ALIAS (확장 가능) |
| title | VARCHAR(255) | 표기 원문 |
| normalized_title | VARCHAR(255) | NFKC, 공백/줄바꿈 제거, 소문자. **매칭은 이 값으로 한다** |

- UNIQUE(song_id, kind, normalized_title), INDEX(normalized_title)
- 가져오기 때 곡명이 안 맞으면 `songs.title`과 `song_titles`의 정규화 값을 모두 비교한다.

### song_difficulties (채보)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | BIGINT PK AI | |
| song_id | BIGINT FK | |
| instrument_part | VARCHAR(10) | GUITAR / BASS |
| difficulty_type | VARCHAR(20) | BASIC / ADVANCED / EXTREME / MASTER |
| level | DECIMAL(3,2) | 예: 5.50 |

- 추가 컬럼: `note_count INT NULL` (노트 수는 채보마다 다르다. **직접 입력**: 곡 수정 API 또는 관리자 화면에서 입력. 비어 있어도 된다)
- UNIQUE(song_id, instrument_part, difficulty_type)
- 레벨은 현재 값만 저장한다. 버전별 레벨 이력이 필요해지면 컬럼/테이블을 추가한다.

> `official_records`는 D18에서 보류했다 (원문은 18.4). 지금은 만들지 않는다.

### option_records (옵션 기록, 기존 `manual_records`)
유저가 입력한 옵션별 기록. 플레이할 때마다 **계속 쌓인다.**

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | BIGINT PK AI | |
| user_id | BIGINT FK | |
| difficulty_id | BIGINT FK | |
| note_option | VARCHAR(20) | 값 종류는 NORMAL / RANDOM / SUPER_RANDOM / RANDOM_PLUS / SUPER_RANDOM_PLUS이지만 **지금은 SUPER_RANDOM_PLUS만 저장한다**(D25, 서비스에서 검증. 확장 대비로 컬럼은 유지) |
| achievement_rate | DECIMAL(5,2) | CHECK 0.00 ~ 100.00 |
| played_at | DATETIME(6) | UTC. 입력하지 않으면 저장 시각 |
| platform | VARCHAR(10) NULL | ARCADE / KONASTE (확장용) |
| memo | VARCHAR(255) NULL | |
| extra_options | JSON NULL | 하이스피드 등 이후 추가될 옵션용 |
| is_full_combo | BOOLEAN | 풀콤보(0 miss) 여부. 기본 false, 달성률 100.00이면 true로 저장. **달성 표시(D9)에 사용** |

- 인덱스
  - `(user_id, difficulty_id, note_option, achievement_rate DESC)` : 내 옵션별 최고 기록, 스킬 계산
  - `(user_id, played_at DESC)` : 최근 기록 목록
- 달성률 검증은 **3중**: 프론트(Zod) → 백엔드(Validation) → DB(CHECK, MySQL 8.0.16+)
- **달성 표시 (D9, D24)**: 판정 순서 EXC(100.00) → FC(`is_full_combo`) → SS(95.00↑) → S(80.00↑) → A(73.00↑) → B(63.00↑) → C(63.00 미만). 가장 높은 단계 하나만 보여준다. 기록이 있으면 항상 단계가 있다. 단계는 저장하지 않고 **계산**한다.

### player_tiers (플레이어 티어 구간, D18)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| player_tier_id | BIGINT PK AI | |
| tier_key | VARCHAR(30) | `WHITE`, `ORANGE_GRADIENT` … UNIQUE |
| display_name | VARCHAR(30) | 화면 표기 (예: White, Orange Gradient) |
| min_score | INT | 이 값 **이상**이면 해당 티어 (합계의 정수부 기준). UNIQUE |
| sort_order | INT | |

- 초기값은 7장 표 (0, 500, 1,000 … 9,500). 합계의 정수부보다 `min_score`가 작거나 같은 행 중 가장 큰 것이 티어다. 값은 ROOT가 설정으로 고친다 (감사 로그).

### app_settings
| 컬럼 | 타입 | 비고 |
|---|---|---|
| setting_key | VARCHAR(50) PK | 예: `rating.*`(레이팅 계수, 목록 개수), `ui.show_song_images`(기본 false) |
| setting_value | VARCHAR(500) | 예: `GALAXY WAVE DELTA` (여러 개면 콤마 구분) |
| updated_by / updated_at | | ROOT만 변경, 감사 로그 기록 |

### Phase 2 이후 테이블
| 테이블 | 용도 |
|---|---|
| skill_snapshots | 스킬 성장 추이. user_id, scope, single_total, other_total, total, calculated_at |
| song_aliases | `song_titles`로 대체 (별도 테이블을 두지 않는다) |
| difficulty_tables / difficulty_table_entries | ADMIN이 관리하는 난이도표. **SRN+ 서열표(D8)** 가 첫 사례. tables: id, name, part(NULL=둘 다), **note_option**, status, revision / entries: table_id, difficulty_id, **tier_label**(기준 난이도, 예 `5.8`), tier_order, **recommend**(상/중/하 NULL), **pattern_type**(단일/복합/이중/삼중/**레이팅 제외**, NULL도 제외로 취급), **uncertain**(스프레드시트의 `?` 표시), comment. 기준 난이도가 없는 채보는 tier_label NULL = "미정" |
| audit_logs | ROOT/ADMIN 관리 작업 기록 (actor_id, action, target_type, target_id, detail JSON) |

---

## 7. 스킬 계산 규칙 (D18, 상수표 방식)

### 확정된 규칙
- **레이팅상수 R**: 채보의 서열표 기준 난이도(T, `difficulty_table_entries.tier_label`)에서 구한다.
  - T > 6.0 이면 `R = 5 × T − 15`, 아니면 `R = 10 × T − 45` (T=7.0 → 20, 6.5 → 17.5, 6.0 → 15, 5.9 → 14, 5.0 → 5)
- **채보 값 V** (A = 달성률 0.00~100.00): `V = R × min(A, 80) / 100 + 3.2 × min(max(A − 80, 0), 15) / 15`
  - 80%까지는 선형, 80~95%는 최대 +3.2까지 더해지고, 95% 이상은 더 오르지 않는다.
  - 화면에 보이는 **점수 = V × 20**.
- **레벨은 계산에 쓰지 않는다.** 레벨은 표시용이다. 공식 `레벨 × 달성률 × 20`은 쓰지 않는다.
- **기준 난이도가 없는 채보(미정)는 값을 계산하지 않는다.** 레이팅 목록에서 빠지고 화면에는 `미정`으로 표시한다. 시드 기준 224채보가 해당한다.
- 계수(80, 95, 3.2, 20, 기준점 6.0)는 `app_settings`의 `rating.*` 설정으로 두고, 수식의 모양은 코드에 둔다.
- 값은 **저장하지 않고 계산**한다 (D3).
- 이 수식은 스프레드시트 제작자가 만든 지표다. 사용 허락은 받았다 (16장).

### 목록 구조 (D18)
- **목록은 SRN+ 하나**다. ALL·SRN scope는 만들지 않는다. 기록 자체가 `SUPER_RANDOM_PLUS`만 저장된다(D25). 레이팅은 그 기록을 쓴다.
- 서열표의 **속성(`pattern_type`)** 으로 나눈다: **단일 15 + 그 외(복합·이중·삼중) 25 = 40채보**. 각 그룹에서 V가 높은 순으로 뽑아 합산한다. **곡당 1채보로 거르지 않는다.** 같은 곡의 다른 채보(기타/베이스, 난이도)도 각각 센다 (패턴별 선택). 개수(15, 25)는 `app_settings`(`rating.list_single`, `rating.list_other`)로 둔다.
- HOT(최신 버전 구분)은 계산에 쓰지 않는다. `skill.hot_versions` 설정도 두지 않는다.
- **레이팅 대상 = 서열표에 기준 난이도가 있는 채보.** 서열표에 없거나 기준 난이도가 없는 채보는 레이팅에서 제외하고 기록만 남긴다 (화면에는 `미정`/`레이팅 제외`).
- 속성 값 뒤의 `?`(`단일?` 등)는 `uncertain`일 뿐 값은 `?`를 뗀 속성으로 센다.
- **속성이 `레이팅 제외`(또는 NULL)인 채보는 어느 그룹에도 넣지 않는다.** 시드의 속성이 빈 274채보는 `pattern_type = 레이팅 제외`로 등록한다. 그중 기준 난이도가 있는 57채보도 제외된다. 레이팅 대상은 **기준 난이도와 속성이 모두 있는 채보**(시드 392채보)다.
- `pattern_type` 값: `단일` / `복합` / `이중` / `삼중` / `레이팅 제외`. 새 속성은 값 추가로 확장한다 (그 외 그룹에 넣을지 제외할지는 설정으로 정한다).
- Guitar와 Bass는 하나의 목록.

### 티어 (두 가지)
- **채보 티어**: 서열표의 기준 난이도 묶음 (D8). 달성 표시(S/SS/FC/EXC)와 별개다.
- **플레이어 티어**: 레이팅 목록(40채보)의 **점수 합계(V × 20의 합)** 구간으로 나눈다. 판정은 합계의 **정수부(소수 버림)** 기준이고, 각 구간의 시작 값(`min_score`) **이상**이면 그 티어다 (0, 500, 1,000 …).

| 합계 | 티어 (화면 표기) | 키 |
|---|---|---|
| 0 ~ 499 | White | WHITE |
| 500 ~ 999 | White Gradient | WHITE_GRADIENT |
| 1,000 ~ 1,499 | Orange | ORANGE |
| 1,500 ~ 1,999 | Orange Gradient | ORANGE_GRADIENT |
| 2,000 ~ 2,499 | Yellow | YELLOW |
| 2,500 ~ 2,999 | Yellow Gradient | YELLOW_GRADIENT |
| 3,000 ~ 3,499 | Green | GREEN |
| 3,500 ~ 3,999 | Green Gradient | GREEN_GRADIENT |
| 4,000 ~ 4,499 | Blue | BLUE |
| 4,500 ~ 4,999 | Blue Gradient | BLUE_GRADIENT |
| 5,000 ~ 5,499 | Purple | PURPLE |
| 5,500 ~ 5,999 | Purple Gradient | PURPLE_GRADIENT |
| 6,000 ~ 6,499 | Red | RED |
| 6,500 ~ 6,999 | Red Gradient | RED_GRADIENT |
| 7,000 ~ 7,499 | Bronze | BRONZE |
| 7,500 ~ 7,999 | Silver | SILVER |
| 8,000 ~ 8,499 | Gold | GOLD |
| 8,500 ~ 8,999 | Rainbow | RAINBOW |
| 9,000 ~ 9,499 | Rainbow Gradient | RAINBOW_GRADIENT |
| 9,500 이상 | 하수봉 | HASUBONG |

- 화면 표기는 영문 색 이름이고(`Gradient`는 그라데이션 티어), 하수봉만 한글 그대로 쓴다. 운영자가 쓰는 약어(흰·주·노·초·파·보·빨·동·은·금)는 대화용이며 `display_name`에는 저장하지 않는다. 색과 테두리 효과(동 이상은 2px 그라데이션 테두리와 글로우)는 `DESIGN-UI.md` 5장과 시안 보드 "플레이어 티어"에서 정한다.
- 구간은 **테이블(`player_tiers`)** 에 두어서 코드 변경 없이 바꾼다 (6장).
- 티어는 저장하지 않고 합계로 계산한다.

### 계산 순서 (MyBatis 읽기 쿼리)
1. `SUPER_RANDOM_PLUS` 기록만 모아 **채보별 최고 달성률**을 구한다.
2. 기준 난이도가 있는 채보만 남기고 R, V를 계산한다.
3. 속성이 단일인 그룹에서 상위 15개, 그 외 그룹에서 상위 25개를 뽑는다. (곡당 1채보를 유지하면 먼저 `ROW_NUMBER() OVER (PARTITION BY song_id ORDER BY V DESC)`로 거른다. 미정)
4. 40개의 값을 합산하고 플레이어 티어를 정한다.

### 구현 결정 (`GET /skills/me`)
- **레이팅 서열표**: `rating.note_option`과 같은 기준 옵션의 **ACTIVE 서열표 중 id가 가장 작은 것**을 쓴다. 그런 표가 없으면 빈 목록(합계 0)이다.
- **쿼리(MyBatis `SkillMapper`)**: 사용자 + 노트 옵션으로 좁혀 채보별 최고 달성률과 FC 여부(하나라도 FC면 true)를 구하고, 서열표·곡을 붙인다. 기준 난이도 없음, 속성 없음, 속성 `레이팅 제외`, 삭제된 곡·채보는 쿼리에서 뺀다. 수식과 상위 N 선택은 서비스(Java)가 한다 (수식의 모양을 코드 한 곳에 두기 위해).
- **계산**: BigDecimal. 점수(V×20)는 반올림하지 않고 합산하며(D20), 응답의 점수와 합계만 소수 둘째 자리(HALF_UP)로 반올림해 내보낸다. 그래서 항목 점수의 표시값을 더한 값과 합계가 0.01 어긋날 수 있다. 티어는 반올림 전 합계의 정수부로 정한다 (표시가 500.00이어도 실제 합계가 499.996이면 500 구간이 아니다).
- 목록이 모자라면(후보가 15개·25개보다 적으면) 있는 만큼만 합산한다. 그룹은 `단일` / 그 외(복합·이중·삼중)이고, `레이팅 제외`·NULL은 어느 그룹에도 들어가지 않는다.
- 응답: 그룹별 항목(순위, 곡·채보, 기준 난이도 T, 레이팅상수 R, 값 V(소수 4자리), 점수, 달성률, FC, 달성 단계), 그룹별 점수, 합계, 플레이어 티어(다음 티어 이름·시작 점수 포함, 최고 티어면 null).
- 설정이 없거나 숫자가 아니면 기본값으로 넘어가지 않고 서버 오류로 알린다(틀린 점수를 내지 않기 위해).

### 검증
공식 값과 대조할 수 없으므로 **직접 계산한 예시값으로 테스트**한다 (경계: 달성률 0 / 80 / 95 / 100, 기준 난이도 6.0 전후).
- 기준 난이도 6.0(R=15), A=80 → V=12.0 (점수 240)
- 기준 난이도 6.0(R=15), A=95 → V=15.2 (점수 304). A=100도 15.2 (95% 이상은 같다)
- 기준 난이도 5.0(R=5), A=90 → V=5×0.8 + 3.2×10/15 = 6.1333…
- 기준 난이도 7.0(R=20), A=70 → V=14.0
- 소수 처리: **계산은 소수 그대로, 표시는 둘째 자리까지, 티어 판정은 소수 버림**(위 규칙 그대로, D20 확정). 로컬 테스트 후 조정할 수 있다.
- 같은 목록 안에서 V가 같은 채보의 순서(구현 결정): **채보 id가 작은 쪽이 먼저**다. 요청마다 순서가 바뀌지 않게 하는 고정 기준이며, 어느 쪽이 뽑히는지가 갈리는 경계(N번째)에서도 같은 기준을 쓴다. 이 기준은 합계에는 영향이 없다(같은 V는 같은 점수).
- 사용자 사이의 동점(랭킹, 2026-10-08 확정): **먼저 달성한 사람이 위.** 레이팅 40채보 각각의 "달성 시각"(그 채보의 최고 달성률을 **처음** 기록한 `played_at`, 같은 점수를 여러 번 냈으면 가장 이른 것) 중 **가장 늦은 시각**이 이른 쪽이 위다(마지막 한 곡을 채운 때가 빠른 사람). 시각이 같거나 비교할 수 없으면 `user_id` 오름차순. 유저 목록(18.2)에서 쓴다. 기록을 수정해서 같은 점수를 다시 내면 처음 낸 시각이 유지된다.
- 사진 입력이 읽은 곡별 SKILL 값(공식 방식)은 이제 계산에 쓰지 않는다. 인식 결과 교차검증에는 공식 식(`레벨 × 달성률 × 20`)을 그대로 쓸 수 있다 (12.1).

---

## 8. (보류됨 → 18.4)

공식 기록 가져오기(Phase 2)는 D18에서 **보류**했다. 설계 원문은 **18.4**에 그대로 보존한다. 지금은 구현하지 않는다 (서버·확장·스키마·API 모두).

---

## 9. 보안 설계

### 9.1 인증
- **로그인은 Google 로그인만(D19).** 서버는 Google ID 토큰의 서명, `aud`(우리 클라이언트 ID), `iss`, 만료를 검증하고 `google_sub`로 사용자를 찾거나 만든다. 비밀번호를 저장하지 않는다.
- **Access Token (JWT)**: 15분(D20). 프론트 **메모리**에만 보관, `Authorization: Bearer`.
- **Refresh Token**: 길게(예: 14일). **httpOnly + Secure + SameSite=Strict 쿠키**. DB에는 **해시만** 저장.
- **Refresh Rotation**: 재발급마다 새 토큰 발급, 기존 토큰 폐기. 폐기된 토큰이 다시 오면 같은 `family_id` 전체를 폐기한다.
- JWT 서명 키는 환경변수. 알고리즘을 고정한다.

**구현 결정 (2026-10, 구글 로그인·JWT 구현 기준)**
- **Access Token**: HS256 고정 JWT. 클레임은 `sub`(사용자 ID), `typ=access`, `iss`, 만료뿐이고 **역할과 차단 여부는 넣지 않는다.** 요청마다 DB에서 읽으므로 역할 변경·차단이 이미 발급된 토큰에도 바로 반영된다. 키는 32바이트 미만이면 서버가 시작하지 않는다.
- **Refresh Token은 JWT가 아니다.** 32바이트 난수(Base64url) 불투명 문자열이고 DB에는 SHA-256 해시(CHAR(64))만 저장한다. Access Token과 형식이 달라 refresh 토큰으로 API를 호출할 수 없다. (`typ` 검사는 이중 방어)
- **재사용 탐지**: 폐기된 토큰이 오면 같은 family 전체를 폐기한다. 조회는 `PESSIMISTIC_WRITE`로 동시 재발급을 직렬화하고, 폐기가 롤백되지 않도록 `noRollbackFor = ApiException`을 쓴다.
- **쿠키**: `refresh_token`, httpOnly, Secure(`COOKIE_SECURE`, 로컬 http에서만 false), SameSite=Strict, Path=`/api/v1/auth`. 재발급·로그아웃은 추가로 `Origin` 헤더가 허용 목록에 있어야 한다.
- **인증 실패 응답**: 구글 토큰 오류, 만료·재사용된 refresh, 차단된 계정은 모두 `AUTH_FAILED` 하나로 응답한다.
- **ROOT 부트스트랩**: `ROOT_EMAIL`과 같은 이메일(대소문자 무시)로 **처음 가입하는 계정만**, 그리고 ROOT가 아직 없을 때만 ROOT가 된다. 기존 계정은 승격하지 않고, 같은 이메일이라도 `google_sub`가 다르면 로그인을 거부한다(계정 탈취 방지).
- **공개 경로**: `POST /api/v1/auth/google|refresh|logout` 뿐이다. `/api/v1/**`는 인증 필요, 나머지(`/error`, 문서 경로 포함)는 모두 막는다. springdoc을 쓰려면 개발 환경에서만 열도록 따로 설정해야 한다.
- **Rate Limit**: `/api/v1/auth/**`에 IP별 1분 10회(`app.rate-limit.auth-per-minute`), 서버 메모리 방식(EC2 1대 기준. 서버를 늘리면 공유 저장소 필요).
- **보안 헤더**: CSP(`default-src 'none'; frame-ancestors 'none'`), Referrer-Policy, Permissions-Policy, X-Frame-Options, Cache-Control(no-store), HSTS(https 요청).
- **회원 탈퇴 (구현됨, 로컬 검증 전)**: `DELETE /users/me` → 204. `users` 행 하나만 지우고 나머지는 FK가 처리한다(기록·refresh 토큰은 CASCADE, 감사 로그·곡 등록자·설정 수정자는 SET NULL). 응답의 Set-Cookie로 refresh 쿠키도 지운다. ROOT도 막지 않는다(같은 ROOT_EMAIL로 다시 가입하면 ROOT가 된다). 화면은 `/settings/withdraw`(되돌릴 수 없다는 안내 + 확인 체크 후 버튼 활성).
- **아직 안 한 것**: 만료·폐기된 refresh_tokens 정리 작업(배치).

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
- 자체 비밀번호가 없어 로그인 실패 잠금은 두지 않는다. 대신 Google 토큰 검증 실패는 이유를 구분하지 않고 같은 메시지로 응답한다. 막아야 할 사용자는 ADMIN이 `BLOCKED`로 바꾼다.
- **CORS**: 허용 Origin을 환경변수 화이트리스트로. `*` 금지.
- **CSRF**: access token은 헤더 방식이라 영향이 작고, refresh 쿠키는 SameSite=Strict + POST 전용으로 제한.
- 보안 헤더: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`(배포 시), CSP(프론트).

### 9.5 비밀 관리
- DB 비밀번호(`DB_PASSWORD`), JWT 키(`JWT_SECRET`), Google 클라이언트 ID(`GOOGLE_CLIENT_ID`), `ROOT_EMAIL`, Claude API 키는 **환경변수**. 저장소에 올리지 않는다.
- `.env`, `application-local.yml` 등은 `.gitignore`에 등록한다.
- 로그에 토큰, 비밀번호, 개인정보를 남기지 않는다.
- 배포 시 시크릿은 GitHub Actions Secrets / EC2 환경변수로 주입한다.

### 9.6 개인정보
- 수집 항목: Google 계정 고유 ID, 이메일, 닉네임(선택). 비밀번호는 받지 않는다.
- 가입 화면에 수집 항목과 목적을 안내한다. **탈퇴하면 사용자와 모든 기록, refresh 토큰을 완전히 삭제한다** (D20). 감사 로그는 남기되 사용자 식별 값을 지운다.
- **유저 목록 공개(D26)는 본인이 켠 경우에만** 닉네임·티어·총점·레이팅 목록이 다른 로그인 사용자에게 보인다. 기본은 비공개이고 언제든 끌 수 있다. 가입 화면과 설정 화면에서 "공개하면 무엇이 보이는지"를 안내한다.

---

## 10. API 초안 (`/api/v1`)

에러 형식: `{ code, message, timestamp, path, fieldErrors[] }`. 목록은 **페이지네이션** 필수(`page`, `size` 상한, `sort` 화이트리스트).

| 영역 | 메서드 / 경로 | 권한 |
|---|---|---|
| 인증 | POST `/auth/google`(Google ID 토큰 교환), `/auth/refresh`, `/auth/logout` | 공개/인증 |
| 내 정보 | GET/PATCH/DELETE `/users/me` (DELETE = 탈퇴, 완전 삭제) | USER+ |
| 곡 | GET `/songs`(검색), GET `/songs/{id}` | USER+ |
| 곡/채보 관리 | POST `/songs`, PUT/DELETE `/songs/{id}`, POST `/songs/{id}/difficulties`, PUT/DELETE `/difficulties/{id}` (PUT은 보낸 값으로 교체, 삭제는 소프트 삭제, 모든 변경은 `audit_logs`) | ROOT·ADMIN |
| 옵션 기록 | POST `/records`, GET `/records?noteOption=&songDifficultyId=&sort=recent\|rate`, GET/PUT/DELETE `/records/{id}` (PUT은 보낸 값으로 교체, 채보는 변경 불가, 타인 기록은 404, 플레이 시각은 현재+5분까지, 삭제는 완전 삭제) | USER+ (본인) |
| 내 최고 기록 | (별도 API 없음, D25) `GET /records?songDifficultyId=&sort=rate&size=1` | USER+ (본인) |
| 유저 목록 (D26) | GET `/players?sort=score&page=&size=` (공개한 ACTIVE 유저만. 항목 = 닉네임·티어·총점·순위. 총점 내림차순, 동점은 7장 규칙(먼저 달성한 사람이 위). 이메일 등은 응답에 없음) | USER+ |
| 유저 상세 (D26) | GET `/players/{userId}` (공개한 ACTIVE 유저의 레이팅 목록 40채보 + 합계 + 티어, 읽기 전용. 비공개·차단·없는 유저는 모두 404) | USER+ |
| 공개 설정 (D26) | `PATCH /users/me/visibility` body `{"profilePublic": true|false}` (닉네임이 없으면 켤 수 없고 400. `PATCH /users/me`와 따로 둔 이유: 그 요청은 닉네임이 비면 "닉네임 삭제"라 공개 값만 보내면 닉네임이 지워질 수 있다.) 응답은 `UserResponse`(`profilePublic` 포함). 닉네임을 지우면 공개도 함께 꺼진다 | USER+ (본인) |
| 스킬 목록 | GET `/skills/me` (SRN+ 40곡 + 합계 + 플레이어 티어. 이후 scope 파라미터 확장 가능) | USER+ |
| 사진 인식 | POST `/records/recognize` (multipart, 인식 결과만 반환하고 저장하지 않는다. 일일 한도) | USER+ |
| 스킬 추이 | GET `/skills/me/history` (Phase 2) | USER+ |
| 난이도표 | GET `/difficulty-tables` / POST·PATCH | USER+ / ADMIN+ |
| 서열표 | GET `/difficulty-tables/{id}/entries?mine=true&part=&recommend=&pattern=&page=&size=` (기준 난이도 묶음 단위 페이지(기본 10, 최대 20), 묶음마다 칩 개수(EXC/FC/SS/S/S 미만)·평균(0% 미포함/포함 둘 다), 항목마다 본인 최고 기록과 단계. 쿼리 2번 고정: 항목 fetch join + 본인 최고 기록 group by. 본인 기록은 표의 기준 옵션(SRN+)만, 채보의 최고 달성률과 FC 여부(하나라도 FC면 FC)로 계산) | USER+ |
| 곡 상세 | GET `/songs/{id}` (곡 정보 + 채보) | USER+ |
| 곡 목록 폴더 | GET `/songs/chart-folders` (전체 곡 수·채보 수, 버전 목록, 0.5 단위 레벨 폴더별 칩 개수·평균(0% 미포함/포함 둘 다). 채보가 없는 폴더는 없다. 쿼리: 채보+곡 fetch join 1번 + 본인 SRN+ 최고 기록 group by 1번) | USER+ |
| 곡 목록 채보 | GET `/songs/charts?folder=&q=&part=&difficulty=&version=&page=&size=` (채보 단위 페이지(기본 20, 최대 50). `folder`는 폴더 시작 레벨이고 0.5 단위가 아니면 400, `difficulty`는 쉼표로 여러 개, 정렬은 레벨 높은 순 → 곡명 → id. 항목마다 본인 SRN+ 최고 기록과 단계. 곡 검색은 `/songs`와 같은 조건(곡명·아티스트·정규화 표기). 속성은 담지 않는다) | USER+ |
| 서열표 목록 | GET `/difficulty-tables` | USER+ |
| 서열표 값 수정·채보 추가 (D27) | PUT `/admin/difficulty-tables/{tableId}/entries/{songDifficultyId}` (본문 `tierLabel`(null=미정), `recommend`(상/중/하/null), `pattern`(단일/복합/이중/삼중/레이팅 제외/null). 보낸 값으로 교체, 표에 없으면 추가, `?` 해제, 표 revision +1, 감사 로그) | ROOT·ADMIN |
| 서열표 만들기 | POST `/admin/difficulty-tables` (이름, 파트(선택), 기준 옵션) | ROOT·ADMIN |
| 설정 | GET/PATCH `/admin/settings` | ROOT |
| 역할 | PATCH `/admin/users/{id}/role` | ROOT |
| 감사 로그 | GET `/admin/audit-logs` | ROOT |

- Swagger(springdoc)로 문서 자동 생성. 운영 환경에서는 노출 제한.
- 프론트 타입은 OpenAPI 스펙에서 생성하는 방식을 검토한다. (TypeScript 학습 부담 완화)

---

## 11. 화면 (모바일 우선)

아케이드 옆에서 폰으로 바로 입력하는 상황을 기준으로 **모바일 우선**으로 설계한다. 다크/라이트 두 테마를 지원한다.
화면의 시각 규칙과 시안은 **`docs/DESIGN-UI.md`** 를 따른다.

1. 로그인 / 회원가입
2. **빠른 기록 입력**: 곡 검색 → 파트/난이도 → 옵션 → 달성률. 직전 옵션/파트를 기본값으로 유지
3. 내 기록 목록: 파트, 옵션, 기간 필터 + 정렬 + 페이지네이션
4. **곡 상세**: 재킷 칸, 곡명, 작곡가, BPM, 노트 수, 버전, **채보별 레벨 정보**, 내 SRN+ 최고 기록 1줄 (`DESIGN-UI.md` 6장, D25). 노트 성향 그래프는 보류 (18장)
5. **레이팅 목록**: SRN+. 단일 15 + 그 외 25, 합계, 플레이어 티어
6. 내 통계, 스킬 추이 (Phase 2)
7. (보류) 공식 기록 가져오기 / 확장 연동 (18.4)
8. **서열표** (SRN+): 기준 난이도 묶음, 본인 기록 연결, 달성 표시(S/SS/FC/EXC), 카드형(모바일)/표형(데스크톱) (`DESIGN-UI.md` 2~3장)
9. **유저 목록 / 유저 상세** (D26): 공개한 유저의 닉네임·티어·총점 목록, 눌러서 그 유저의 레이팅 목록(읽기 전용). 설정에서 공개 여부를 고른다
10. 관리: 곡/채보 등록(ROOT·ADMIN), 설정(ROOT), 난이도표 편집(ROOT·ADMIN), 유저 역할(ROOT)

---

## 12. 기록 등록과 수정 (D15)

- 기록은 **본인이 직접 입력**한다 (곡·채보 → 달성률 → 풀콤보 → 날짜·메모. 노트 옵션은 SRN+로 고정, D25). 달성 표시(S/SS/FC/EXC)는 자동 계산한다.
- **본인 기록만** 등록·수정·삭제할 수 있다. 수정은 모든 항목이 가능하고 제한이 없다. 수정하면 목록·스킬·서열표에 바로 반영된다. ADMIN/ROOT도 다른 사용자의 기록은 고치지 않는다.
- 같은 곡·채보·옵션에 기록이 **계속 쌓인다**. 곡 상세·수정 창에서 이 곡의 내 기록 목록(옵션, 달성률, 단계, 날짜)을 보여 준다.
- 모든 기록은 같은 취급이다. 인증 / 미인증 구분, 인증 필터, 인증 비율은 없다.
- 메모는 본인에게만 보인다 (공개하는 기능이 생기면 비속어 필터를 같이 넣는다, 18장).
- 서버 검증은 그대로다: 달성률 3중 검증(프론트 Zod, 백엔드 Validation, DB CHECK), 본인 기록만 접근(소유자 검사).

### 12.1 사진으로 입력 (D16)

기록 등록 시트 맨 위에 **사진으로 입력 / 직접 입력** 탭이 있다. 사진 입력은 입력 칸을 채워 주는 보조 수단이고, 저장되는 기록은 직접 입력과 같다 (`input_type` 같은 구분 열을 두지 않는다).

흐름
1. 사용자가 결과 화면 사진을 고른다. 브라우저가 긴 변 약 1,024px로 줄이고 위치 정보(EXIF)를 지운다.
2. `POST /records/recognize` (multipart, 로그인한 사용자). 서버가 비전 모델을 한 번 호출하고 JSON만 돌려준다. **사진은 디스크·DB·로그 어디에도 남기지 않는다** (메모리에서 처리하고 버린다).
3. 화면이 인식 값으로 입력 칸을 채우고 `인식됨` 표시를 붙인다. **읽지 못한 칸(곡명, 달성률 등)은 `읽지 못함` 표시와 함께 비워 두고 직접 입력하라고 안내한다.** 모든 필수 칸이 채워져야 저장할 수 있다. 사용자가 틀린 값을 고치고 저장한다. 저장은 기존 `POST /records` 그대로이고 같은 서버 검증을 지난다.

인식 항목과 검증
| 항목 | 처리 |
|---|---|
| 난이도·레벨 (예: MAS 9.75) | 곡과 같이 읽는다. 곡이 정해지면 같은 난이도·레벨의 채보를 자동 선택하고, 맞는 채보가 없으면 채보를 직접 고르게 한다 |
| 노트 옵션 | SRN+로 고정한다(D25). 다른 옵션으로 읽히면 입력하지 않는다 |
| 달성률 | 0.00~100.00으로 검증한다. 범위를 벗어나면 비워 둔다 |
| 곡별 SKILL | 레벨 × 달성률(0~1) × 20 계산값과 비교해 화면에 `일치` 또는 `불일치`를 보여 준다 (오인식 점검용이고, 저장은 막지 않는다) |
| Miss 수 | 0이면 풀콤보를 자동 체크한다 |
| 곡명 | 읽는다. 정규화한 곡명으로 곡 마스터와 맞춘다(D13). 한 곡으로 정해지면 곡을 자동 선택하고, 후보가 여럿이면 고르게 하고, 못 읽거나 맞는 곡이 없으면 **곡명을 직접 입력하게 안내한다** |
| 플레이어 이름·ID·스킬 | 읽지 않고 응답에 넣지 않는다 (프롬프트에서 제외하고, 응답 JSON 스키마에도 칸이 없다) |

비용과 제한
- 비전 모델 1회 호출로 읽기와 구조화를 같이 한다. Haiku급 모델 기준 한 장당 약 $0.002 (약 2~3원), 1,000장 약 2,500원이다 (1달러 = 1,400원 가정, 입력 약 1,500토큰·출력 약 100토큰 어림값이라 실제 요금표로 확인한다).
- 사용자당 하루 업로드 횟수와 파일 크기(약 2MB)에 상한을 둔다. 값은 설정으로 뺀다 (예: 하루 30장).
- API 키는 환경 변수로만 주입한다 (`LLM_API_KEY`). 저장소에 넣지 않는다.
- 결과 JSON이 스키마에 맞지 않으면 한 번만 다시 시도하고, 그래도 실패하면 "인식하지 못했다. 직접 입력한다"로 안내한다.

열린 문제: 공식 사진 외 이미지(합성·편집)는 막지 않는다. 인증을 하지 않기로 했으므로(D16) 기록의 신뢰도는 직접 입력과 같다.

---

## 13. 개발/배포 단계

| 단계 | 내용 |
|---|---|
| Phase 0 | 줄바꿈/`.gitattributes` 정리, `docker-compose.yml`(MySQL 8.4), **새 V1 스키마**(D1·D2·D18 반영), 공통 에러 처리, CI 기본 |
| Phase 1 | 인증 보안 보강(9.1 선행 작업, Role, 재발급), 곡/채보 등록(ROOT·ADMIN, 관리 API. 시드는 1회성 SQL), 옵션 기록 CRUD(SRN+만, `is_full_combo` 포함), 모바일 UI(다크/라이트) |
| Phase 1.5 | **스킬 목록 계산(전체/SRN/SRN+)**, `app_settings`, 역할 관리, **SRN+ 서열표**(ADMIN 편집 + 본인 기록 연결), 곡 상세, 감사 로그 |
| Phase 2 | **사진 입력(D16)**, 스킬 추이, 통계 (공식 기록 가져오기는 보류, 18.4) |
| Phase 3 | 곡 등록 요청 (랭킹·유저 간 비교는 보류, 18장) |
| 배포 | **로컬 검증 → GitHub Actions CI → AWS EC2 배포(CD)**. Phase 1 완료 후 첫 배포 |

### 배포 개요 (구현 시 구체화)
- EC2에 Docker로 백엔드 + MySQL, 프론트도 **같은 서버, 같은 도메인**에 둔다(리버스 프록시로 `/api`는 백엔드로, D20).
- HTTPS(도메인 + 인증서), 보안 그룹은 필요한 포트만. MySQL 포트는 외부에 열지 않는다.
- DB 백업 방안을 정한다.

---

## 14. 테스트 방침
- 서비스 로직: JUnit5 + Mockito
- 리포지토리/MyBatis 쿼리: **Testcontainers MySQL**로 실제 MySQL에서 검증 (집계/스킬 계산 쿼리 필수)
- 스킬 계산: 7장의 **직접 계산한 예시값**(구간 경계 0/80/95/100, 기준 난이도 6.0 전후), 단일 15 / 그 외 25 그룹 분리와 개수 제한, SRN+ 기록만 사용, 목록이 모자랄 때, 기준 난이도·속성 없는 채보 제외
- 보안: 권한별 접근 테스트(USER가 ROOT API → 403), 타인 기록 접근 테스트, **refresh 토큰으로 API 호출 시 거부**
- 달성률 경계값: 0.00, 100.00, -0.01, 100.01, 소수 셋째 자리

---

## 15. 곡 데이터와 이미지 정책

> 법률 자문이 아니다. 조사한 내용과 이 프로젝트의 운영 원칙을 정리한 것이고, 공개 범위를 넓히거나 수익화를 검토할 때는 다시 확인한다.

### 서열표 정보 제공자 표기 (2026-10-07)
서열표의 기준 난이도·추천·속성 정보는 지인 **イズニャン (X: @trist_is, https://x.com/trist_is)** 이 제공하고 설계했다. 화면에는 푸터(모든 화면)와 서열표 화면 상단에 같은 문구로 표기한다. 문구와 링크는 `frontend/src/lib/credit.ts` 한 곳에서 관리하고, 사용자가 정한 문구라 임의로 바꾸지 않는다. README 하단에도 출처로 적는다.

### 조사한 내용 (2026-10-02)
| 항목 | 내용 |
|---|---|
| 공식 사이트 이용 안내 | 사이트 내용의 무단 복제·게재, 로고/상표 사용을 금지한다 → 공식 데이터/이미지를 통째로 복사하지 않고, 로고를 쓰지 않는다 |
| e-amusement 이용규약 | **본문을 확인하지 못했다.** 자동 접근 관련 조항은 미확인 (16장) |
| 데이터베이스 제작자 권리 | 한국 저작권법 제93조 등. 체계적 복제는 보호 대상이 될 수 있다 → 공식 곡 목록을 통째로 가져오지 않는다 |
| 곡명 같은 사실 정보 | 그 자체는 보호받지 않을 가능성이 높지만 단정하지 않는다 |
| 제3자 곡 데이터 (위키 등) | 라이선스를 **확인하지 못했다.** 쓰려면 라이선스 확인 후 출처 표기 |
| 면책 문구 | "비공식 팬 프로젝트" 문구는 권리 침해를 없애 주지 않는다. 오인 방지 용도로만 둔다 |
| 재킷 이미지 | 저작물이며 상표 요소를 포함한다. 운영자는 다른 사이트처럼 수집해 쓰기로 했다(D21, 위험을 알고 쓰는 선택). 외부 주소에서 직접 불러오기(hotlink)는 하지 않는다 |

### 운영 원칙
1. **곡 데이터는 직접 정리한 스프레드시트를 기준**으로 한다 (서열표 v1.1). 최초 1회 시드 SQL로 DB에 넣고(데이터 파일은 저장소에 올리지 않는다), 이후 ROOT·ADMIN이 관리 API로 관리한다. `songs.source`에 출처를 남긴다 (D23).
2. 음원, 채보, 재킷, 로고, 게임 화면을 쓰지 않는다. 공식 사이트에서 곡 목록을 자동 수집하지 않는다.
3. 화면에 "비공식 팬 프로젝트 / KONAMI와 무관" 문구를 유지한다. 비영리로 운영한다.
4. **삭제 요청 연락처**(eyoung071212@gmail.com)를 푸터에 둔다. 값은 설정 `contact.takedown_email`로 두고 코드에 박지 않는다.
5. 이미지 칸: 설정 `ui.show_song_images`로 켜고 끈다(D21). 운영자가 모은 이미지를 `songs.image_url`에 연결해 쓰되, 삭제 요청이 오면 즉시 내리고 껐을 때는 단색 칸/타일이 대체 표시가 된다. 이미지 출처는 곡마다 기록한다.
6. 외부 데이터를 쓰게 되면 출처와 라이선스를 이 문서에 기록한다.

### 곡 마스터 확장 (D13)
1. **씨앗**: 시트를 **1회성 시드 SQL**로 DB에 직접 넣는다 (D23, 아래 시드 규칙).
2. **성장 (D18 개정)**: 가져오기를 보류했으므로 마스터는 **ROOT·ADMIN이 관리 API로만** 늘린다. 사진 입력에서 곡을 못 찾으면 사용자가 직접 곡을 고르고, 마스터에 없는 곡은 "곡 등록 요청"(Phase 3)으로 ROOT·ADMIN에게 알린다. 자동 등록은 하지 않는다 (가짜 곡 방지). (원래 `import_unmatched` 설계는 18.4)
4. **메타데이터**: 아티스트, BPM, 노트 수, 곡명 표기는 관리 API로 넣는다. 비어 있어도 된다. 노트 수는 직접 입력한다.
5. (가져오기 대기열은 보류. 18.4)

### 시드 데이터 규칙 (1회성 SQL, D23)
- 스프레드시트 열 → 컬럼: 곡명 → `songs.title`, 초출 Ver → `songs.added_version`, 파트(G/B) → GUITAR/BASS, 난이도(ADV/EXT/MAS) → ADVANCED/EXTREME/MASTER, 레벨 → `song_difficulties.level`
- 서열표 값: 기준 난이도 → `tier_label`, 추천도(상/중/하) → `recommend`, 패턴 주 속성 → `pattern_type`, 값 뒤의 `?` → `uncertain = true` (값에서는 `?`를 뗀다)
- 시트의 달성률 열은 **개인 기록**이므로 곡/서열표 마스터에 넣지 않는다.
- **`?` 처리(2026-10-02 확정):** 추천도가 `?`뿐이면 **미정**(NULL)으로 둔다. 기준 난이도가 `?`뿐이면 **그대로 둔다**(`tier_label` NULL, `uncertain = true`). 속성 값의 오타(`복하`)는 `복합`으로 고쳤다. 기준 난이도가 비어 있는 채보는 비어 있는 채로 등록한다(NULL = 미정). **속성이 비어 있는 채보는 `레이팅 제외`로 채워 등록한다** (2026-10-02 개정, 시드 274채보).

### 시드 입력 방법 (1회성)
- **시트 → 시드 CSV**(`title, part, difficulty, level, added_version, tier_label, tier_uncertain, recommend, recommend_uncertain, pattern_type, pattern_uncertain, source`, 669행)는 운영자가 따로 보관한다. **CSV와 생성된 SQL은 저장소에 올리지 않는다** (D20-6, `.gitignore`의 `scripts/seed/out/`).
- `scripts/seed/generate_seed_sql.py <시드.csv>`가 `scripts/seed/out/seed.sql`을 만든다. 곡·채보·서열표(SRN+ 서열표)·서열표 항목을 **명시적 ID**로 넣는 `INSERT`만 담고 하나의 트랜잭션으로 실행한다. 같은 SQL을 두 번 실행하면 기본 키가 겹쳐 실패하고 **전부 취소된다**(중복 입력 방지).
- 순서: `docker compose down -v` → `docker compose up -d` → 백엔드를 한 번 실행(Flyway가 테이블 생성) → 시드 SQL 실행(`docker exec -i <컨테이너> mysql -u srpfreaks -p srpfreaks < seed.sql`).
- 서열표 값 규칙은 위 `?` 처리를 따른다: 기준 난이도가 `?`뿐이면 `tier_label` NULL + `tier_uncertain` 1(엔티티 `changeTier`가 값이 없어도 불확실 표시를 유지한다).
- 값 종류는 DB enum을 쓰지 않는다. `instrument_part`, `difficulty_type`, `recommend`, `pattern_type`은 `VARCHAR`로 두고 허용 값은 애플리케이션 코드에서 검증한다. 서열표 값은 채보 테이블이 아니라 `difficulty_table_entries`에 둔다 (D8).
- 곡명은 정규화한다 (유니코드 NFKC, 앞뒤 공백/줄바꿈 제거, 대소문자 무시)하고 `normalized_title`로 비교한다. 곡명이 같고 파트/난이도가 다르면 같은 곡의 다른 채보다.
- 시드 마스터(2026-10-02 취합): 최신 시트 2개(628채보) + 이전 v1.1 시트의 하위 난이도 41채보 = **465곡, 669채보**(레벨 5.65~9.99, 기타 474 · 베이스 195, MAS 538 · EXT 125 · ADV 6). 기준 난이도 없음 220, 속성 없음 274, 추천도 미정 65, 그중 기준 난이도 값이 있는 채보 445, 없는 채보(미정) 224. 낮은 레벨 채보는 시트에 없으므로 이후 관리 API로 채운다.
- 시트의 **초출 Ver가 채보마다 다른 곡이 6곡** 있다 (月暈, Ouroboros, ENCOUNT, Anathema, Six String Proof, Dragon Killer). **확정(2026-10-02): 곡 단위 `songs.added_version` 하나만 두고, 이 6곡은 가장 이른(구) 버전으로 통일한다.** 채보별 `added_version` 컬럼은 만들지 않는다. 시드 CSV에는 통일한 값만 있다.

### 기록 입력 (CSV 일괄 입력 없음, D23)
- 달성률 CSV 일괄 입력은 만들지 않는다. 기록은 사용자가 한 건씩 입력한다(빠른 입력 화면: 직전 옵션/파트를 기본값으로 유지, 10장).

## 16. 확인이 필요한 항목 (미정)
- [x] 스킬 값의 소수 처리 → 계산은 소수 그대로, 표시는 둘째 자리, 티어는 버림 (D20, 로컬 테스트 후 조정)
- [x] scope ALL의 정의 → 필요 없어짐 (목록은 SRN+만, D18)
- [x] 스킬 동점 처리 → 먼저 달성한 사람이 위 (7장, D20)
- [x] 공식 사이트 기록 페이지 URL/구조 → 해당 없음 (가져오기 보류, 18.4)
- [x] e-amusement 이용약관의 자동 접근 관련 조항 → 확인함, 8장 맨 아래 (공식 가져오기는 위험이 있는 선택 기능으로 낮춤)
- [ ] MyBatis, springdoc, Testcontainers의 Spring Boot 4.1.1 호환 버전 (`build.gradle`에 추가함: MyBatis starter 4.1.0, springdoc 3.1.1, Testcontainers. **빌드가 되는지 확인 필요**, 버전은 안 맞으면 조정)
- [x] access 토큰 만료 → 15분 (D20, `application.yml` 900000 적용)
- [x] 탈퇴 시 기록 처리 → 완전 삭제 (D20)
- [x] 프론트 배포 위치 → 같은 서버, 같은 도메인 (D20)
- [x] 초출 Ver가 채보마다 다른 곡 6곡 → 가장 이른 버전으로 통일, 곡 단위 하나만 (확정)
- [x] (보류, 18.4) 공식 페이지 링크에 곡 고유 ID가 있는지 (2026-10-02 점검: 상세 링크의 `sid`/`index`는 곡 ID가 아닌 것으로 보임, 곡명 매칭 전제)
- [x] `released_at` → 초출 Ver(`added_version`)로 충분해서 **컬럼을 뺀다** (운영자 결정)
- [x] 기준 난이도 열 → 높을수록 어렵다, 0.1 단위 (운영자 확인)
- [x] 재킷 이미지 → 운영자가 수집해 사용하기로 함, 위험을 알고 쓰는 선택 (D21)
- [x] 삭제 요청 연락처 → eyoung071212@gmail.com (설정 `contact.takedown_email`, 푸터에 표시)
- [ ] 보류한 기능(18장) 재개: **로컬 테스트를 마칠 때까지 보류** (운영자 결정). 순서는 인증 → 랭킹 → 노트 성향 가정
- [x] 서열표 달성률 열의 옵션 기준 → **SRN+만** (D20)
- [x] 플레이어 티어 구간 → 합계 0~9,500+ 20단계 표 (7장). 이름은 운영자 표기, 화면 이름·색은 미정
- [x] 목록 구조 → 속성 단일 15 + 그 외 25 = 40곡 (D18). HOT은 쓰지 않는다
- [x] 곡당 1채보 → 거르지 않는다. 채보 단위로 센다 (D18)
- [x] 속성이 비어 있는 채보 → `레이팅 제외` (D18)
- [x] 플레이어 티어 화면 이름·색·그라데이션 → 시안대로 시작, 로컬에서 써 보고 조정 (영문 이름, 하수봉은 한글)
- [x] 시안의 HOT 표시, 탭, 요약 카드 수정 → 레이팅 화면 개편으로 끝남
- [x] 기준 난이도가 없는 채보(미정, 시드 224개)·서열표에 없는 채보 → 레이팅에서 제외, 기록만 남긴다 (D18)
- [x] 상수표 수식의 사용 허락 → 제작자와 연락 중이며 사용해도 된다고 확인함 (2026-10-02, 운영자 확인)
- [x] SRN/ALL scope → 만들지 않는다. SRN+만 (D18)
- [x] 곡 등록 요청(Phase 3) → 구현한다 (D20)

## 17. 변경 이력
| 날짜 | 내용 |
|---|---|
| 2026-10-08 | **D27 추가.** 곡 상세에서 ROOT·ADMIN이 서열표 값(기준 난이도·추천도·속성)을 수정하거나 표에 없는 채보를 추가하는 API와 화면. `PUT /admin/difficulty-tables/{id}/entries/{songDifficultyId}`, 감사 로그, `?` 해제 |
| 2026-10-08 | **D26 추가.** 유저 목록(닉네임·티어·총점, 본인이 공개를 선택)과 유저 상세(읽기 전용 레이팅 목록)를 구현 대상으로 하고 D15의 랭킹·유저 간 비교 보류를 일부 해제. `users.profile_public`, `/players` API, 설정의 공개 여부, 화면 항목, 개인정보 안내 추가. 곡별 랭킹·유저 비교는 계속 보류 |
| 2026-10-08 | **곡 목록 화면 API 추가.** `GET /songs/chart-folders`, `GET /songs/charts`(레벨 폴더 통계, 폴더 안 채보·검색·필터 결과). **유저 목록 동점을 달성 시각 기준으로 변경**(`user_id` 단독 → 가장 늦은 달성 시각이 이른 쪽, 같으면 `user_id`). 7장·18.2 |
| 2026-10-08 | **D26 구현.** `users.profile_public` 컬럼(V1 직접 수정), `GET /players`·`GET /players/{userId}`, `PATCH /users/me/visibility`(설계의 `PATCH /users/me` 확장 대신 별도 경로), 동점은 user_id 오름차순으로 구현(18.2에 사유 기록) |
| 2026-10-05 | **D23 추가.** CSV 일괄 등록·내려받기·달성률 CSV 입력을 만들지 않기로 하고 시드는 1회성 SQL로 입력한다. 관련 규칙(권한표, API 표, 15장 곡 마스터 확장)을 정리 |
| 2026-10-05 | **D22 추가.** 곡/채보 관리(등록·수정·삭제, CSV)를 ROOT와 ADMIN 둘 다에게 열고, ROOT·ADMIN도 USER 기능을 쓰는 것으로 정리. 5장 권한표, 10장 API 권한, 곡 마스터 규칙 반영
| 2026-10-05 | D24 추가: 달성 단계에 하위 단계 A/B/C와 서열표 "S 미만" 칩 추가 (D9 확장) |
| 2026-10-05 | D25 추가: 기록은 SRN+ 하나만 받는다(D18·D20의 5가지 저장 대체). 옵션별 최고 기록 API 제외 |
| 2026-10-02 | **D19~D21 추가.** Google 로그인만 사용(자체 비밀번호·잠금 없음, `users` 컬럼 변경, API `/auth/google`). access 토큰 15분, 탈퇴는 완전 삭제, 같은 서버 배포, 동점은 먼저 달성한 사람이 위, 레이팅은 SRN+만. 재킷 이미지는 운영자가 수집해 사용(위험 인지). 프로젝트명을 SRPFreaks로 변경, 플레이어 티어 영문 표기. 16장 미결 항목 정리 |
| 2026-10-01 | 최초 작성 |
| 2026-10-01 | 현재 코드(Gradle, Boot 4.1.1, 계층형 패키지, Flyway)에 맞춰 개정. D1~D6 결정 반영, 스킬 계산 규칙과 공식 기록 가져오기 설계 추가 |
| 2026-10-02 | D7~D12 추가: 이미지 정책, 서열표(기준 난이도), 달성 표시(`is_full_combo`), 곡 데이터 출처/CSV 일괄 등록, 곡 상세 노트 성향 그래프(`difficulty_profiles`), 다크/라이트. 15장(곡 데이터와 이미지 정책) 신설, 기존 15·16장은 16·17장으로 이동. UI 규칙은 `DESIGN-UI.md`로 분리 |
| 2026-10-02 | D13 추가(곡 마스터 확장). `songs.composer` 제거→`artist` 통일, `title_folder` 추가(`released_at`도 넣었다가 나중에 뺌), `song_titles` 신설(`song_aliases` 대체), `official_records`에 `is_full_combo`·`play_count` 추가, 가져오기 데이터 필드 정리(8장), 노트 성향 값은 ROOT/ADMIN이 직접 입력(D11), 권한표 갱신 |
| 2026-10-02 | D14 추가(기록 인증 정책). 인식 API 대신 **증빙 사진 + 이의제기**로 결정. `option_records.input_type` → `source`+`verification`, `record_evidence`·`record_disputes` 신설, 12장 재작성(흐름, 표시, 비용, 후속 자동 인식), 달성 단계 표시 이름 80/95 → S/SS |
| 2026-10-02 | **D15 추가(범위 축소).** 랭킹, 증빙 사진 인증·이의제기·신고(D14), 노트 성향 그래프(D11)를 보류하고 18장에 원문을 보존. `option_records.source/verification`, `record_evidence`, `record_disputes`, `difficulty_profiles`, 관련 설정·API 제거. 12장을 "기록 등록과 수정"으로 교체 (본인 등록·수정·삭제) |
| 2026-10-02 | 곡 마스터 `?` 처리 확정(추천도 ?=미정, 기준 난이도 ?=그대로, 오타 수정)과 **확장 원칙** 추가(CSV 업서트, VARCHAR, 서열표 값은 별도 테이블) |
| 2026-10-02 | 곡 마스터 시드 CSV 취합(시트 2개 → `songs-master.csv` 628채보, 검토 목록, v1.1 추가분 41채보). D17 범위 정정(공식 `music/index.html`은 신곡 목록) |
| 2026-10-02 | **D17 추가(곡 마스터 보충).** 공식 곡 목록을 운영자 본인 계정으로 1회 CSV로 내려받아 곡 마스터에 보충한다. 곡명·파트·난이도·레벨만 쓴다 |
| 2026-10-02 | **D16 수정**: 곡명도 사진에서 읽는다(못 읽으면 직접 입력 안내). 인식 실패 화면 추가 |
| 2026-10-02 | 티어 구간 정정(0~499 / 500~999). 시안: 곡 카드 화면을 레이팅 상단 + 레이팅 포함 채보 목록 하단으로 변경, 전체 곡 목록에서 채보가 없는 레벨 폴더(5.00 미만) 삭제 |
| 2026-10-02 | D18 보강 2: 곡당 1채보 폐기(채보 단위), 속성 빈 채보는 `레이팅 제외`(시드 CSV 반영), 플레이어 티어 20단계 표 확정, `player_tiers` 테이블 추가 |
| 2026-10-02 | D18 보강: 목록은 SRN+ 하나, 단일 15 + 그 외 25 = 40곡, HOT 폐기, 기준 난이도 없는 채보는 레이팅 제외, 상수표 사용 허락 확인 |
| 2026-10-02 | **D18 추가.** 공식 사이트 가져오기(D5·D17, `official_records`, 가져오기 토큰, `import_unmatched`, 확장 프로그램)를 18.4로 보류하고, 스킬 계산을 상수표 방식(기준 난이도→레이팅상수, 80/95% 구간)으로 대체. 7장 재작성, 플레이어 티어 추가. PK 이름 규칙(`{테이블}_id`) 확정, 첫 배포 전 V1 직접 수정으로 마이그레이션 원칙 개정 |
| 2026-10-02 | 초출 Ver가 갈리는 6곡은 가장 이른 버전으로 통일(곡 단위만, 채보별 컬럼 없음). 시드 CSV에서 `song_added_version` 열 제거 |
| 2026-10-02 | **D16 추가(사진 입력 구현).** 기록 등록에 사진 인식 입력 탭을 추가한다. 인증·증빙은 하지 않고 사진은 저장하지 않는다. 12.1 신설 |

---

## 18. 보류된 기능 (기록 보존, D15)

2026-10-02에 **MVP 범위를 줄이면서** 아래 기능을 뺐다. 나중에 다시 넣을 수 있도록 **설계 원문을 그대로 남긴다.** 이 장의 내용은 현재 구현 대상이 아니다 (스키마, API, 화면 모두 만들지 않는다).
시안은 디자인 캔버스의 **"[보류]"** 이름이 붙은 보드(맨 아래 영역)에 남아 있다.

| 보류 기능 | 원래 결정 | 이 장 |
|---|---|---|
| 기록 인증 (증빙 사진, 이의제기, 신고, 관리자 처리, 인증 필터·비율) | D14 | 18.1 |
| 랭킹, 유저 간 비교 | Phase 3 | 18.2 |
| 노트 성향 그래프 (육각형) | D11 | 18.3 |
| 공식 기록 가져오기 (확장·북마클릿, `official_records`, 곡 목록 보충) | D5, D17 | 18.4 |

되살릴 때 순서 (제안): ① 기록 인증 (`option_records.source`·`verification` 추가, 증빙/이의제기 테이블) → ② 랭킹 (인증 필터와 함께) → ③ 노트 성향 (값 입력 방식 확정 후).

### 18.1 기록 인증 (D14, 증빙 사진 + 이의제기)

**결정 원문 (D14)**

**기록 인증 정책 (증빙 사진 + 이의제기)**: (1) 모든 기록을 비교·순위에 포함하고, 화면 상단에서 **전체 / 인증 / 미인증**을 고른다 (2) 기록에 **증빙 사진을 첨부하면 즉시 `인증`** 이다. 사전 승인은 없다 (3) **이의제기가 접수되면** 관리자가 사진을 확인한다. 확인된 기록은 `관리자 확인`으로 표시하고 **이의제기를 더 받지 않는다** (4) 이의가 인정되면 인증이 해제되고 사진은 삭제된다 (5) 증빙 사진은 **업로드 후 30일 보관 뒤 삭제**한다 (이의제기 처리 중이면 처리 완료까지 연장). **로그인한 사용자만 열람**한다(목록은 썸네일, 클릭 시 원본). 모든 사진에 **신고 버튼**을 두고 3건 신고되면 자동 숨김 후 관리자가 확인한다 (6) **자동 인식(비전 API)은 비용 문제로 제외**, 후속 과제로 남긴다 (12장) (7) 초기 대량 입력은 관리자 CSV(`ADMIN_IMPORT`, 미인증)로 처리한다 (8) **이의제기 가능 기간 = 사진 보관 기간(30일)** (9) 스킬 목록·합계에도 전체/인증/미인증 필터를 적용하고, 스킬 요약에 **인증 기록 비율**(예: `18 / 50곡 · 36%`, HOT·그 외 따로)을 표시한다

**option_records에 추가했던 컬럼과 규칙**

| 컬럼 | 비고 |
|---|---|
| source | VARCHAR(15) | 입력 경로. MANUAL / ADMIN_IMPORT (D14, `input_type` 대체) |
| verification | VARCHAR(15) | NONE(미인증) / EVIDENCE(인증: 증빙 사진 첨부) / ADMIN_CONFIRMED(관리자 확인). **서버만 바꾼다** |

- `verification`은 서버가 정한다. 클라이언트가 보낸 값은 쓰지 않는다. 증빙 사진이 저장에 성공하면 EVIDENCE, 관리자가 이의제기를 확인하면 ADMIN_CONFIRMED, 사진을 지우거나 이의가 인정되면 NONE.
- **인증 기록**은 `verification IN (EVIDENCE, ADMIN_CONFIRMED)`이다 (`official_records`는 공식 기록으로 따로 취급). 목록·스킬·순위 조회는 `verification` 필터(전체 / 인증 / 미인증)를 받는다.
- 인증 기록의 달성률·FC·채보·옵션을 수정하면 `verification`이 NONE으로 내려간다. 메모·날짜 수정은 영향 없음. `ADMIN_CONFIRMED` 기록은 값을 수정할 수 없다 (수정하려면 관리자에게 요청).

#### record_evidence (증빙 사진, D14)
기록 1건에 사진 1장. 사진은 **비공개 저장소**에 두고 DB에는 메타만 남긴다.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | BIGINT PK AI | |
| option_record_id | BIGINT FK UNIQUE | 기록이 삭제되면 함께 삭제(ON DELETE CASCADE) |
| storage_key | VARCHAR(200) | 저장소 경로. 외부에 직접 노출하지 않는다 |
| image_sha256 | CHAR(64) UNIQUE | **전체 사용자 기준 유일.** 같은 사진을 두 기록에 쓰거나 남의 사진을 도용하는 것을 막는다 |
| size_bytes | INT | |
| created_at | DATETIME(6) | |
| expires_at | DATETIME(6) NULL | 기본 `created_at + 30일`. 이의제기 처리 중이면 NULL(보관 연장), 처리 후 다시 계산 |
| deleted_at | DATETIME(6) NULL | 삭제 시각. 사진이 삭제돼도 기록과 `verification`은 유지 (이의제기 기간이 끝난 인증으로 취급) |

- 업로드 처리: 실제 콘텐츠 기준 이미지 형식 검사, 크기 상한, **EXIF(위치 정보 등) 제거 후 재인코딩**, 해시 중복 검사.
- 열람: **로그인한 사용자만.** 비로그인에게는 사진도 URL도 주지 않는다. 목록·상세는 썸네일(약 40KB), 클릭 시 원본. 서명된 임시 URL(수 분)로만 제공한다.
- 신고: 모든 사진에 신고 버튼(성과와 무관 / 부적절한 내용 / 개인정보 노출 / 기타). **같은 사진에 3건 신고되면 자동 숨김 + 관리자 확인.** 확인 결과 위반이면 인증 해제·사진 삭제·경고, 반복 시 업로드 제한. 신고자는 기록 소유자에게 보이지 않는다.
- 신규 계정 보호: 가입 후 첫 약 3장은 열람 공개 전에 관리자 확인 또는 저비용 자동 분류(계정당 약 $0.005)를 거친다.
- 업로드 화면 안내: 이름·ID는 가리거나 잘라서 올리기, 위치 정보(EXIF) 제거, 약관 고지.
- 삭제: 만료 시 일일 배치로 삭제, 기록 삭제·탈퇴 시 즉시 삭제.

#### record_disputes (이의제기, D14)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | BIGINT PK AI | |
| option_record_id | BIGINT FK | 이의 대상 (`verification = EVIDENCE`인 기록만) |
| reporter_user_id | BIGINT FK | 신고자. 기록 주인에게는 공개하지 않는다 |
| reason | VARCHAR(255) | |
| status | VARCHAR(10) | OPEN / CONFIRMED(사진이 기록과 일치, 이의 기각) / UPHELD(불일치, 이의 인정) |
| handled_by / handled_at | | ADMIN/ROOT |
| created_at | DATETIME(6) | |

- **한 사용자는 같은 기록에 이의제기를 1번만 할 수 있다.** (`UNIQUE(option_record_id, reporter_user_id)`, 기각 후 재접수 불가). 서로 다른 사용자의 이의는 받되 **진행 중(OPEN)은 기록당 1건만.** `ADMIN_CONFIRMED` 기록에는 새 이의를 받지 않는다 (화면에서 버튼 비활성화 + 서버 검증).
- CONFIRMED → 기록 `verification = ADMIN_CONFIRMED`. UPHELD → `verification = NONE`, 사진 삭제, 기록 주인에게 알림.
- 이의제기는 **증빙 사진이 보관 중일 때만** 접수한다 (업로드 후 30일). 이후에는 인증이 확정된다.
- 남용 방지: 사용자당 이의제기 일일 한도(`dispute.daily_limit`, 기본 10).
- **다건 악용 감지**: 사용자별 최근 이의 수·기각 비율, 같은 대상 사용자(기록 주인)에게 집중된 이의, 짧은 시간 연속 접수를 집계해 임계값을 넘으면 접수를 자동 제한하고 관리자 화면에 표시한다. 기각 비율이 높은 사용자는 경고 → 일정 기간 접수 제한.
- **욕설 필터**: 이의 사유·신고 설명과 기록 메모는 저장 전에 서버에서 비속어 목록으로 검사해 걸리면 거절한다 (자모 분리·특수문자·띄어쓰기 우회 정규화 포함). 목록은 설정/관리자 화면에서 수정 가능.

#### 스킬 화면의 인증 필터와 인증 비율 (원래 7장)
- 스킬 목록·합계는 `verification` 필터를 받는다: **전체**(기본) / **인증** / **미인증**. 인증 필터에서는 인증 기록(EVIDENCE, ADMIN_CONFIRMED)과 공식 기록만 계산에 넣는다.
- 스킬 요약에 **인증 기록 비율**을 보여준다. 목록에 오른 50곡(HOT 25 + 그 외 25) 중 인증 기록으로 오른 곡의 수와 비율이다. 예: `18 / 50곡 · 36%`, 아래에 `HOT 12/25 · 그 외 6/25`.
- 비율은 필터와 무관하게 **전체 목록 기준**으로 계산한다. (인증 필터에서도 같은 값이 보여야 사용자가 비교할 수 있다.)

**API 초안 (원래 10장)**

| 기능 | 엔드포인트 | 권한 |
|---|---|---|
| 증빙 사진 | POST/DELETE `/records/{id}/evidence` (multipart), GET `/records/{id}/evidence` (서명 URL) | 업로드·삭제는 본인, 열람은 로그인 사용자 |
| 이의제기 | POST `/records/{id}/disputes` (인증 기록만, 진행 중·관리자 확인 기록은 거절) | USER+ |
| 이의제기 처리 | GET `/admin/disputes`, PATCH `/admin/disputes/{id}` (CONFIRM / UPHOLD) | ADMIN+ |

**개인정보 안내 (원래 9.6)**

- 증빙 사진(선택 업로드): 위치 정보(EXIF)를 제거하고 30일 보관 후 삭제한다. 사진에 플레이어 이름·ID가 찍힐 수 있다는 점, 열람 범위(로그인 사용자), 신고 기능, 삭제 요청 방법을 가입·업로드 화면에 안내한다 (D14).

**설정 키 (원래 app_settings)**: `evidence.daily_limit`(하루 업로드 한도, 기본 100), `evidence.retention_days`(기본 30), `evidence.max_bytes`, `dispute.daily_limit`(기본 10)

**운영 규칙 (원래 12장 전문)**

### 흐름
1. 사용자가 기록을 저장하면서 **증빙 사진(결과 화면)** 을 첨부할 수 있다 (선택). 브라우저가 긴 변 1,280px 이하, 약 300KB 이하로 줄여서 보낸다.
2. 서버가 형식·크기·해시 중복을 검사하고, EXIF를 제거해 비공개 저장소에 저장한다. 성공하면 `verification = EVIDENCE` (`✓ 인증`). 첨부하지 않으면 `NONE` (`미인증`). 사전 승인은 없다.
3. 누구든(로그인 사용자) 인증 기록에 **이의제기**를 할 수 있다. 접수되면 사진 보관이 처리 완료까지 연장된다.
4. 관리자가 사진을 보고 판정한다.
   - 사진이 기록과 일치(이의 기각): `✓ 관리자 확인`. 이후 이 기록의 이의제기는 막힌다.
   - 불일치(이의 인정): 인증 해제(`미인증`), 사진 삭제, 기록 주인에게 알림.
5. 이의제기가 없으면 사진은 업로드 후 30일에 삭제되고, 기록은 인증으로 남는다.

##### 표시와 조회
| 상태 | 표시 | 비고 |
|---|---|---|
| NONE | `미인증` | 직접 입력, 관리자 입력(ADMIN_IMPORT) |
| EVIDENCE | `✓ 인증` | 증빙 사진 첨부 |
| ADMIN_CONFIRMED | `✓ 관리자 확인` | 이의제기 비활성화, 값 수정 불가 |
| 공식 가져오기 | `공식` | `official_records`. 인증 기록과 같이 취급 |

- 목록 상단에 **전체 / 인증 / 미인증** 필터를 둔다. 비교·순위는 기본이 전체이고, 필터로 인증만 볼 수 있다.
- 사진은 로그인한 사용자에게만 열람된다. 신고 3건이면 자동 숨김, 관리자가 확인한다.
- 공식 가져오기도 사용자 브라우저를 거친 값이라 위조를 완전히 막을 수는 없다. "신뢰도가 높은 출처"로 표시한다.

##### 정합성·악용 방지
- 노트 수가 입력된 채보는 불가능한 점수(상한 초과)를 거절한다.
- 같은 사진 해시는 전체 사용자 기준 한 번만 쓸 수 있다.
- 이의제기 남용은 일일 한도와 신고자 비공개로 막고, 허위 이의가 반복되면 제재 정책을 둔다 (미정).
- 사진 업로드는 사용자당 하루 100장(한국 시간 기준).

##### 비용 (2026-10-02 추정)
- 저장: 사진 1장 약 200KB, 30일 보관하면 월 5만 장 업로드 기준 약 10GB(월 약 $0.25), 월 50만 장 기준 약 100GB(월 약 $2.5). 전송은 이의제기 확인할 때만 생겨 사실상 0.
- **실제 부담은 관리자 시간**이다. 이의제기가 들어온 건만 확인하므로 규모와 무관하게 이의제기 건수에 비례한다.
- 개인정보: 사진에 플레이어 이름·ID가 찍힐 수 있다. 위치 정보는 제거하고, 열람 권한을 제한하고, 보관 기간과 삭제 요청 대응을 개인정보 안내에 적는다 (9.6).

##### 후속: 자동 인식 (제외, 비용 때문)
- 인식 API(비전)로 곡명·난이도·달성률을 자동 추출하는 방식은 **업로드 장수에 비례해 비용이 든다.** Claude Haiku 4.5 기준 장당 약 $0.00175: 월 2천 장 약 $3.5 / 5만 장 약 $88 / 50만 장 약 $875 (환율 ₩1,400 가정 시 약 ₩5천 / ₩12만 / ₩122만). Cloud Vision은 비슷하고 CLOVA OCR은 약 10배.
- 도입하게 되면 입력 폼 채우기에만 쓰고, 사용자당 호출 한도·전체 월 상한·비상 차단 스위치를 함께 둔다.

**당시 미정이던 항목**

- [x] 기록 인증 방식 → 증빙 사진 + 이의제기 (D14)
- [x] 이의제기 가능 기간은 보관 기간(30일)과 같게 한다 (D14)
- [ ] 허위 이의제기 반복 시 제재, 이의 인정(UPHELD) 시 기록 주인 제재 정책
- [ ] 증빙 사진 형식·크기 상한, 저장소 선택 (S3 등)
- [x] 스킬 합계에도 인증/미인증 필터 적용, 요약에 인증 비율 표시 (D14, 7장)
- [x] 증빙 사진 열람 범위: 로그인 사용자 전체 + 신고 3건 자동 숨김 + 신규 계정 첫 사진 확인 (D14)
- [ ] 신고·이의제기 허위 반복 제재 기준(다건 감지 임계값, 경고 횟수, 제한 기간), 신규 계정 첫 사진 확인 방식(수동 / 자동 분류)
- [ ] 비속어 목록 출처와 우회 정규화 범위
- [ ] 노트 옵션은 사진으로 확인되는지 (결과 화면에 표시되지 않으면 사용자 선언값)
- [ ] 자동 인식 도입 시점 (후속)

### 18.2 랭킹, 유저 간 비교

**D26(2026-10-08)으로 일부를 구현 대상으로 푼다.** 아래 "유저 목록"만 만들고, 이 절의 나머지(곡별 랭킹, 두 유저 비교, 인증 필터와 함께 넣는 것)는 계속 보류다.

**유저 목록 / 유저 상세 (D26, 구현됨)**
- 공개 여부는 `users.profile_public`(기본 FALSE). 켠 ACTIVE 유저만 목록에 나온다. 닉네임이 있어야 켤 수 있다.
- 목록 항목: 순위, 닉네임, 플레이어 티어(칩), 총점. 총점은 `/skills/me`와 같은 계산(7장)을 그 유저의 SRN+ 기록에 적용한 값이다. 정렬은 총점 내림차순이고 `page`·`size` 페이지네이션(상한 있음)을 쓴다.
- 동점 처리: 총점이 같으면 **먼저 달성한 사람이 위**(D20-4, 2026-10-08 구현). 레이팅 40채보를 이루는 기록들의 달성 시각(채보별 최고 달성률을 처음 기록한 `played_at`) 중 가장 늦은 시각이 이른 쪽이 위이고, 그래도 같으면 `user_id` 오름차순이다. 규칙은 7장. 후보 쿼리(`SkillMapper`)가 채보별 `achievedAt`을 함께 준다.
- 유저 상세: 목록에서 들어간다. 그 유저의 레이팅 카드(합계·티어)와 단일 15 / 복합·이중·삼중 25 목록을 읽기 전용으로 보여 준다. 기록 입력·수정 버튼, 이메일, 역할은 없다. 비공개·차단·없는 유저는 404.
- 응답에는 이메일·역할·Google ID를 넣지 않는다. 상세 URL의 식별자는 `user_id`이고, 비공개 유저는 404라서 존재 여부가 드러나지 않는다.
- 계산 비용: **구현은 공개 유저마다 `SkillService.mySkill(userId)`를 호출해(내 레이팅과 같은 계산이라 숫자가 항상 같다) 메모리에서 정렬·페이지로 자른다.** 공개 유저가 수십~수백인 지금은 충분하다. 느려지면 MyBatis 집계 한 번으로 바꾸거나 캐시·스냅샷(`skill_snapshots`)을 검토한다.
- 닉네임 중복은 **허용**한다(2026-10-08 확정). 사용자는 계정 식별자(`user_id`)로 구분하고, 목록·상세의 URL도 `user_id`를 쓴다. 그래서 유니크 제약은 걸지 않는다.

**원래 구상 (보류 유지)**

- 곡별 랭킹, 유저 간 비교/공유 (원래 Phase 3). 곡 상세에서 같은 채보·옵션의 상위 기록을 보여 주는 구상이었다.
- 필요했던 인덱스: `option_records (difficulty_id, note_option, achievement_rate DESC)` — 곡별 랭킹용.
- 랭킹을 넣을 때는 닉네임(`users.nickname`)을 필수로 하고, **인증 필터(18.1)와 같이** 넣는 것을 전제로 했다 (미인증 기록 위조 대응).
- 지금 `option_records`는 본인만 보는 데이터라 인덱스를 만들지 않는다.

### 18.3 노트 성향 그래프 (D11)

**결정 원문 (D11)**

**곡 상세의 노트 성향 그래프**: 단일·고속·이중·삼중·지구력·테크닉 6축(0~100%)을 SRN/SRN+ 별로 보여준다. 축은 데이터로 받는다 (`difficulty_profiles`). 값은 **ROOT와 ADMIN이 직접 입력**한다

#### difficulty_profiles (노트 성향, D11)
채보별·옵션별 패턴 비율. 곡 상세의 오각형 그래프에 쓴다. 축을 행으로 저장해서 축이 늘어나도 스키마가 바뀌지 않는다.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | BIGINT PK AI | |
| difficulty_id | BIGINT FK | |
| note_option | VARCHAR(20) | SUPER_RANDOM / SUPER_RANDOM_PLUS (확장 가능) |
| axis | VARCHAR(20) | SINGLE / HIGH_SPEED / DOUBLE / TRIPLE / ENDURANCE (확장 가능) |
| value | DECIMAL(5,2) | 0.00 ~ 100.00 (CHECK) |

- UNIQUE(difficulty_id, note_option, axis)
- 값의 출처(ROOT/ADMIN 직접 입력인지, 계산인지)는 미정 (16장)

- 권한: 값 입력·수정은 ROOT, ADMIN (원래 5장 권한표: 노트 성향 값 입력·수정 O / O / X)
- API: 곡 상세 `GET /songs/{id}` 응답에 노트 성향 `profiles`를 포함했다.
- 화면 규칙과 시안은 `DESIGN-UI.md` 13장(보류)과 캔버스의 "[보류] 곡 상세 · 노트 성향 그래프" 보드.
- 값 입력 방식 미정: ROOT/ADMIN 직접 입력 vs 채보 데이터 계산 (영상·채보 데이터 기반 자동 측정은 저작권·작업량 때문에 후속 과제로만 논의).
- 미정이던 항목: 노트 성향 값 입력 화면의 모양 (ROOT/ADMIN). 시안의 값은 임시

### 18.4 공식 기록 가져오기 (D5, D17 · Phase 2, D18에서 보류)

2026-10-02에 **상수표 방식으로 직접 계산하는 쪽으로 바꾸면서** 보류했다 (D18). 서버가 Konami와 통신하지 않는 구조가 되고 이용규약 위험이 사라진다. 아래는 보류 당시의 설계 원문이다. 되살리려면 먼저 이용규약(8(13), (22), (23) 등)과 위험을 다시 확인한다.


#### 원칙
- 서버는 Konami 계정/세션/쿠키를 **받지도, 저장하지도 않는다.**
- 유저 본인의 브라우저(이미 공식 사이트에 로그인한 상태)가 공식 페이지를 읽고, **파싱된 값만** SRPFreaks API로 보낸다.
- 타 서비스의 스크립트/API를 복사하지 않고 **직접 작성**한다.

#### 방식
| 방식 | 용도 |
|---|---|
| **브라우저 확장 프로그램 (MV3)** | 주 방식. 공식 기록 페이지에 [SRPFreaks로 보내기] 버튼 표시. 코드는 설치 시점에 고정되어 원격 코드 실행이 없다. 권한은 공식 사이트 도메인과 SRPFreaks API로 한정 |
| 북마클릿 | 보조(모바일/비Chrome). SRPFreaks에서 토큰이 들어간 링크를 북마크바로 끌어다 놓는 방식 |
| 연동 | SRPFreaks의 [공식 기록 가져오기] 버튼 → 공식 사이트 새 탭 → 확장이 감지해서 버튼 표시. 토큰은 확장으로 자동 전달 |

#### 가져오기 API 보안
- **가져오기 전용 토큰**: 가져오기 권한만 있고, 해시로 저장하며, 유저가 폐기할 수 있다. 일반 로그인 토큰과 별개.
- 토큰은 요청 본문이 아닌 `Authorization` 헤더로 보낸다. 요청 크기 제한, Rate Limit 적용.
- 서버가 값을 다시 검증한다. (달성률 범위, enum, 개수 상한) 클라이언트를 믿지 않는다.
- 요청 본문/원본 HTML을 로그에 남기지 않는다.
- DB에 없는 곡은 버리지 않고 `import_unmatched`에 모아 ROOT가 등록한다.

#### 가져오기 데이터 필드 (우리 쪽 계약)
다른 서비스의 스크립트가 공식 페이지에서 읽는 값의 구조를 참고해서, **우리가 직접 작성하는** 확장/북마클릿이 보낼 필드를 정했다. (코드는 복사하지 않는다)

| 필드 | 설명 |
|---|---|
| songTitle | 공식 페이지의 곡명 |
| instrumentType | GUITAR / BASS 만 받는다 (DRUM, OPEN은 서버가 거부) |
| difficulty | BASIC / ADVANCED / EXTREME / MASTER |
| level | 레벨 ×100 정수 (예: 9.80 → 980). 스킬 페이지의 **난도 값**, 곡 상세 표의 맨 위 레벨. 우리 마스터와 다르면 레벨 변경 후보 |
| achievement | 달성률 ×100 정수 (예: 99.71 → 9971). 소수 오차를 피하려고 정수로 보낸다 |
| isFullCombo | 풀콤보 여부. 곡 상세의 `score_data_clear` 칸 클래스가 `FULL COMBO`이면 true, 그 외는 false. 달성률 100.00은 EXC로 처리하므로 EXCELLENT 표시는 읽지 않는다 (D9) |
| playCount, clearCount, maxCombo, score, rank | 선택 |
| version / versionId | 페이지가 속한 게임 버전 |
| isHot | 스킬 페이지의 HOT 구분 (`stype=1` HOT, `stype=0` 그 외). 검증용 |
| gameType | `gf`(Guitar/Bass)만 받는다. `dm`은 읽지도 보내지도 않는다 |
| skillScore | 스킬 값 ×100 (**계산 검증용**, 스킬 페이지에서만) |

- 곡 하나의 채보별 기록은 **곡 상세 페이지**에 있고, 스킬 대상 50곡은 **스킬 페이지**에 모여 있다. 읽기 순서와 요청 수는 아래 "페이지별 읽기 계획"을 따른다.
- 공식 페이지 글자 인코딩은 Shift_JIS일 수 있다. 읽을 때 문자 집합을 확인해서 디코딩한다.
- 공식 페이지 링크에 곡 고유 ID가 있는지는 **확인이 필요하다.** 안정적인 ID가 있으면 곡명 대신 매칭 키로 쓴다.
- 공식 기록에는 풀콤보 정보가 있으므로 `official_records.is_full_combo`로 받는다. 옵션 기록의 `is_full_combo`는 사용자가 입력한다.

#### 페이지별 읽기 계획 (2026-10-02 점검 기준)
**원칙: 사용자가 지금 열어 둔 공식 페이지의 내용만 읽는다.** 스크립트가 다른 페이지를 자동으로 불러오거나 여러 곡을 순회하지 않는다. 요청 수는 사람이 페이지를 연 횟수와 같다. 읽을 때 사용자에게 "이 화면의 n곡을 보낸다"를 보여 주고 확인을 받는다.

| 단계 | 사용자가 여는 페이지 | 읽는 값 | 요청 수 |
|---|---|---|---|
| 1 | `playdata/skill.html` (`stype=1`, HOT) | 곡명, 곡별 스킬, 달성률, 난도 값, 25행 | 사용자가 연 1번 |
| 2 | `playdata/skill.html?stype=0` (그 외) | 같음, 25행 | 사용자가 연 1번 |
| 3 | (선택) 곡의 `playdata/music_detail.html` | 8개 채보(Guitar 4 + Bass 4)의 달성률, FC, 플레이 횟수 등 | 곡마다 사용자가 연 1번 |
| - | (선택) `playdata/profile.html` | GF 스킬 합계 (계산 검증용, 닉네임·ID는 읽지 않는다) | 사용자가 연 1번 |

- **1~2단계만으로 스킬 목록 50곡(HOT 25 + 그 외 25)을 공식 값으로 채울 수 있다.** 스킬 목록 외 곡의 기록은 곡 상세를 열어 읽거나 직접 입력한다.
- 읽는 위치(변경될 수 있어 설정으로 분리, 8장 한계 참조):
  - 스킬 페이지: 표의 행마다 `.music_cell .skill_box .title a.text_link`(곡명), 같은 행의 곡별 스킬 · 달성률 · 난도 값 칸
  - 곡 상세: 채보마다 표 1개(`diff_area`의 `diff_MASTER` 등으로 난이도 구분, 표 맨 위가 레벨), 항목 칸 `td.idx_tb` + 값 칸 `td.r`, 달성 칸 `score_data_clear`, 랭크 칸 `score_data_rank`
- 읽지 않는 것: 프로필 ID·닉네임, 라이벌, 재킷 이미지, 공식 곡 목록 전체 (D7, D10).
- 일괄 읽기(곡 목록 순회)는 약관 (13), (19) 때문에 만들지 않는다. 만든다면 요청 사이 간격, 중단·이어하기, 사용자 확인을 넣는다.

#### 공식 페이지 구조 점검 결과 (2026-10-02, 본인 계정, 읽기 전용 점검)
기준 경로: `p.eagate.573.jp/game/gfdm/gitadora_galaxywave_delta/p/` (이하 생략). 점검 스크립트는 구조 요약만 읽고 어디로도 보내지 않았다.

| 경로 | 확인한 내용 | 가져오기 후보 |
|---|---|---|
| `music/index.html` | **공식 곡 목록.** 표 1개(약 468행, 곡명·아티스트·BSC/ADV/EXT/MAS 레벨 칸, 이벤트 구분 행). 페이지 넘김 없이 한 페이지에 전체. 사용자 기록이 아니라 **공식 곡 데이터**다 | 아니오 (D7·D10: 공식 곡 데이터는 복사하지 않는다. 곡 매칭 참고용으로만 검토) |
| `playdata/profile.html` | 플레이어 프로필, **GF/DM 스킬 합계**(소수 둘째 자리), 레벨 구간별 진행 막대(36칸). 링크 `?gtype=` 로 GF/DM 전환 | 스킬 합계는 D4 계산 검증용 비교값 후보 (프로필의 ID·이름은 가져오지 않는다) |
| `playdata/music.html` | **곡별 기록 목록.** 표 1개, 한 페이지에 곡 21개(곡당 2행, 약 42행). 열: 곡명 · BASIC · ADVANCE · EXTREME · MASTER. 칸에는 **랭크 아이콘**이 있고 숫자 달성률은 목록에 없는 것으로 보인다. 곡명 카테고리 선택(`cat`, 38개)과 `gtype`(GF/DM)은 **POST 폼**이다. 곡별 상세 링크 `music_detail.html?gtype&sid&index&cat&page` 가 곡마다 붙는다 | 후보. 목록만으로 달성률이 안 나오면 곡마다 상세 요청이 필요해 요청 수가 많다 (아래 주의) |
| `playdata/skill.html` | **스킬 대상곡.** 표 1개 25행. 열: 악보(곡명·재킷) · **곡별 스킬(pts)** · **달성률(소수 둘째 자리)** · **난도 값**. 링크 쿼리 `gtype`(`gf`/`dm`), `stype`(**1 = HOT, 0 = 그 외**, 사용자 확인)로 전환한다 | **핵심 후보.** 한 번에 25곡, 요청 수가 적다. 공식 스킬 값으로 D4 소수 처리 검증도 가능 |
| `playdata/music_detail.html` | **곡 상세 기록.** 쿼리 `gtype`(gf/dm)·`sid`·`index`·`cat`·`page`. **한 페이지에 한 곡의 8개 채보**(Guitar 4 + Bass 4) 표가 있고, 표마다 맨 위에 채보 레벨, 아래에 6행의 항목(첫 행이 플레이 횟수)과 5개 값 칸, 클리어 미터가 있다. **항목 6개: 플레이 횟수 · 클리어 횟수 · 최고 순위(랭크) · 달성률 · 높은 점수 · MAX COMBO** (확인 완료). **풀콤보(FC)는 항목 행이 아니라 칸의 클래스로 읽는다**: 달성 칸 `td.score_data_clear`의 클래스에 `FULL COMBO`가 붙고, 랭크 칸 `td.score_data_rank`의 클래스가 랭크 이름(예: `SS`)이다. **옵션별 구분도 없다**(공식 값은 옵션과 무관한 최고 기록) | **후보.** 곡 하나에 요청 1번이라 곡이 많으면 요청이 크게 늘어난다 |
| `playdata/stage_result.html`, `session_result.html`, `rival.html` | 스테이지·세션 결과, 라이벌 (아직 점검 전) | 미정 (라이벌은 타인 정보라 제외) |

- **`music/index.html` 표 구조 (2026-10-02 점검):** 468행. 열 수가 1(이벤트 구분 행), 6(머리글: 제목·아티스트·BSC·ADV·EXT·MAS), 8(곡의 첫 행: 재킷 칸, 제목, 아티스트, 파트 G 또는 B, 레벨 4개), 5(같은 곡의 둘째 행: 파트와 레벨 4개, 제목·아티스트는 위 행에 합쳐져 있음) 네 종류다. 파트 칸 클래스는 `type td_g` / `type td_b`, 레벨 칸 클래스는 `dif td_c1~c4`(BSC~MAS). 곡마다 기타/베이스 행이 따로 있다. 곡 고유 ID는 없다.
- 곡 고유 ID는 확인하지 못했다. 상세 링크의 `sid`는 같은 페이지의 여러 곡에서 같은 값(목록 위치를 뜻하는 `index`만 변함)이라 곡 ID로 보기 어렵다. 매칭은 곡명 정규화(D13)로 한다.
- **요청 수 주의**: `music.html`은 카테고리(38개) × 페이지(21곡씩) 단위라 전체를 읽으려면 수십 번의 요청이 필요하고, 숫자 달성률이 상세 페이지에만 있다면 곡마다 요청해야 한다. 한 번 누르기로 대량 요청을 보내는 방식은 약관 확인 전에는 피한다. **1차 후보는 `skill.html`(스킬 대상 50곡, 요청 2~4번)** 이다.
- **가져오기 방식 제안 ("지금 연 화면 읽기")**: 가져오기 스크립트는 **사용자가 지금 열어 둔 공식 페이지의 내용만 읽는다.** 추가 요청을 자동으로 보내지 않는다. `skill.html`을 열고 한 번(HOT), `stype=0`으로 바꿔 한 번(그 외), 특정 곡의 `music_detail.html`을 열고 한 번이다. 사람이 페이지를 여는 만큼만 요청이 나가므로 약관 확인 전에도 위험이 가장 낮다. 전체 곡 일괄 읽기는 약관 확인 후에 다시 정한다.
- 가져오기 필드 대응: `playCount`=플레이 횟수, `clearCount`=클리어 횟수, `rank`=최고 순위, `achievement`=달성률, `score`=높은 점수, `maxCombo`=MAX COMBO. 모두 위 계약의 선택 필드로 받을 수 있다.
- **`isFullCombo`**: `score_data_clear` 칸의 클래스가 `FULL COMBO`이면 true. **판단은 이것 하나만 한다.** 그 외 클래스(클리어, 실패 등)는 모두 FC가 아닌 것으로 본다. 달성률 100.00은 **EXC**로 처리하므로 EXCELLENT 표시를 따로 읽을 필요가 없다 (D9, 달성 단계는 계산).
- **`rank`**: `score_data_rank` 칸의 클래스 이름(게임 안의 랭크, 예: SS). S(80)·SS(95) 기준은 **실제 게임에도 적용되는 값이라 우리 달성 단계와 같다** (사용자 확인). 그래도 우리 단계는 달성률로 계산하고, 공식 랭크는 읽지 않아도 된다 (선택).
- 다음 점검: `music.html`의 페이지 이동 방식 (일괄 읽기를 하게 될 때만 필요).
- 점검 결과 파일에는 e-amusement ID와 닉네임이 섞여 나올 수 있다. 문서·저장소에 올리지 않는다.

#### 한계와 활용
- 공식 사이트는 **최고 달성률만** 준다. 옵션 정보는 없다.
- 가져온 최고 기록이 이전보다 올랐으면 "이번 갱신은 어떤 옵션이었나요?"를 물어 옵션 기록으로 이어준다.
- 공식 사이트 페이지 구조(URL의 버전 경로 `gitadora_galaxywave_delta`, 셀렉터)는 바뀔 수 있다. 버전/셀렉터는 설정으로 분리하고, 실패하면 유저에게 알린다.
- **약관 확인 결과 (2026-10-02, 일본판·해외판 모두 같은 내용, 법률 자문 아님):** e-amusement 사이트 이용약관을 직접 읽었다. 관련 조항은 일본판 제8조, 해외판 7조의 금지사항이다.
  - (13) 사이트 내용을 운영사의 명시적 허가 없이 **복제·전재·개변·게시**하는 행위 → 공식 곡 목록이나 기록 화면을 **서버에 저장해 서비스하는 것**은 이 조항에 걸릴 가능성이 높다.
  - (22) 운영사가 인정하지 않은 **자동 조작 도구·프로그램·매크로** 사용 → 스크립트가 페이지를 읽는 것은 자동 조작에 해당할 수 있다. 사람이 연 화면을 한 번 읽기만 해도 "운영사가 인정하지 않은 도구"라는 점은 남는다.
  - (23) 서비스의 운영 또는 내용에 관한 **프로그램을 개발·배포**하는 행위 → 확장 프로그램이나 북마클릿을 만들어 배포하는 것이 해당할 수 있다.
  - (19) 서버에 대한 부정 접근이나 운영 방해 → 곡 목록 순회처럼 요청을 많이 보내는 방식은 피한다.
  - 15조(저작권): 곡, 문장, 디자인 등 서비스의 모든 정보의 권리는 운영사에 있다.
  - 위반 시 이용 정지(8조 2항, 17조)가 있을 수 있고, 대상은 **그 사용자의 계정**이다.
  - 약관에 개인이 자기 기록을 가져가는 것을 허락하는 문구는 없다. 반대로 개인 기록의 개인 이용을 막는 문구도 없다. 위 조항들을 어떻게 해석할지는 운영사가 정한다.
  - **결론(설계 방침):** 공식 가져오기(확장, 북마클릿)는 약관상 **회색 지대가 아니라 위험이 있는 기능**으로 본다. 기본 입력은 **직접 입력과 사진 입력(D16)** 으로 하고, 공식 가져오기는 "사용자가 위험을 이해하고 직접 켜는 선택 기능"으로만 두며, 만들기 전에 운영사에 허가를 문의하는 것을 권한다. 공식 곡 목록(`music/index.html`)을 저장하거나 순회하는 기능은 만들지 않는다.
  - 사진 입력(D16)은 사용자가 찍은 사진을 올리는 것이라 위 조항(22, 23)과 직접 관련이 없다. 사진에 찍힌 게임 화면의 저작권은 별개이고, 우리는 사진을 저장하지 않으며 값(숫자)만 읽는다.
  - **비영리 유지 조건:** 약관 (12)는 운영사의 허가 없는 상업 목적 이용, 모금·후원금 수령을 금지한다. 비영리로 두려면 **광고, 유료 기능, 후원 버튼, 후원금 모집을 두지 않는다.** 비영리여도 (13), (22), (23)은 그대로 적용된다. 한국 저작권법의 데이터베이스제작자 권리에도 비영리 예외는 없고, 개인 사적이용 규정은 불특정 다수에게 제공하는 서비스에는 적용되지 않는다.
  - **권리 귀속 고지:** 곡, 음원, 재킷, 게임 화면, 로고, 명칭(GITADORA, e-amusement 등)을 포함한 **모든 저작권과 상표 등 권리는 KONAMI(또는 정보 제공원)에 있다**(약관 15.1). 우리 서비스는 비공식 팬 프로젝트이며 KONAMI와 무관하다. 이 고지를 모든 화면 하단과 소개 화면에 둔다.
  - 읽지 않은 문서: 사이트 정책(`etc/sitepolicy`), 마나&룰, KONAMI ID 이용약관. 필요하면 확인한다.

#### 스키마 원문

#### official_records (공식 최고 기록, 기존 `play_records`)
공식 사이트에서 가져온 곡별 최고 달성률. **옵션 정보가 없다.** 유저와 채보당 1행이며 가져올 때마다 갱신한다.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | BIGINT PK AI | |
| user_id | BIGINT FK | |
| difficulty_id | BIGINT FK | |
| achievement_rate | DECIMAL(5,2) | |
| official_skill_point | DECIMAL(6,2) NULL | 공식 값. **계산 검증용** |
| official_level | DECIMAL(4,2) NULL | 스킬 페이지의 난도 값. **레벨 검증용** (우리 채보 레벨과 다르면 알림) |
| clear_rank | VARCHAR(10) NULL | 공식 랭크 이름(선택). 우리 달성 단계는 달성률로 계산 |
| is_full_combo | BOOLEAN | 곡 상세 `score_data_clear` 클래스가 `FULL COMBO`인지 (D9). 스킬 페이지만 읽은 기록은 false(미확인) |
| play_count | INT NULL | 곡 상세에서 읽었을 때만 (선택). clear_count, 높은 점수, MAX COMBO는 필요해질 때 추가 |
| synced_at | DATETIME | 마지막으로 가져온 시각 |

- UNIQUE(user_id, difficulty_id)
- 가져온 값이 이전보다 올랐는지 비교해서 "새 최고 기록" 알림을 만든다. (Phase 2, 이력 테이블은 필요해질 때 추가)

보류된 테이블 (원래 6장 Phase 2 표)

| 테이블 | 용도 |
|---|---|
| import_tokens | 가져오기 전용 토큰. user_id, token_hash, last_used_at, revoked_at |
| import_unmatched | 가져온 데이터 중 마스터에 없는 곡(D13). user_id, raw_title, part, difficulty, level, achievement, is_full_combo, status(PENDING/APPROVED/REJECTED), first_seen_at, expires_at(기본 90일). 같은 (정규화 곡명, 파트, 난이도, 레벨)을 **몇 명이 올렸는지** 집계해서 ROOT 목록에 보여준다. 승인되면 대기 중이던 기록을 자동으로 연결한다 |

보류된 API (원래 10장)

| 영역 | 메서드 / 경로 | 권한 |
|---|---|---|
| 가져오기 토큰 | POST/DELETE `/import-tokens` (Phase 2) | USER+ |
| 공식 기록 가져오기 | POST `/imports/official` (Phase 2, 가져오기 토큰) | 토큰 |
