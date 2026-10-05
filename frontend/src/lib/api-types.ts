import type { AchievementStage, DifficultyType, InstrumentPart, NoteOption } from "@/lib/types";

/** 인증 API 응답 타입 (백엔드 AuthResponse / UserResponse와 같은 모양). */

export type Role = "ROOT" | "ADMIN" | "USER";

export interface UserResponse {
  id: number;
  email: string;
  nickname: string | null;
  role: Role;
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
