import { apiFetch } from "@/lib/api";
import type { AuditLogResponse, PageResponse } from "@/lib/api-types";

/** 관리(ROOT) 쿼리 키. 보는 사람(viewerId)을 넣는 이유는 다른 화면과 같다(계정이 바뀌어도 이전 캐시가 보이지 않게). */
export const adminKeys = {
  all: ["admin"] as const,
  auditLogs: (viewerId: number, page: number) => ["admin", "audit-logs", viewerId, page] as const,
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
