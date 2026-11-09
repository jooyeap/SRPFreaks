import { apiFetch } from "@/lib/api";
import type {
  NotificationResponse,
  PageResponse,
  RivalCompareChartsResponse,
  RivalCompareRatingResponse,
  RivalRatingRow,
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

/**
 * 속성별 평균 달성률 차(%, D67 개정): 앞이면 `+1.8%`, 뒤면 `−0.4%`(진짜 마이너스 기호 U+2212), 같으면 `±0.0%`(단위는 `%p`가 아니라 `%`로만 쓴다, 2026-11-09).
 * 소수 첫째 자리(곡 줄 칩의 둘째 자리 달성률 차는 `formatRateGap`).
 * 부호가 글자로 보이므로 색만으로 앞뒤를 구분하지 않는다. 값이 없으면(공유 곡 0 · 옛 응답) null이라 부른 쪽이 `–`를 쓴다.
 * 서버가 이미 소수 첫째 자리로 한 번 반올림한 값이다. 여기서는 부동소수점 찌꺼기로 `+0.0`/`−0.0`이 나오지 않게 첫째 자리 정수로 맞춰 부호를 정한다.
 */
export function formatRateDiff(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const tenths = Math.round(value * 10);
  if (tenths > 0) return `+${(tenths / 10).toFixed(1)}%`;
  if (tenths < 0) return `\u2212${(-tenths / 10).toFixed(1)}%`;
  return "\u00b10.0%";
}

/**
 * 곡 줄 칩의 달성률 차(%, 2026-11-09): `내 달성률 − 상대 달성률`을 **둘째 자리**까지. 앞이면 `+1.84%`(up), 뒤면 `−2.10%`(down),
 * 같으면 `±0.00%`(even). 부호는 글자로 보이므로 색만으로 앞뒤를 구분하지 않는다. 내 기록이 없어서(둘 중 하나가 null) 차이가 없으면 null.
 * 달성률은 DB에 둘째 자리까지 저장된 값이라 100을 곱해 정수(1/100 %)로 맞춘 뒤 빼서 부동소수점 찌꺼기(`+0.0000001`, `−0.00`)가 나오지 않게 한다.
 * 승·무·패 판정·접전·정렬도 같은 달성률 차(%p)로 한다(D67 개정, 2026-11-09). 예전에는 점수 차로 판정해 달성률 95 이상이 모두 `무`가 되었다.
 */
export function formatRateGap(myRate: number | null | undefined, rate: number | null | undefined): { text: string; sign: "up" | "down" | "even" } | null {
  if (myRate === null || myRate === undefined || rate === null || rate === undefined) return null;
  const cents = Math.round(myRate * 100) - Math.round(rate * 100);
  if (cents > 0) return { text: `+${(cents / 100).toFixed(2)}%`, sign: "up" };
  if (cents < 0) return { text: `\u2212${(-cents / 100).toFixed(2)}%`, sign: "down" };
  return { text: "\u00b10.00%", sign: "even" };
}

/** 따라잡을 곡 구역에 보이는 최대 곡 수(D66). */
export const CATCH_UP_LIMIT = 3;

/**
 * 따라잡을 곡(D66, D67 개정): 상대 레이팅 목록 줄 중 **둘 다 기록이 있고 내가 뒤진** 곡을 차이가 작은 순으로 최대 3곡.
 * 차이는 줄의 칩과 같은 **달성률 차**(`내 달성률 − 상대 달성률`, 둘째 자리 값끼리)다. 그래서 칩이 `±0.00%`나 `+`인 곡은 뽑히지 않고,
 * 뽑힌 곡의 칩은 항상 `−`다(예전에는 점수 차로 골라 달성률 95 이상에서 `뒤진 곡인데 +로 보이는` 어긋남이 있었다).
 * 같은 차이면 상대 점수가 높은 곡이 먼저, 그다음 곡 id·채보 id 순으로 정해 새로고침해도 순서가 흔들리지 않게 한다.
 */
export function catchUpRows(rows: readonly RivalRatingRow[], limit: number = CATCH_UP_LIMIT): RivalRatingRow[] {
  const behind: { row: RivalRatingRow; gap: number }[] = [];
  for (const row of rows) {
    if (row.myRate === null) continue;
    const cents = Math.round(row.myRate * 100) - Math.round(row.rate * 100);
    if (cents < 0) behind.push({ row, gap: -cents });
  }
  behind.sort((a, b) => a.gap - b.gap || b.row.score - a.row.score || a.row.songId - b.row.songId || a.row.songDifficultyId - b.row.songDifficultyId);
  return behind.slice(0, limit).map((x) => x.row);
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
