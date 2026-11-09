import { apiFetch } from "@/lib/api";
import type {
  NotificationResponse,
  PageResponse,
  RivalCompareChartsResponse,
  RivalCompareRatingResponse,
  RivalRecordResponse,
  RivalRegistrantResponse,
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
  registeredMe: (viewerId: number, page: number) => ["rivals", "registered-me", viewerId, page] as const,
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
export const REGISTERED_ME_PAGE_SIZE = 20;
/** 알림 개수를 다시 읽는 간격(ms). 화면에 다시 들어올 때도 읽는다. */
export const NOTIFICATION_POLL_MS = 60_000;

export function fetchRivals(signal?: AbortSignal): Promise<RivalResponse[]> {
  return apiFetch<RivalResponse[]>("/rivals", { signal });
}

/** 나를 라이벌로 등록한 공개 유저(D63). 항상 로그인한 본인 기준이고 userId를 보내지 않는다. */
export function fetchRegisteredMe(page: number, signal?: AbortSignal): Promise<PageResponse<RivalRegistrantResponse>> {
  return apiFetch<PageResponse<RivalRegistrantResponse>>("/rivals/registered-me", {
    query: { page, size: REGISTERED_ME_PAGE_SIZE },
    signal,
  });
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
 * 레이팅 비교 줄의 점수 차 칩(D65). 값은 `내 점수 - 상대 점수`다: 앞이면 `+2.28`, 뒤면 `−4.37`(진짜 마이너스 기호 U+2212), 같으면 `±0.00`.
 * 부호가 글자로 보이므로 색만으로 앞뒤를 구분하지 않는다. 내 기록이 없어서 차이가 없으면(null) null을 돌려준다.
 * 부호는 **표시하는 둘째 자리 값**으로 정한다(서버 값은 이미 둘째 자리 점수끼리의 차이지만 부동소수점 찌꺼기로 `+0.00`/`−0.00`이 나오지 않게 한 번 더 반올림한다).
 */
export function formatScoreDiff(diff: number | null): { text: string; sign: "up" | "down" | "even" } | null {
  if (diff === null) return null;
  const cents = Math.round(diff * 100);
  if (cents > 0) return { text: `+${(cents / 100).toFixed(2)}`, sign: "up" };
  if (cents < 0) return { text: `\u2212${(-cents / 100).toFixed(2)}`, sign: "down" };
  return { text: "\u00b10.00", sign: "even" };
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
