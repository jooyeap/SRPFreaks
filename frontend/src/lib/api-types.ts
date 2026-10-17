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
  /** 단일 / 복합 / 이중 / 삼중 / 레이팅 제외 (없으면 null) */
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
export type SnapshotBlockReason = "ALREADY_TODAY" | "NO_CHANGE" | "NO_RECORDS";
export interface SkillSnapshotStatusResponse {
  available: boolean;
  reason: SnapshotBlockReason | null;
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
  mine: MyRecord | null;
  done: boolean;
  createdAt: string;
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
  mine: MyRecord | null;
}

/**
 * 세트리스트 추천. baseTier = 내 평균 난이도(레이팅 상수 난이도 기준)이고, 추정할 근거가 모자라면 null(목록도 비어 있다).
 * ssChallenge = 평균 ± rangeSs 안에서 기록이 없거나 SS 미만, sFill = 평균 ± rangeS 안에서 기록이 없거나 S 미만이며 SS 도전에 없는 것.
 * 두 묶음은 같은 page로 묶음마다 size개씩 온다. totalPages는 둘 중 긴 쪽 기준.
 */
export interface SetlistRecommendationResponse {
  baseTier: number | null;
  rangeSs: number;
  rangeS: number;
  ssChallenge: RecommendationItem[];
  sFill: RecommendationItem[];
  page: number;
  size: number;
  totalPages: number;
}
