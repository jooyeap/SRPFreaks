import type { TierNotificationResponse } from "@/lib/api-types";

/**
 * 서열표 변경 알림(D61)을 눌러 곡 상세로 왔을 때 보여 줄 "전 → 후" 값.
 * 서버를 다시 부르지 않도록 알림에 있던 값을 주소에 실어 보낸다(`from=tier-noti`).
 * 미정(null)인 값은 주소에서 빠지고, 읽을 때 null로 돌아온다.
 * 곡 상세는 이 값을 처음 한 번만 읽고 주소에서 지운다(새로고침하면 평소 화면).
 */
export interface TierArrival {
  beforeTier: number | null;
  afterTier: number | null;
  beforeScore: number | null;
  afterScore: number | null;
}

export const TIER_ARRIVAL_FROM = "tier-noti";

/** 서열표 알림 한 줄(묶음 아님)의 곡 상세 주소. 바뀐 채보를 `chart`로 고르고 전·후 값을 붙인다. */
export function tierArrivalHref(item: TierNotificationResponse): string {
  const q = new URLSearchParams({ chart: String(item.songDifficultyId), from: TIER_ARRIVAL_FROM });
  const put = (key: string, value: number | null) => {
    if (value !== null) q.set(key, String(value));
  };
  put("bt", item.beforeTier);
  put("at", item.afterTier);
  put("bs", item.beforeScore);
  put("as", item.afterScore);
  return `/songs/${item.songId}?${q.toString()}`;
}

/** 주소의 값을 읽는다. 알림에서 온 게 아니면 null. 숫자가 아닌 값은 미정(null)으로 본다. */
export function parseTierArrival(search: URLSearchParams): TierArrival | null {
  if (search.get("from") !== TIER_ARRIVAL_FROM) return null;
  const num = (key: string): number | null => {
    const raw = search.get(key);
    if (raw === null || raw.trim() === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  return { beforeTier: num("bt"), afterTier: num("at"), beforeScore: num("bs"), afterScore: num("as") };
}
