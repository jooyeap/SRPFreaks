import type { AchievementStage, DifficultyType, InstrumentPart, NoteOption } from "@/lib/types";

/** 인증 API 응답 타입 (백엔드 AuthResponse / UserResponse와 같은 모양). */

export type Role = "ROOT" | "ADMIN" | "USER";

export interface UserResponse {
  id: number;
  email: string;
  nickname: string | null;
  role: Role;
  /** 유저 목록·상세에 공개할지(D26). 기본 false. 닉네임이 없으면 켤 수 없다. */
  profilePublic: boolean;
  /** 라이벌 역전 알림 받기(D56). 기본 true. */
  rivalNotify: boolean;
  /** `서열표 변경 알림 받기`(D61). 기본 켜짐 */
  tierNotify: boolean;
  createdAt: string; // ISO 8601, UTC
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string; // "Bearer"
  expiresIn: number; // 초
  user: UserResponse;
}

/** 서버의 공통 오류 응답 (백엔드 ApiError). fieldErrors는 입력 검증 실패 때만 있다. */
export interface ApiErrorBody {
  code: string;
  message: string;
  timestamp: string;
  fieldErrors?: Record<string, string> | null;
}

// ---- 서열표 (백엔드 DifficultyTableResponse / TierGroupResponse / TableEntryResponse) ----------

/** 목록 응답 공통 형식 (백엔드 PageResponse). page는 0부터 시작한다. */
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export type TableStatus = "ACTIVE" | "INACTIVE";

export interface DifficultyTableResponse {
  id: number;
  name: string;
  instrumentPart: InstrumentPart;
  noteOption: NoteOption;
  status: TableStatus;
  revision: number;
}

/** 서열표 한 줄에 붙는 내 최고 기록. 기록이 없으면 TableEntryResponse.mine 자체가 null이다. */
export interface MyRecord {
  rate: number;
  fullCombo: boolean;
  stage: AchievementStage;
}

export interface TableEntryResponse {
  entryId: number;
  songDifficultyId: number;
  songId: number;
  title: string;
  addedVersion: string | null;
  part: InstrumentPart;
  difficulty: DifficultyType;
  level: number;
  tierUncertain: boolean;
  /** 시트와 같은 한글 값: 상 / 중 / 하 (없으면 null) */
  recommend: string | null;
  recommendUncertain: boolean;
  /** 단일 / 복합 / 이중 / 삼중 / 복합(단일) / 레이팅 제외 (없으면 null) */
  pattern: string | null;
  patternUncertain: boolean;
  /** 레이팅 반영 스위치(D28). 꺼져 있으면 기준 난이도·속성이 있어도 레이팅에서 빠진다. */
  ratingEnabled: boolean;
  mine: MyRecord | null;
}

/**
 * 기준 난이도 묶음. tier가 null이면 "미정" 묶음.
 * exc+fc+ss+s+belowS == recorded (기록 없는 채보는 어느 칩에도 세지 않는다, D24).
 */
export interface TierGroupResponse {
  tier: number | null;
  total: number;
  recorded: number;
  exc: number;
  fc: number;
  ss: number;
  s: number;
  belowS: number;
  /** 기록 있는 채보만의 평균. 기록이 없으면 null */
  averageRecorded: number | null;
  /** 기록 없는 채보를 0%로 넣은 평균 */
  averageWithZero: number;
  entries: TableEntryResponse[];
}

// ---- 레이팅 (백엔드 SkillResponse / SkillEntryResponse) --------------------------------------

/** 플레이어 티어. nextDisplayName/nextMinScore는 더 올라갈 구간이 없으면(최고 티어) null. */
export interface PlayerTierResponse {
  key: string;
  displayName: string;
  minScore: number;
  nextDisplayName: string | null;
  nextMinScore: number | null;
}

/** 레이팅 목록의 한 채보. 점수(score)는 서버가 소수 둘째 자리로 반올림해 내린 값이다. */
export interface SkillEntryResponse {
  rank: number; // 그룹(단일/그 외) 안의 순위, 1부터
  songDifficultyId: number;
  songId: number;
  title: string;
  part: InstrumentPart;
  difficulty: DifficultyType;
  level: number;
  tier: number; // 서열표 레이팅 상수 난이도 T
  pattern: string | null;
  achievementRate: number;
  fullCombo: boolean;
  stage: AchievementStage;
  ratingConstant: number; // R
  value: number; // V
  score: number; // V x 20
}

/** 내 레이팅 목록 (SRN+ 하나, 단일 15 + 그 외 25). 목록이 모자라면 있는 만큼만 들어 있다. */
export interface SkillResponse {
  noteOption: NoteOption;
  totalScore: number;
  singleScore: number;
  otherScore: number;
  tier: PlayerTierResponse;
  singleLimit: number;
  otherLimit: number;
  single: SkillEntryResponse[];
  other: SkillEntryResponse[];
}

/** 레이팅 스냅샷 한 줄 (D32). date는 Asia/Seoul 기준 날짜(YYYY-MM-DD), change는 바로 이전 스냅샷 대비 합계 증감(첫 줄이면 null). */
export interface SkillSnapshotResponse {
  id: number;
  date: string;
  totalScore: number;
  singleScore: number;
  otherScore: number;
  change: number | null;
}

/** 비교 결과의 곡 한 줄. 없는 쪽(새로 들어온 곡의 이전, 밀려난 곡의 이후)은 null이다. */
export interface SnapshotCompareChange {
  songDifficultyId: number;
  songId: number;
  title: string;
  part: InstrumentPart;
  difficulty: DifficultyType;
  group: "SINGLE" | "OTHER";
  rateBefore: number | null;
  rateAfter: number | null;
  scoreBefore: number | null;
  scoreAfter: number | null;
}

/** 비교할 수 없는 이유: 이전 스냅샷 없음 / 상세가 없는 예전 스냅샷 / 스냅샷 없음 */
export type SnapshotCompareReason = "NO_PREVIOUS" | "NO_DETAIL" | "NO_SNAPSHOT";

/** 레이팅 목록 비교 (D32 확장). toDate가 null이면 지금(계산한 현재 레이팅)과 비교한 것이다. */
export interface SnapshotCompareResponse {
  available: boolean;
  reason: SnapshotCompareReason | null;
  fromDate: string | null;
  toDate: string | null;
  fromTotal: number | null;
  toTotal: number | null;
  totalChange: number | null;
  entered: SnapshotCompareChange[];
  improved: SnapshotCompareChange[];
  declined: SnapshotCompareChange[];
  left: SnapshotCompareChange[];
}

/** 지금 기록할 수 있는지. 못 하면 reason에 이유 코드가 들어 있다. */
export type SnapshotBlockReason = "NO_CHANGE" | "NO_RECORDS";
export interface SkillSnapshotStatusResponse {
  available: boolean;
  reason: SnapshotBlockReason | null;
  /** 오늘 기록이 이미 있으면 true. 누르면 새 줄 대신 오늘 줄을 덮어쓴다(버튼은 `오늘 기록 갱신`, 2026-10-27) */
  replacesToday: boolean;
}

// ---- 곡 (백엔드 SongDetailResponse / DifficultyResponse) ----------------------------------

export type TitleKind = "ROMAJI" | "KANA" | "KO" | "ALIAS";

/** 곡의 채보 하나. noteCount는 비어 있을 수 있다(없어도 기능이 돌아가야 한다). */
export interface SongChartResponse {
  id: number;
  songId: number;
  instrumentPart: InstrumentPart;
  difficultyType: DifficultyType;
  level: number;
  noteCount: number | null;
}

export interface SongDetailResponse {
  id: number;
  title: string;
  artist: string | null;
  addedVersion: string | null;
  titleFolder: string | null;
  bpmMin: number | null;
  bpmMax: number | null;
  source: string | null;
  titles: { kind: TitleKind; title: string }[];
  difficulties: SongChartResponse[];
}

// ---- 유저 목록 / 유저 상세 (백엔드 PlayerSummaryResponse / PlayerDetailResponse, D26) ----------

/** 유저 목록의 한 줄. 이메일·역할 등은 서버가 내려 주지 않는다. userId는 상세 주소에 쓰는 식별자다(닉네임은 중복될 수 있다). */
export interface PlayerSummaryResponse {
  userId: number;
  rank: number;
  nickname: string;
  tier: PlayerTierResponse;
  totalScore: number;
}

/** 유저 상세(읽기 전용): 닉네임과 그 유저의 레이팅 목록. 내 레이팅(/skills/me)과 같은 모양이다. */
export interface PlayerDetailResponse {
  userId: number;
  nickname: string;
  skill: SkillResponse;
}

// ---- 전체 곡 목록 (백엔드 ChartFolderListResponse / ChartFolderResponse / ChartRowResponse, DESIGN-UI 9장) ----

/**
 * 레벨 폴더 하나(0.5 단위, 또는 그 안의 0.05 단위 하위 폴더). 칩 개수와 평균은 서열표 묶음과 같은 규칙이다(D24):
 * exc+fc+ss+s+belowS == recorded, 기록 없는 채보는 어느 칩에도 세지 않는다.
 */
export interface ChartFolderResponse {
  lo: number;
  hi: number;
  total: number;
  recorded: number;
  exc: number;
  fc: number;
  ss: number;
  s: number;
  belowS: number;
  /** 기록 있는 채보만의 평균. 기록이 없으면 null */
  averageRecorded: number | null;
  /** 기록 없는 채보를 0%로 넣은 평균 */
  averageWithZero: number;
  /** 그 안의 0.05 단위 하위 폴더(레벨 높은 순, 같은 통계). 하위 폴더 자신은 빈 배열 */
  subFolders: ChartFolderResponse[];
}

export interface ChartFolderListResponse {
  totalSongs: number;
  totalCharts: number;
  versions: string[];
  folders: ChartFolderResponse[];
}

/** 곡 목록의 채보 한 줄. 전체 곡 목록에는 속성을 보이지 않으므로 서열표 값은 없다. */
export interface ChartRowResponse {
  songDifficultyId: number;
  songId: number;
  title: string;
  addedVersion: string | null;
  part: InstrumentPart;
  difficulty: DifficultyType;
  level: number;
  mine: MyRecord | null;
}

// ---- 마이페이지 통계 (백엔드 RateFolderListResponse / RateFolderResponse / RateBucketResponse) ----

/** 달성률 구간. 내 대표 기록(최고 달성률) 기준으로 서로 겹치지 않고, 경계는 아래쪽 값을 포함한다. 서버의 RateBucket과 같은 이름이다. */
export type RateBucketKey = "R95" | "R90" | "R85" | "R80" | "R73" | "BELOW" | "UNPLAYED";

/** 구간 하나의 채보 수. exc = 달성률 100.00(MAX)인 수, fc = 풀콤보이면서 100 미만인 수(둘은 겹치지 않는다). */
export interface RateBucketResponse {
  bucket: RateBucketKey;
  count: number;
  exc: number;
  fc: number;
}

/**
 * 폴더 하나. key는 레벨 폴더면 시작 레벨(9.5 = 9.50~9.99), 서열표 난이도면 레이팅 상수 난이도(5.8). buckets는 항상 7개다.
 * 평균은 곡 목록·서열표와 같다: averageRecorded = 기록 있는 채보만(없으면 null), averageWithZero = 기록 없는 채보를 0%로 넣은 값.
 */
export interface RateFolderResponse {
  key: number;
  total: number;
  recorded: number;
  averageRecorded: number | null;
  averageWithZero: number;
  buckets: RateBucketResponse[];
}

export interface RateFolderListResponse {
  folders: RateFolderResponse[];
}

// ---- 관리 (ROOT 전용, 백엔드 AuditLogResponse) ----------------------------------------------------

/** 감사 로그 한 줄. 작업한 사람이 탈퇴했으면 actorId·actorNickname이 null이다. detail은 작업마다 모양이 달라 읽기만 한다. */
export interface AuditLogResponse {
  id: number;
  actorId: number | null;
  actorNickname: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

/** 운영 설정 한 줄(백엔드 SettingResponse). updatedByNickname이 null이면 처음 값이거나 바꾼 사람이 탈퇴한 것이다. */
export interface SettingResponse {
  key: string;
  value: string;
  updatedByNickname: string | null;
  updatedAt: string;
}

/** 관리 화면(ROOT)의 사용자 한 줄(백엔드 AdminUserResponse). Google ID는 오지 않는다. */
export interface AdminUserResponse {
  id: number;
  email: string;
  nickname: string | null;
  role: Role;
  status: "ACTIVE" | "BLOCKED";
  createdAt: string;
}

// ---- 공지사항 (D30, 백엔드 NoticeResponse) --------------------------------------------------------

/** 공지 한 건. 쓴 사람은 내려오지 않는다. 본문은 글자(plain text)다. */
export interface NoticeResponse {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

/** 곡 검색 오타 보정 후보 (GET /songs/suggest). matchedText는 검색어와 닮은 표기(본명 또는 별칭)다. */
export interface SongSuggestionResponse {
  songId: number;
  title: string;
  artist: string | null;
  matchedText: string;
}

// ---- 건의사항 (D35, 백엔드 SuggestionResponse / AdminSuggestionResponse) ---------------------------

export type SuggestionCategory = "SONG_REQUEST" | "IMPROVEMENT" | "BUG" | "OTHER";
export type SuggestionStatus = "RECEIVED" | "REVIEWING" | "DONE" | "REJECTED";

/** 내 건의 한 건. 처리 상태와 관리자 답변(없으면 null)이 함께 온다. */
export interface SuggestionResponse {
  id: number;
  category: SuggestionCategory;
  title: string;
  content: string;
  /** 곡 추가 건의에서 요청한 채보. 없으면 둘 다 null (한 쌍이다). */
  requestedPart: InstrumentPart | null;
  requestedDifficulty: DifficultyType | null;
  status: SuggestionStatus;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 관리자 목록의 한 건. 보낸 사람은 닉네임만 온다. */
export interface AdminSuggestionResponse extends SuggestionResponse {
  authorNickname: string;
}

// ---- 세트리스트 (D36, 백엔드 SetlistItemResponse) ---------------------------------------------------

/**
 * 세트리스트 한 줄. tier는 서열표의 레이팅 상수 난이도(서열표에 없거나 미정이면 null), mine은 내 최고 기록(없으면 null).
 * done은 담은 뒤에 이 채보 기록을 저장·수정했는지(서버가 계산한 값)다.
 */
export interface SetlistItemResponse {
  id: number;
  songDifficultyId: number;
  songId: number;
  title: string;
  part: InstrumentPart;
  difficulty: DifficultyType;
  level: number;
  tier: number | null;
  /** 서열표의 속성 글자(단일 / 복합 / 이중 / 삼중 / 복합(단일) / 레이팅 제외). 서열표에 없으면 null. */
  pattern: string | null;
  mine: MyRecord | null;
  done: boolean;
  createdAt: string;
}

// ---- 내 리스트 (D76, 백엔드 UserList*Response) -----------------------------------------------------------

/** 리스트 한 줄. itemCount는 삭제된 채보를 뺀 곡 수, contains는 `songDifficultyId`로 물었을 때만 그 채보가 담겼는지(아니면 false). */
export interface UserListSummaryResponse {
  id: number;
  name: string;
  itemCount: number;
  contains: boolean;
}

/** 리스트 안의 한 곡. 세트리스트 줄(SetlistItemResponse)에서 완료 표시(done)만 없다. */
export interface UserListItemResponse {
  id: number;
  songDifficultyId: number;
  songId: number;
  title: string;
  part: InstrumentPart;
  difficulty: DifficultyType;
  level: number;
  tier: number | null;
  pattern: string | null;
  mine: MyRecord | null;
  createdAt: string;
}

export interface UserListDetailResponse {
  id: number;
  name: string;
  itemCount: number;
  items: PageResponse<UserListItemResponse>;
}

/** 이미 담겨 있던 곡을 다시 담아도 오류가 아니다: alreadyContained가 true로 온다(HTTP 200). */
export interface UserListAddItemResponse {
  alreadyContained: boolean;
  itemCount: number;
}

// ---- 세트리스트 추천 (D37, 백엔드 SetlistRecommendationResponse) ---------------------------------------

/** 추천 한 줄. mine은 내 SRN+ 최고 기록(없으면 null). */
export interface RecommendationItem {
  songDifficultyId: number;
  songId: number;
  title: string;
  part: InstrumentPart;
  difficulty: DifficultyType;
  level: number;
  tier: number;
  /** 서열표의 속성 글자(없으면 null). */
  pattern: string | null;
  mine: MyRecord | null;
}

/** 추천 상태. READY = 평균 기준, STARTER = 기록 없는 신규(입문 난이도 이하), INSUFFICIENT = 단일/그 외 데이터 부족, UNAVAILABLE = 서열표 없음. */
export type RecommendationStatus = "READY" | "STARTER" | "INSUFFICIENT" | "UNAVAILABLE";

/**
 * 세트리스트 추천. status에 따라 화면이 달라진다.
 * READY: baseTier = 내 평균 난이도. ssChallenge = 평균 + ssMin~ssMax 안에서 기록이 없거나 SS 미만(SS 기준),
 *        sFill = 평균 + sMin~sMax 안에서 기록이 없거나 S 미만이며 SS 기준에 없는 것(S 기준). 범위 값은 평균 대비 차이(음수 = 더 쉬운 곡).
 * STARTER: baseTier = 입문 기준 난이도(이 이하만 sFill에 온다), ssChallenge는 비어 있다.
 * INSUFFICIENT: 목록은 비어 있고 ratedSingle·ratedOther와 requiredSingle·requiredOther 개수로 안내한다. baseTier는 null.
 * 두 묶음은 같은 page로 묶음마다 size개씩 온다. totalPages는 둘 중 긴 쪽 기준.
 */
export interface SetlistRecommendationResponse {
  status: RecommendationStatus;
  baseTier: number | null;
  ssMin: number;
  ssMax: number;
  sMin: number;
  sMax: number;
  /** 사용자가 직접 정한 범위를 쓰면 true(기본 범위면 false). */
  customRange: boolean;
  ratedSingle: number;
  ratedOther: number;
  requiredSingle: number;
  requiredOther: number;
  ssChallenge: RecommendationItem[];
  sFill: RecommendationItem[];
  /** 두 묶음은 각자 자기 쪽을 넘긴다. */
  ssPage: number;
  sPage: number;
  size: number;
  ssTotalPages: number;
  sTotalPages: number;
}

/** 곡 상세의 서열표 변경 이력 한 줄 (D45). 누가 바꿨는지는 내려오지 않는다. created면 "서열표에 추가"이고 before* 값은 null이다. */
export interface TierHistoryResponse {
  changedAt: string; // ISO 8601, UTC
  created: boolean;
  songDifficultyId: number;
  part: InstrumentPart;
  difficulty: DifficultyType;
  level: number;
  beforeTier: number | null;
  afterTier: number | null;
  beforePattern: string | null;
  afterPattern: string | null;
  /** 추천도 전·후(2026-11-01부터 이력에 포함) */
  beforeRecommend: string | null;
  afterRecommend: string | null;
}

/** 사이트 전체 서열표 변경 목록(D58, 공지 화면 `서열표 변경` 탭) 한 줄. 바꾼 사람은 없다. */
export interface TierChangeResponse extends TierHistoryResponse {
  songId: number;
  title: string;
  beforeRecommend: string | null;
  afterRecommend: string | null;
}

/* ---------- 라이벌 (D56) ---------- */

/** 곡별 승패 개수. 둘 다 기록 있는 채보만 승/패/무, 상대만 기록 있으면 theirsOnly. */
export interface RivalCounts {
  win: number;
  lose: number;
  tie: number;
  theirsOnly: number;
  /** 나만 기록한 레이팅 대상 곡 수(곡별 승패 응답에만, 승패에 세지 않는다. 옛 응답에는 없을 수 있다). */
  onlyMine?: number;
}

/** 라이벌 카드의 "상대 상위 곡" 한 칸(3단계, D65): 재킷을 찾을 곡 id와 그 곡의 화면 점수(둘째 자리). */
export interface RivalTopSong {
  songId: number;
  score: number;
}

/**
 * 내 라이벌 한 줄. available=false(상대가 비공개·차단)면 닉네임만 오고 나머지는 null. scoreDiff = 상대 총점 - 내 총점(서버 값 그대로). 화면은 비교 화면과 같은 부호(내 − 상대)로 `myScoreDiff`에서 한 번만 뒤집어 쓴다.
 * topSongs = 상대 레이팅 목록의 상위 곡 최대 5곡(점수 내림차순, 곡마다 한 번). 구버전 응답에는 없다(없으면 줄을 그리지 않는다).
 */
export interface RivalResponse {
  userId: number;
  nickname: string | null;
  available: boolean;
  mutual: boolean;
  tier: PlayerTierResponse | null;
  totalScore: number | null;
  scoreDiff: number | null;
  counts: RivalCounts | null;
  topSongs?: RivalTopSong[] | null;
}

/** 나를 라이벌로 등록한 공개 유저 한 줄(D63). mutual = 내가 그 사람도 등록함(서로 라이벌). 이메일·역할은 오지 않는다. */
export interface RivalRegistrantResponse {
  userId: number;
  nickname: string;
  tier: PlayerTierResponse;
  mutual: boolean;
}

export interface RivalStatusResponse {
  registered: boolean;
  mutual: boolean;
  count: number;
  max: number;
}

/** 상대 레이팅 목록 한 줄 + 같은 채보의 내 기록(없으면 my*·diff가 null). diff = 내 점수 - 상대 점수. */
export interface RivalRatingRow {
  rank: number;
  songDifficultyId: number;
  songId: number;
  title: string;
  part: InstrumentPart;
  difficulty: DifficultyType;
  level: number;
  tier: number;
  /** 속성(`단일` 등, 없으면 null). 줄 윗줄의 `속성 | 서열 난이도`에 쓴다(D65) */
  pattern: string | null;
  rate: number;
  stage: AchievementStage;
  score: number;
  myRate: number | null;
  myScore: number | null;
  diff: number | null;
}

export interface RivalCompareRatingResponse {
  userId: number;
  nickname: string;
  tier: PlayerTierResponse;
  totalScore: number;
  myTier: PlayerTierResponse;
  myTotalScore: number;
  counts: RivalCounts;
  single: RivalRatingRow[];
  other: RivalRatingRow[];
}

/** 라이벌 대시보드(D67)의 속성 키. 속성 한 줄의 `key`이자 카테고리 상세 주소의 마지막 조각이다. */
export type RivalPatternKey = "SINGLE" | "COMPOUND" | "COMPOSITE_SINGLE" | "DOUBLE" | "TRIPLE";

/**
 * 속성 한 줄(D67). pattern은 화면 라벨(`복합(단일)` 등).
 * wins·ties·losses·closeCount는 **달성률 차 기준**(D67 개정, 2026-11-09): diff = 내 달성률 − 상대 달성률(%p), 승 > 0 · 패 < 0 · 무 = 0 · 접전 |diff| ≤ 1.00.
 * scoreDiffSum(점수 차 합계)은 옛 필드로 남겨 두었고 판정·정렬에는 쓰지 않는다.
 */
export interface RivalPatternSummary {
  pattern: string;
  key: RivalPatternKey;
  wins: number;
  ties: number;
  losses: number;
  scoreDiffSum: number;
  closeCount: number;
  sharedCount: number;
  /** 공유 곡마다 (내 달성률 − 상대 달성률)의 평균(%, 소수 첫째 자리). 공유 곡이 없으면 null. 화면에 보이는 값이고 우세·열세를 고르는 기준이다(D67 개정). 옛 응답에는 없을 수 있다. */
  rateDiffAvg?: number | null;
  /** 상대만 기록한(나는 기록이 없는) 레이팅 대상 곡 수. 승·무·패·평균에 넣지 않는다(D67 개정). 옛 응답에는 없을 수 있다. */
  onlyTheirs?: number;
  /** 나만 기록한 레이팅 대상 곡 수. 승·무·패·평균에 넣지 않는다(D67 개정). 옛 응답에는 없을 수 있다. */
  onlyMine?: number;
  /**
   * 레이팅 목록(단일 15 + 그 외 25) 기준 속성별 점수 차 = 내 목록 점수 합 − 상대 목록 점수 합(소수 둘째 자리, 2026-11-10).
   * 공유 곡 기준인 scoreDiffSum과 다른 값이다. 계산할 수 없거나 옛 응답이면 없음/null.
   * 화면은 쓰지 않는다. 레이팅 목록 40칸 구성 차이라 속성 우세와 맞지 않아 표시하지 않기로 함(2026-11-10).
   */
  ratingScoreDiff?: number | null;
}

/** 서열 난이도(0.1 단위) 한 줄. 공유 곡이 있는 난이도만, 높은 난이도 먼저. 화면은 아직 쓰지 않는다(타입만). */
export interface RivalTierSummary {
  tier: number;
  wins: number;
  ties: number;
  losses: number;
}

/** 점 분포 차트용: 속성별 곡마다의 차이(곡 id 없음), 작은 값부터. `distribution`은 점수 차(옛 필드), `rateDistribution`은 달성률 차(%p). */
export interface RivalPatternDiffs {
  pattern: string;
  key: RivalPatternKey;
  diffs: number[];
}

/** GET /players/{id}/compare/summary. 속성 다섯 줄은 공유 곡이 없어도 항상 같은 순서로 온다. 서열 난이도별(`tiers`)은 화면이 아직 쓰지 않는다. */
export interface RivalSummaryResponse {
  userId: number;
  nickname: string;
  closeMargin: number;
  totals: { wins: number; ties: number; losses: number; closeCount: number; sharedCount: number; scoreDiffSum: number };
  patterns: RivalPatternSummary[];
  tiers: RivalTierSummary[];
  /** 점수 차 분포(옛 필드, 화면은 쓰지 않는다). */
  distribution: RivalPatternDiffs[];
  /** 달성률 차(%p) 분포. 점 분포 차트가 쓴다. 옛 응답에는 없을 수 있다(그 경우 점 분포는 `–`로 비어 보인다). */
  rateDistribution?: RivalPatternDiffs[];
}

export type RivalDetailFilter = "ALL" | "LOSE" | "CLOSE" | "WIN" | "THEIRS_ONLY";
export type RivalDetailSort = "DIFF_ASC" | "DIFF_DESC" | "CLOSE" | "TITLE";

/** 속성별 곡 목록의 한 줄. rate·stage·score는 상대, myRate·myStage·myScore는 나(둘 다 기록이 있는 곡만 나온다). */
export interface RivalDetailRow {
  songDifficultyId: number;
  songId: number;
  title: string;
  part: InstrumentPart;
  difficulty: DifficultyType;
  level: number;
  tier: number | null;
  pattern: string | null;
  rate: number;
  stage: AchievementStage;
  score: number;
  /** 나 쪽 값. 상대만 필터(THEIRS_ONLY)의 줄은 내 기록이 없어 null이다. */
  myRate: number | null;
  myStage: AchievementStage | null;
  myScore: number | null;
  /** 점수 차(옛 필드). 판정·정렬에는 쓰이지 않는다. */
  diff: number | null;
  /** 달성률 차(%p) = myRate − rate. 판정·정렬 기준(D67 개정). 옛 응답에는 없을 수 있어 없으면 myRate − rate로 계산한다. */
  rateDiff?: number | null;
}

/** 속성 안 서열 난이도(0.1 단위) 한 줄(2026-11-10). 승·무·패·접전은 달성률 차 기준, rateDiffAvg는 공유 곡 평균 달성률 차(%p). */
export interface RivalDetailTier {
  tier: number;
  wins: number;
  ties: number;
  losses: number;
  closeCount: number;
  sharedCount: number;
  rateDiffAvg: number | null;
}

export interface RivalSummaryDetailResponse {
  userId: number;
  nickname: string;
  summary: RivalPatternSummary;
  filterCounts: { all: number; lose: number; close: number; win: number; theirsOnly?: number };
  /** 난이도대별 집계. 옛 응답에는 없을 수 있다. */
  tiers?: RivalDetailTier[];
  rows: PageResponse<RivalDetailRow>;
}

export type RivalResult = "WIN" | "LOSE" | "TIE" | "THEIRS_ONLY";

/** 곡별 승패 한 줄. myRate는 상대만 기록 있는 줄이면 null. diff = 내 달성률 - 상대 달성률. */
export interface RivalChartRow {
  songDifficultyId: number;
  songId: number;
  title: string;
  part: InstrumentPart;
  difficulty: DifficultyType;
  level: number;
  myRate: number | null;
  theirRate: number;
  diff: number | null;
  /** 서열표 기준 난이도(D67 개정). 곡별 승패 줄 윗줄 `속성 | 난이도`의 값. 옛 응답에는 없을 수 있다(없으면 `–`로 보인다). */
  tier?: number | null;
  /** 속성 라벨(`복합(단일)` 등, 속성 상세 목록 줄과 같은 형식). 옛 응답에는 없을 수 있다. */
  pattern?: string | null;
}

export interface RivalCompareChartsResponse {
  counts: RivalCounts;
  page: PageResponse<RivalChartRow>;
}

/** 곡 상세의 라이벌 기록 한 줄. rate = 상대 기록(없으면 null), diff = 내 기록 - 상대 기록, stage = 상대 기록의 달성 단계(D65, 기록이 없으면 null). */
export interface RivalRecordResponse {
  userId: number;
  nickname: string;
  rate: number | null;
  diff: number | null;
  stage?: AchievementStage | null;
}

/** 알림 종류(D61). 화면은 줄 앞 칩(`라이벌` / `서열표`)으로 구분한다. */
export type NotificationKind = "RIVAL" | "TIER";

/** 두 종류 알림이 같이 가진 값. bundled면 songCount곡(채보)을 묶은 줄이고 곡 정보는 첫 곡. visibleAt = 정렬·`n분 전` 시각. */
interface NotificationBase {
  id: number;
  songId: number;
  songDifficultyId: number;
  title: string;
  part: InstrumentPart;
  difficulty: DifficultyType;
  level: number;
  bundled: boolean;
  songCount: number;
  visibleAt: string;
  read: boolean;
}

/** 라이벌 역전 알림 한 줄(D56). myRate = 내 기록. */
export interface RivalNotificationResponse extends NotificationBase {
  kind: "RIVAL";
  actorUserId: number;
  actorNickname: string | null;
  actorRate: number;
  myRate: number;
}

/**
 * 서열표 변경 알림 한 줄(D61). 기준 난이도 null = 미정. 점수는 알림을 만든 때의 내 달성률(myRate)로 계산한 전·후(둘째 자리),
 * 미정이면 null. scoreDiff = 후 - 전(둘 다 있을 때만).
 */
export interface TierNotificationResponse extends NotificationBase {
  kind: "TIER";
  myRate: number;
  beforeTier: number | null;
  afterTier: number | null;
  beforeScore: number | null;
  afterScore: number | null;
  scoreDiff: number | null;
}

/**
 * 알림 목록의 한 줄. `kind`로 어느 쪽인지 고른다("구별된 유니온"): `if (item.kind === "TIER")` 안에서는
 * TypeScript가 item을 TierNotificationResponse로 좁혀 주므로 beforeTier 같은 값을 바로 쓸 수 있다.
 */
export type NotificationResponse = RivalNotificationResponse | TierNotificationResponse;
