import { beforeEach, describe, expect, it } from "vitest";
import {
  addPlays,
  clearHandoff,
  consumeFragment,
  getHandoff,
  pagesReceived,
  parseFragment,
  removePlays,
  resetHandoffCache,
} from "@/lib/import-handoff";
import type { ReadPlay } from "@/lib/import-bookmarklet";

function play(title: string, playedAtMs = 1791796344469): ReadPlay {
  return { playedAtMs, gameType: "gf", title, difficultyClass: "gf_mst", rate: 9650, ok: 0, miss: 3, translated: false, options: ["gf_random_5"] };
}

function fragment(plays: ReadPlay[], unreadable = 0): string {
  return `#srp=${encodeURIComponent(JSON.stringify({ plays, unreadable }))}`;
}

describe("받은 플레이 보관소", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetHandoffCache();
    clearHandoff();
    window.history.replaceState(null, "", "/");
  });

  it("조각을 해석한다. 모양이 틀리면 null", () => {
    expect(parseFragment(fragment([play("A")]))?.plays).toHaveLength(1);
    expect(parseFragment("#other=1")).toBeNull();
    expect(parseFragment("#srp=%E0%A4%A")).toBeNull();
    expect(parseFragment(`#srp=${encodeURIComponent(JSON.stringify({ plays: [{ title: "x" }] }))}`)).toBeNull();
    expect(parseFragment(`#srp=${encodeURIComponent(JSON.stringify({ plays: [{ ...play("A"), rate: 10001 }] }))}`)).toBeNull();
  });

  it("같은 플레이를 다시 받으면 한 번만 둔다", () => {
    expect(addPlays([play("A"), play("B")], 0)).toBe(2);
    expect(addPlays([play("B"), play("C")], 0)).toBe(1);
    expect(getHandoff().pending.map((p) => p.title)).toEqual(["A", "B", "C"]);
  });

  it("주소의 조각을 받아 쌓고 주소에서 지운다", () => {
    window.history.replaceState(null, "", `/import${fragment([play("A")], 2)}`);
    expect(consumeFragment()).toBe(true);
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/import");
    expect(getHandoff().pending).toHaveLength(1);
    expect(getHandoff().unreadable).toBe(2);
  });

  it("깨진 조각도 주소에서는 지우고 아무것도 쌓지 않는다", () => {
    window.history.replaceState(null, "", "/import#srp=not-json");
    expect(consumeFragment()).toBe(false);
    expect(window.location.hash).toBe("");
    expect(getHandoff().pending).toHaveLength(0);
  });

  it("브라우저 저장소에 남기고 다시 읽는다", () => {
    addPlays([play("A")], 0);
    resetHandoffCache();
    expect(getHandoff().pending.map((p) => p.title)).toEqual(["A"]);
  });

  it("6시간이 지난 값은 버린다", () => {
    addPlays([play("A")], 0);
    const raw = JSON.parse(window.localStorage.getItem("srp-import-handoff") ?? "{}");
    raw.updatedAt = Date.now() - 7 * 60 * 60 * 1000;
    window.localStorage.setItem("srp-import-handoff", JSON.stringify(raw));
    resetHandoffCache();
    expect(getHandoff().pending).toHaveLength(0);
  });

  it("저장한 플레이는 빼고, 받은 쪽 수(진행 표시)는 남긴다", () => {
    addPlays([play("A"), play("B"), play("C"), play("D"), play("E")], 0);
    removePlays(getHandoff().pending);
    expect(getHandoff().pending).toHaveLength(0);
    expect(pagesReceived(getHandoff())).toBe(1);
    addPlays([play("F")], 0);
    expect(pagesReceived(getHandoff())).toBe(2);
  });

  it("쪽 수는 4쪽을 넘지 않는다", () => {
    addPlays(Array.from({ length: 20 }, (_, i) => play(`S${i}`, 1791796344469 + i)), 0);
    addPlays([play("extra", 1)], 0);
    expect(pagesReceived(getHandoff())).toBe(4);
  });
});
