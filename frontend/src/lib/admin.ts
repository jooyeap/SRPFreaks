import type { MessageKey, Translator } from "@/i18n/translator";
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
const ACTION_LABELS: Record<string, MessageKey> = {
  SONG_CREATE: "Admin.actionSongCreate",
  SONG_UPDATE: "Admin.actionSongUpdate",
  SONG_DELETE: "Admin.actionSongDelete",
  DIFFICULTY_CREATE: "Admin.actionDifficultyCreate",
  DIFFICULTY_UPDATE: "Admin.actionDifficultyUpdate",
  DIFFICULTY_DELETE: "Admin.actionDifficultyDelete",
  TABLE_ENTRY_CREATE: "Admin.actionTableEntryCreate",
  TABLE_ENTRY_UPDATE: "Admin.actionTableEntryUpdate",
  USER_ROLE_CHANGE: "Admin.actionUserRoleChange",
  RECORD_ADMIN_DELETE: "Admin.actionRecordAdminDelete",
  NOTICE_CREATE: "Admin.actionNoticeCreate",
  NOTICE_UPDATE: "Admin.actionNoticeUpdate",
  NOTICE_DELETE: "Admin.actionNoticeDelete",
  SUGGESTION_REVIEW: "Admin.actionSuggestionReview",
  SETTING_UPDATE: "Admin.actionSettingUpdate",
};

export function actionLabel(action: string, t: Translator): string {
  const key = ACTION_LABELS[action];
  return key ? t(key) : action;
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
  label: MessageKey | null;
  description: MessageKey | null;
  kind: SettingKind;
  /** kind가 choice일 때 고를 수 있는 값 */
  choices?: readonly string[];
}

/**
 * 화면에 보여 줄 설정 설명. 서버가 값을 최종 검사하므로(레이팅 계산에 쓸 수 있는 값인지) 여기 종류는 입력을 돕고
 * 뻔한 실수를 먼저 막는 용도다. 목록에 없는 키는 글자(text)로 다룬다.
 */
export const SETTING_META: Record<string, SettingMeta> = {
  "rating.pivot": { label: "Admin.settingPivot", description: "Admin.settingPivotDesc", kind: "number" },
  "rating.high_slope": { label: "Admin.settingHighSlope", description: "Admin.settingHighSlopeDesc", kind: "number" },
  "rating.high_offset": { label: "Admin.settingHighOffset", description: "Admin.settingHighOffsetDesc", kind: "number" },
  "rating.low_slope": { label: "Admin.settingLowSlope", description: "Admin.settingLowSlopeDesc", kind: "number" },
  "rating.low_offset": { label: "Admin.settingLowOffset", description: "Admin.settingLowOffsetDesc", kind: "number" },
  "rating.cap_rate": { label: "Admin.settingCapRate", description: "Admin.settingCapRateDesc", kind: "number" },
  "rating.max_rate": { label: "Admin.settingMaxRate", description: "Admin.settingMaxRateDesc", kind: "number" },
  "rating.bonus": { label: "Admin.settingBonus", description: "Admin.settingBonusDesc", kind: "number" },
  "rating.score_multiplier": { label: "Admin.settingScoreMultiplier", description: "Admin.settingScoreMultiplierDesc", kind: "number" },
  "rating.list_single": { label: "Admin.settingListSingle", description: "Admin.settingListSingleDesc", kind: "integer" },
  "rating.list_other": { label: "Admin.settingListOther", description: "Admin.settingListOtherDesc", kind: "integer" },
  "rating.note_option": { label: "Admin.settingNoteOption", description: "Admin.settingNoteOptionDesc", kind: "choice", choices: ["SUPER_RANDOM_PLUS"] },
  "ui.show_song_images": { label: "Admin.settingShowSongImages", description: "Admin.settingShowSongImagesDesc", kind: "boolean" },
  "contact.takedown_email": { label: "Admin.settingTakedownEmail", description: "Admin.settingTakedownEmailDesc", kind: "text" },
};

export function settingMeta(key: string): SettingMeta {
  return SETTING_META[key] ?? { label: null, description: null, kind: "text" };
}

const DECIMAL = /^-?\d+(\.\d+)?$/;
const INTEGER = /^\d+$/;

/** 저장 전 입력 검사. 문제가 없으면 null, 있으면 화면에 보여 줄 문구. */
export function validateSettingValue(key: string, raw: string, t: Translator): string | null {
  const value = raw.trim();
  if (value === "") {
    return t("Admin.valueRequired");
  }
  const meta = settingMeta(key);
  if (meta.kind === "number" && !DECIMAL.test(value)) {
    return t("Admin.valueNumber");
  }
  if (meta.kind === "integer" && !INTEGER.test(value)) {
    return t("Admin.valueInteger");
  }
  if (meta.kind === "boolean" && value !== "true" && value !== "false") {
    return t("Admin.valueBoolean");
  }
  if (meta.kind === "choice" && !(meta.choices ?? []).includes(value)) {
    return t("Admin.valueChoice");
  }
  if (value.length > 500) {
    return t("Admin.valueMax", { max: 500 });
  }
  return null;
}

/** 설정을 바꾸면 레이팅 계산과 그 결과(내 레이팅, 유저 목록 총점)가 달라질 수 있어 함께 새로 받는다. */
export const SETTING_AFFECTED_KEYS = [["admin"], ["skill"], ["players"]] as const;

// ---- 사용자 / 역할 ------------------------------------------------------------------------------------

export const ADMIN_USERS_PAGE_SIZE = 30;

/** 화면에서 고를 수 있는 역할. ROOT로 바꾸는 기능은 없다(ROOT는 환경변수로만 만든다). */
export const ASSIGNABLE_ROLES = ["USER", "ADMIN"] as const;

const ROLE_LABELS: Record<Role, MessageKey> = { ROOT: "Admin.roleRoot", ADMIN: "Admin.roleAdmin", USER: "Admin.roleUser" };

export function roleLabel(role: Role, t: Translator): string {
  return t(ROLE_LABELS[role]);
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
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  /** 이 항목을 보여 줄 최소 역할 */
  minRole: Role;
}

/** 관리 메뉴 항목. 새 관리 화면이 생기면 여기에 한 줄 추가한다. */
export const ADMIN_MENU_ITEMS: readonly AdminMenuItem[] = [
  { href: "/songs", titleKey: "Admin.menuSongs", descriptionKey: "Admin.menuSongsDesc", minRole: "ADMIN" },
  { href: "/table", titleKey: "Admin.menuTable", descriptionKey: "Admin.menuTableDesc", minRole: "ADMIN" },
  { href: "/admin/suggestions", titleKey: "Admin.menuSuggestions", descriptionKey: "Admin.menuSuggestionsDesc", minRole: "ADMIN" },
  { href: "/admin/users", titleKey: "Admin.menuUsers", descriptionKey: "Admin.menuUsersDesc", minRole: "ROOT" },
  { href: "/admin/settings", titleKey: "Admin.menuSettings", descriptionKey: "Admin.menuSettingsDesc", minRole: "ROOT" },
  { href: "/admin/audit-logs", titleKey: "Admin.menuAuditLogs", descriptionKey: "Admin.menuAuditLogsDesc", minRole: "ROOT" },
];
