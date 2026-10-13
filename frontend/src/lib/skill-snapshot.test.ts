import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blockReasonText, createSnapshot, fetchSnapshots, formatChange, snapshotKeys } from "@/lib/skill-snapshot";

describe("formatChange", () => {
  it("오르면 ▲ +, 내리면 ▼ -, 같으면 ±0.00이고 첫 기록은 –", () => {
    expect(formatChange(35.2)).toEqual({ text: "▲ +35.20", direction: "up" });
    expect(formatChange(-12)).toEqual({ text: "▼ -12.00", direction: "down" });
    expect(formatChange(0)).toEqual({ text: "±0.00", direction: "flat" });
    expect(formatChange(null)).toEqual({ text: "–", direction: "none" });
  });

  it("부동소수 잡음은 둘째 자리에서 정리한다", () => {
    expect(formatChange(0.30000000000000004).text).toBe("▲ +0.30");
    expect(formatChange(0.001).direction).toBe("flat");
  });
});

describe("blockReasonText", () => {
  it("이유 코드마다 문구가 있다", () => {
    expect(blockReasonText("ALREADY_TODAY")).toContain("오늘은 이미 기록했습니다");
    expect(blockReasonText("NO_CHANGE")).toContain("점수가 같아");
    expect(blockReasonText("NO_RECORDS")).toContain("기록이 없어");
  });
});

describe("snapshotKeys", () => {
  it("레이팅 키(['skill', userId])로 시작해서 기록이 바뀌면 함께 무효화된다", () => {
    expect(snapshotKeys.list(3, 0).slice(0, 2)).toEqual(["skill", 3]);
    expect(snapshotKeys.status(3).slice(0, 2)).toEqual(["skill", 3]);
  });
});

describe("API 호출", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("목록은 page와 size를 붙여 GET", async () => {
    fetchMock.mockResolvedValue(json({ content: [], page: 1, size: 10, totalElements: 0, totalPages: 0 }));
    await fetchSnapshots(1);
    const url = new URL(String(fetchMock.mock.calls[0][0]), "http://x");
    expect(url.pathname).toMatch(/\/skills\/me\/snapshots$/);
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("size")).toBe("10");
  });

  it("기록하기는 POST", async () => {
    fetchMock.mockResolvedValue(json({ id: 1, date: "2026-10-10", totalScore: 1, singleScore: 1, otherScore: 0, change: null }, 201));
    await createSnapshot();
    expect(fetchMock.mock.calls[0][1]?.method).toBe("POST");
  });
});
