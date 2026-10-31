import { apiFetch } from "@/lib/api";
import type {
  NotificationResponse,
  PageResponse,
  RivalCompareChartsResponse,
  RivalCompareRatingResponse,
  RivalRecordResponse,
  RivalResponse,
  RivalResult,
  RivalStatusResponse,
} from "@/lib/api-types";

/**
 * 라이벌(D56) 쿼리 키. 앞부분 "rivals"로 한꺼번에 무효화한다(등록·해제하면 목록·상태·곡 상세 기록이 모두 달라진다).
 * 보는 사람(viewerId)을 넣는 이유는 다른 화면과 같다(계정이 바뀌면 이전 캐시가 보이지 않게).
 */
export const rivalKeys = {
  all: ["rivals"] as const,
  list: (viewerId: number) => ["rivals", "list", viewerId] as const,
  status: (viewerId: number, targetId: number) => ["rivals", "status", viewerId, targetId] as const,
  rating: (viewerId: number, targetId: number) => ["rivals", "compare-rating", viewerId, targetId] as const,
  charts: (viewerId: number, targetId: number, result: RivalResult) => ["rivals", "compare-charts", viewerId, targetId, result] as const,
  records: (viewerId: number, chartId: number) => ["rivals", "records", viewerId, chartId] as const,
};

export const notificationKeys = {
  all: ["notifications"] as const,
  count: (viewerId: number) => ["notifications", "count", viewerId] as const,
  list: (viewerId: number) => ["notifications", "list", viewerId] as const,
};

export const RIVAL_CHART_PAGE_SIZE = 20;
export const NOTIFICATION_PAGE_SIZE = 20;
/** 알림 개수를 다시 읽는 간격(ms). 화면에 다시 들어올 때도 읽는다. */
export const NOTIFICATION_POLL_MS = 60_000;

export function fetchRivals(signal?: AbortSignal): Promise<RivalResponse[]> {
  return apiFetch<RivalResponse[]>("/rivals", { signal });
}

export function registerRival(targetUserId: number): Promise<void> {
  return apiFetch<void>("/rivals", { method: "POST", body: { targetUserId } });
}

export function unregisterRival(targetUserId: number): Promise<void> {
  return apiFetch<void>(`/rivals/${targetUserId}`, { method: "DELETE" });
}

export function fetchRivalStatus(targetUserId: number, signal?: AbortSignal): Promise<RivalStatusResponse> {
  return apiFetch<RivalStatusResponse>(`/players/${targetUserId}/rival-status`, { signal });
}

export function fetchCompareRating(targetUserId: number, signal?: AbortSignal): Promise<RivalCompareRatingResponse> {
  return apiFetch<RivalCompareRatingResponse>(`/players/${targetUserId}/compare/rating`, { signal });
}

export function fetchCompareCharts(targetUserId: number, result: RivalResult, page: number,
                                   signal?: AbortSignal): Promise<RivalCompareChartsResponse> {
  return apiFetch<RivalCompareChartsResponse>(`/players/${targetUserId}/compare/charts`, {
    query: { result, page, size: RIVAL_CHART_PAGE_SIZE },
    signal,
  });
}

export function fetchRivalRecords(songDifficultyId: number, signal?: AbortSignal): Promise<RivalRecordResponse[]> {
  return apiFetch<RivalRecordResponse[]>(`/song-difficulties/${songDifficultyId}/rival-records`, { signal });
}

export function fetchUnreadCount(signal?: AbortSignal): Promise<{ count: number }> {
  return apiFetch<{ count: number }>("/notifications/unread-count", { signal });
}

export function fetchNotifications(page: number, signal?: AbortSignal): Promise<PageResponse<NotificationResponse>> {
  return apiFetch<PageResponse<NotificationResponse>>("/notifications", { query: { page, size: NOTIFICATION_PAGE_SIZE }, signal });
}

export function markAllNotificationsRead(): Promise<void> {
  return apiFetch<void>("/notifications/read-all", { method: "POST" });
}

export function markNotificationRead(id: number): Promise<void> {
  return apiFetch<void>(`/notifications/${id}/read`, { method: "POST" });
}

/** 배지 글자: 0이면 없음, 9 넘으면 `9+`. */
export function badgeText(count: number): string | null {
  if (count <= 0) return null;
  return count > 9 ? "9+" : String(count);
}

/**
 * 차이 표시: 양수면 `1.90↑`(내가 높음), 음수면 `3.40↓`(낮음), 0이면 `0.00`. null(내 기록 없음)은 null.
 * 화살표 글자로도 구분해서 색만으로 뜻을 전하지 않는다.
 */
export function formatDiff(diff: number | null): { text: string; sign: "up" | "down" | "even" } | null {
  if (diff === null) return null;
  const abs = Math.abs(diff).toFixed(2);
  if (diff > 0) return { text: `${abs}↑`, sign: "up" };
  if (diff < 0) return { text: `${abs}↓`, sign: "down" };
  return { text: abs, sign: "even" };
}

/** 부호를 붙인 차이(`+0.30`, `-1.62`, `0.00`). 곡 상세·라이벌 목록용. */
export function signed(value: number): string {
  const text = Math.abs(value).toFixed(2);
  return value > 0 ? `+${text}` : value < 0 ? `-${text}` : text;
}

/** "몇 분 전" 같은 상대 시각. 1분 미만은 `방금`. 하루 넘으면 n일 전. */
export function relativeMinutes(iso: string, now: number): { unit: "now" | "minute" | "hour" | "day"; n: number } {
  const diffMs = Math.max(0, now - new Date(iso).getTime());
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return { unit: "now", n: 0 };
  if (minutes < 60) return { unit: "minute", n: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { unit: "hour", n: hours };
  return { unit: "day", n: Math.floor(hours / 24) };
}
