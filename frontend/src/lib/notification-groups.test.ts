import { describe, expect, it } from "vitest";
import type { RivalNotificationResponse, TierNotificationResponse } from "@/lib/api-types";
import { NOTIFICATION_GROUP_PREVIEW, groupNotifications, hiddenSongCount, songsOf } from "@/lib/notification-groups";

function n(id: number, actor: number, extra: Partial<RivalNotificationResponse> = {}): RivalNotificationResponse {
  return {
    kind: "RIVAL", id, actorUserId: actor, actorNickname: `U${actor}`, songId: id, songDifficultyId: id, title: `T${id}`, part: "GUITAR",
    difficulty: "MASTER", level: 8, actorRate: 95, myRate: 94, bundled: false, songCount: 1,
    visibleAt: "2026-11-12T00:00:00Z", read: false, ...extra,
  };
}

describe("groupNotifications", () => {
  it("빈 목록은 묶음이 없다", () => {
    expect(groupNotifications([])).toEqual([]);
  });

  it("한 건은 한 줄짜리 묶음이다", () => {
    const g = groupNotifications([n(1, 7)]);
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ key: 1, actorUserId: 7, unreadCount: 1, songTotal: 1 });
    expect(g[0].items).toHaveLength(1);
  });

  it("같은 사람이 연달아면 한 묶음이고 목록 순서는 그대로다", () => {
    const g = groupNotifications([n(5, 7), n(4, 7), n(3, 7)]);
    expect(g).toHaveLength(1);
    expect(g[0].items.map((i) => i.id)).toEqual([5, 4, 3]);
    expect(g[0].key).toBe(5);
    expect(g[0].songTotal).toBe(3);
  });

  it("사이에 다른 사람이 끼면 같은 사람이어도 따로 묶는다(시간 순서를 섞지 않는다)", () => {
    const g = groupNotifications([n(4, 7), n(3, 8), n(2, 7)]);
    expect(g.map((x) => [x.actorUserId, x.items.length])).toEqual([[7, 1], [8, 1], [7, 1]]);
  });

  it("읽음이 섞이면 안 읽은 줄만 센다", () => {
    const g = groupNotifications([n(3, 7, { read: true }), n(2, 7), n(1, 7)]);
    expect(g[0].unreadCount).toBe(2);
    const allRead = groupNotifications([n(2, 7, { read: true }), n(1, 7, { read: true })]);
    expect(allRead[0].unreadCount).toBe(0);
  });

  it("서버가 묶은 줄(bundled)은 songCount곡으로 센다", () => {
    expect(songsOf(n(1, 7, { bundled: true, songCount: 5 }))).toBe(5);
    expect(songsOf(n(1, 7, { bundled: true, songCount: 1 }))).toBe(1);
    const g = groupNotifications([n(2, 7, { bundled: true, songCount: 5 }), n(1, 7)]);
    expect(g[0].songTotal).toBe(6);
  });

  it("첫 줄에 닉네임이 없으면(탈퇴 등) 뒤 줄 닉네임으로 채운다", () => {
    const g = groupNotifications([n(2, 7, { actorNickname: null }), n(1, 7, { actorNickname: "Rumi" })]);
    expect(g[0].actorNickname).toBe("Rumi");
  });
});

describe("hiddenSongCount", () => {
  it("처음 3줄 뒤의 곡 수(묶음 줄은 songCount)를 센다", () => {
    expect(NOTIFICATION_GROUP_PREVIEW).toBe(3);
    const three = groupNotifications([n(3, 7), n(2, 7), n(1, 7)])[0];
    expect(hiddenSongCount(three)).toBe(0);
    const five = groupNotifications([n(5, 7), n(4, 7), n(3, 7), n(2, 7), n(1, 7)])[0];
    expect(hiddenSongCount(five)).toBe(2);
    const bundledTail = groupNotifications([n(4, 7), n(3, 7), n(2, 7), n(1, 7, { bundled: true, songCount: 4 })])[0];
    expect(hiddenSongCount(bundledTail)).toBe(4);
  });

  it("서열표 알림(상대 없음)은 묶지 않고, 같은 사람의 라이벌 알림 사이에 끼면 연달아가 끊긴다", () => {
    const t = (id: number): TierNotificationResponse => ({
      kind: "TIER", id, songId: id, songDifficultyId: id, title: `X${id}`, part: "GUITAR", difficulty: "MASTER", level: 8,
      myRate: 90, beforeTier: 6.5, afterTier: 7, beforeScore: 1, afterScore: 2, scoreDiff: 1, bundled: false, songCount: 1,
      visibleAt: "2026-11-12T00:00:00Z", read: false,
    });
    const g = groupNotifications([n(1, 7), n(2, 7), t(1), t(2), n(3, 7)]);
    expect(g.map((x) => x.items.length)).toEqual([2, 1, 1, 1]);
    expect(g[1].actorUserId).toBeNull();
  });
});
