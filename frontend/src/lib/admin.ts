import { apiFetch } from "@/lib/api";
import type { AdminUserResponse, AuditLogResponse, PageResponse, Role, SettingResponse } from "@/lib/api-types";

/** 관리(ROOT) 쿼리 키. 보는 사람(viewerId)을 넣는 이유는 다른 화면과 같다(계정이 바뀌어도 이전 캐시가 보이지 않게). */
export const adminKeys = {
  all: ["admin"] as const,
  auditLogs: (viewerId: number, page: number) => ["admin", "audit-logs", viewerId, page] as const,
  settings: (viewerId: number) => ["admin", "settings", viewerId] as const,
  users: (viewerId: number, page: number) => ["admin", "users", viewerId, page] as const,
};

export const AUDIT_LOG_PAGE_SIZE = 30;

export function fetchAuditLogs(page: number, size: number, signal?: AbortSignal): Promise<PageResponse<AuditLogResponse>> {
  return apiFetch<PageResponse<AuditLogResponse>>("/admin/audit-logs", { query: { page, size }, signal });
}

/** 서버가 남기는 작업 종류(action)의 화면 이름. 목록에 없는 값은 코드 그대로 보여 준다(서버에 새 종류가 생겨도 화면이 깨지지 않는다). */
const ACTION_LABELS: Record<string, string> = {
  SONG_CREATE: "곡 등록",
  SONG_UPDATE: "곡 수정",
  SONG_DELETE: "곡 삭제",
  DIFFICULTY_CREATE: "채보 등록",
  DIFFICULTY_UPDATE: "채보 수정",
  DIFFICULTY_DELETE: "채보 삭제",
  TABLE_ENTRY_CREATE: "서열표에 채보 추가",
  TABLE_ENTRY_UPDATE: "서열표 값 수정",
  USER_ROLE_CHANGE: "역할 변경",
  RECORD_ADMIN_DELETE: "유저 기록 삭제",
  NOTICE_CREATE: "공지 등록",
  NOTICE_UPDATE: "공지 수정",
  NOTICE_DELETE: "공지 삭제",
  SETTING_UPDATE: "설정 변경",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/**
 * 감사 로그의 detail(JSON)을 한 줄 글자로 줄인다. 값이 길면 자르고, 객체는 JSON으로 보여 준다.
 * 화면에서 해석하지 않고 서버가 남긴 그대로 보여 주는 이유: 작업마다 모양이 다르고, 기록은 있는 그대로 읽는 것이 맞다.
 */
export function detailText(detail: Record<string, unknown> | null, maxLength = 300): string {
  if (!detail || Object.keys(detail).length === 0) {
    return "";
  }
  const text = JSON.stringify(detail);
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

// ---- 운영 설정 --------------------------------------------------------------------------------------

/** 설정은 십여 개뿐이라 한 번에 받는다(서버 최대 100). */
export function fetchSettings(signal?: AbortSignal): Promise<PageResponse<SettingResponse>> {
  return apiFetch<PageResponse<SettingResponse>>("/admin/settings", { query: { page: 0, size: 100 }, signal });
}

export function updateSetting(key: string, value: string): Promise<SettingResponse> {
  // 키에는 점(.)이 들어 있다. 서버 경로 변수로 그대로 받으므로 인코딩만 한다.
  return apiFetch<SettingResponse>(`/admin/settings/${encodeURIComponent(key)}`, { method: "PATCH", body: { value } });
}

/** 값의 종류. number = 소수 가능한 숫자, integer = 0 이상 정수, boolean = true/false, text = 글자. */
export type SettingKind = "number" | "integer" | "boolean" | "choice" | "text";

export interface SettingMeta {
  label: string;
  description: string;
  kind: SettingKind;
  /** kind가 choice일 때 고를 수 있는 값 */
  choices?: readonly string[];
}

/**
 * 화면에 보여 줄 설정 설명. 서버가 값을 최종 검사하므로(레이팅 계산에 쓸 수 있는 값인지) 여기 종류는 입력을 돕고
 * 뻔한 실수를 먼저 막는 용도다. 목록에 없는 키는 글자(text)로 다룬다.
 */
export const SETTING_META: Record<string, SettingMeta> = {
  "rating.pivot": { label: "레이팅 상수 난이도 경계", description: "이 값보다 크면 높은 구간 식, 아니면 낮은 구간 식으로 상수를 구합니다.", kind: "number" },
  "rating.high_slope": { label: "높은 구간 기울기", description: "R = 기울기 × T − 절편 (T > 경계)", kind: "number" },
  "rating.high_offset": { label: "높은 구간 절편", description: "R = 기울기 × T − 절편 (T > 경계)", kind: "number" },
  "rating.low_slope": { label: "낮은 구간 기울기", description: "R = 기울기 × T − 절편 (T ≤ 경계)", kind: "number" },
  "rating.low_offset": { label: "낮은 구간 절편", description: "R = 기울기 × T − 절편 (T ≤ 경계)", kind: "number" },
  "rating.cap_rate": { label: "기본 반영 달성률", description: "이 달성률까지는 상수 R에 비례해 점수가 오릅니다.", kind: "number" },
  "rating.max_rate": { label: "보너스 만점 달성률", description: "보너스는 이 달성률에서 최대가 됩니다. 기본 반영 달성률보다 커야 합니다.", kind: "number" },
  "rating.bonus": { label: "보너스", description: "기본 반영 달성률을 넘은 구간에서 최대로 더해지는 값입니다.", kind: "number" },
  "rating.score_multiplier": { label: "점수 배수", description: "채보 값 V에 곱해 화면 점수로 씁니다.", kind: "number" },
  "rating.list_single": { label: "단일 목록 개수", description: "레이팅에 합산하는 속성 단일 채보 수입니다.", kind: "integer" },
  "rating.list_other": { label: "복합·이중·삼중 목록 개수", description: "레이팅에 합산하는 그 외 속성 채보 수입니다.", kind: "integer" },
  "rating.note_option": { label: "레이팅 노트 옵션", description: "레이팅과 서열표가 쓰는 노트 옵션입니다.", kind: "choice", choices: ["SUPER_RANDOM_PLUS"] },
  "ui.show_song_images": { label: "재킷 이미지 표시", description: "켜면 이미지 주소가 있는 곡에 재킷을 보여 주는 설정입니다. 재킷 칸이 지금 화면에서 숨겨져 있어 아직 쓰이지 않습니다.", kind: "boolean" },
  "contact.takedown_email": { label: "삭제 요청 연락처", description: "삭제 요청을 받는 이메일로 기록해 두는 값입니다. 푸터 문구는 아직 이 값을 읽지 않습니다.", kind: "text" },
};

export function settingMeta(key: string): SettingMeta {
  return SETTING_META[key] ?? { label: key, description: "", kind: "text" };
}

const DECIMAL = /^-?\d+(\.\d+)?$/;
const INTEGER = /^\d+$/;

/** 저장 전 입력 검사. 문제가 없으면 null, 있으면 화면에 보여 줄 문구. */
export function validateSettingValue(key: string, raw: string): string | null {
  const value = raw.trim();
  if (value === "") {
    return "값을 입력해 주세요.";
  }
  const meta = settingMeta(key);
  if (meta.kind === "number" && !DECIMAL.test(value)) {
    return "숫자로 입력해 주세요.";
  }
  if (meta.kind === "integer" && !INTEGER.test(value)) {
    return "0 이상의 정수로 입력해 주세요.";
  }
  if (meta.kind === "boolean" && value !== "true" && value !== "false") {
    return "켬 또는 끔을 골라 주세요.";
  }
  if (meta.kind === "choice" && !(meta.choices ?? []).includes(value)) {
    return "고를 수 있는 값이 아닙니다.";
  }
  if (value.length > 500) {
    return "값은 500자 이하여야 합니다.";
  }
  return null;
}

/** 설정을 바꾸면 레이팅 계산과 그 결과(내 레이팅, 유저 목록 총점)가 달라질 수 있어 함께 새로 받는다. */
export const SETTING_AFFECTED_KEYS = [["admin"], ["skill"], ["players"]] as const;

// ---- 사용자 / 역할 ------------------------------------------------------------------------------------

export const ADMIN_USERS_PAGE_SIZE = 30;

/** 화면에서 고를 수 있는 역할. ROOT로 바꾸는 기능은 없다(ROOT는 환경변수로만 만든다). */
export const ASSIGNABLE_ROLES = ["USER", "ADMIN"] as const;

const ROLE_LABELS: Record<Role, string> = { ROOT: "운영자(ROOT)", ADMIN: "관리자(ADMIN)", USER: "일반 사용자(USER)" };

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}

export function fetchAdminUsers(page: number, size: number, signal?: AbortSignal): Promise<PageResponse<AdminUserResponse>> {
  return apiFetch<PageResponse<AdminUserResponse>>("/admin/users", { query: { page, size }, signal });
}

export function changeUserRole(userId: number, role: Role): Promise<AdminUserResponse> {
  return apiFetch<AdminUserResponse>(`/admin/users/${userId}/role`, { method: "PATCH", body: { role } });
}

// ---- 관리 메뉴 / 역할 조건 ------------------------------------------------------------------------------

const ROLE_RANK: Record<Role, number> = { USER: 0, ADMIN: 1, ROOT: 2 };

/** 역할이 기준 이상인지. 서버의 RoleHierarchy(ROOT > ADMIN > USER)와 같은 순서다. 화면을 보이게 할지 정하는 데만 쓰고, 권한은 서버가 검사한다. */
export function hasRoleAtLeast(role: Role | null | undefined, minRole: Role): boolean {
  return role !== null && role !== undefined && ROLE_RANK[role] >= ROLE_RANK[minRole];
}

/** 헤더의 `관리` 메뉴와 관리 메뉴 화면을 볼 수 있는 역할(ADMIN, ROOT). */
export function canSeeAdminMenu(role: Role | null | undefined): boolean {
  return hasRoleAtLeast(role, "ADMIN");
}

export interface AdminMenuItem {
  href: string;
  title: string;
  description: string;
  /** 이 항목을 보여 줄 최소 역할 */
  minRole: Role;
}

/** 관리 메뉴 항목. 새 관리 화면이 생기면 여기에 한 줄 추가한다. */
export const ADMIN_MENU_ITEMS: readonly AdminMenuItem[] = [
  { href: "/songs", title: "곡 관리", description: "곡 목록에서 곡을 등록하고, 곡 상세에서 곡·채보를 수정하거나 삭제합니다.", minRole: "ADMIN" },
  { href: "/table", title: "서열표 관리", description: "서열표에서 곡을 등록하고, 곡 상세에서 레이팅 상수 난이도·추천도·속성을 고칩니다.", minRole: "ADMIN" },
  { href: "/admin/users", title: "사용자", description: "사용자 목록을 보고 관리자(ADMIN) 역할을 지정하거나 해제합니다.", minRole: "ROOT" },
  { href: "/admin/settings", title: "설정", description: "레이팅 계수, 재킷 표시, 연락처를 바꿉니다.", minRole: "ROOT" },
  { href: "/admin/audit-logs", title: "감사 로그", description: "관리 작업 기록을 최근 순으로 봅니다.", minRole: "ROOT" },
];
