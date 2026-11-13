import type { NotificationResponse } from "@/lib/api-types";

/** 묶음을 펼쳤을 때 처음 보이는 줄 수 (DESIGN-UI 알림 종, 2026-11-12). 나머지는 `N곡 더 보기`를 눌러야 보인다. */
export const NOTIFICATION_GROUP_PREVIEW = 3;

export interface NotificationGroup {
  /** 묶음의 열쇠: 첫 줄의 알림 id (목록이 다시 와도 같은 묶음이 같은 열쇠를 가진다) */
  key: number;
  /** 서열표 알림(D61)은 상대가 없어 null. 이 묶음은 늘 한 줄이다 */
  actorUserId: number | null;
  actorNickname: string | null;
  items: NotificationResponse[];
  /** 안 읽은 줄 수 */
  unreadCount: number;
  /** 묶음에 든 곡 수. 서버가 이미 한 줄로 묶은 알림(bundled)은 songCount곡으로 센다 */
  songTotal: number;
}

/** 한 줄이 나타내는 곡 수: 서버 묶음 줄이면 songCount(최소 1), 아니면 1 */
export function songsOf(item: NotificationResponse): number {
  return item.bundled && item.songCount > 1 ? item.songCount : 1;
}

/**
 * 같은 사람(상대)이 **목록에서 연달아** 보낸 알림끼리 한 묶음으로 만든다(서버 응답은 그대로, 화면에서만 묶는다).
 *
 * 왜 "연달아"인가: 목록은 보인 시각 최신 순이라 같은 사람의 알림이 한꺼번에 도착하면 이어서 나온다.
 * 사이에 다른 사람의 알림이 끼면 시간 순서를 깨지 않으려고 따로 묶는다(같은 사람을 목록 전체에서 모아 올리면
 * 최신 순서가 섞여 보이기 때문). 목록 순서는 바꾸지 않는다.
 *
 * 서열표 알림(D61, `kind: "TIER"`)은 상대가 없으므로 묶지 않고 늘 혼자 한 묶음(한 줄)이 된다.
 * 라이벌 알림 사이에 끼면 "연달아"가 끊긴다(위와 같은 이유: 시간 순서를 깨지 않는다).
 */
export function groupNotifications(items: readonly NotificationResponse[]): NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (item.kind === "RIVAL" && last && last.actorUserId === item.actorUserId) {
      last.items.push(item);
      last.unreadCount += item.read ? 0 : 1;
      last.songTotal += songsOf(item);
      // 닉네임은 첫 줄에 없으면(탈퇴 등) 뒤 줄 것으로 채운다
      if (last.actorNickname === null) last.actorNickname = item.actorNickname;
    } else {
      groups.push({
        key: item.id,
        actorUserId: item.kind === "RIVAL" ? item.actorUserId : null,
        actorNickname: item.kind === "RIVAL" ? item.actorNickname : null,
        items: [item],
        unreadCount: item.read ? 0 : 1,
        songTotal: songsOf(item),
      });
    }
  }
  return groups;
}

/** 처음 `NOTIFICATION_GROUP_PREVIEW`줄을 뺀 나머지 줄이 나타내는 곡 수 (`N곡 더 보기`의 N) */
export function hiddenSongCount(group: NotificationGroup): number {
  return group.items.slice(NOTIFICATION_GROUP_PREVIEW).reduce((sum, item) => sum + songsOf(item), 0);
}
