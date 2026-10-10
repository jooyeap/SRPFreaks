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
