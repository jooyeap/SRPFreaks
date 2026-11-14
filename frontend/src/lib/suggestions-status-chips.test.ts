import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminSuggestionResponse, SuggestionStatus } from "@/lib/api-types";
import {
  chipStatuses,
  fetchAdminSuggestionsByStatuses,
  pageOfRows,
  STATUS_CHIPS,
  SUGGESTION_FETCH_PAGE_SIZE,
  sortNewestFirst,
} from "@/lib/suggestions";

function row(id: number, status: SuggestionStatus, createdAt: string): AdminSuggestionResponse {
  return {
    id,
    category: "OTHER",
    title: `건의 ${id}`,
    content: "내용",
    requestedPart: null,
    requestedDifficulty: null,
    status,
    adminNote: null,
    authorNickname: "tester",
    createdAt,
    updatedAt: createdAt,
  };
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("건의 관리 상태 칩 묶음 (D79)", () => {
  it("접수 = RECEIVED + REVIEWING, 처리 완료 = DONE + REJECTED, 전체 = 조건 없음", () => {
    expect(STATUS_CHIPS.map((chip) => chip.key)).toEqual(["OPEN", "CLOSED", "ALL"]);
    expect(chipStatuses("OPEN")).toEqual(["RECEIVED", "REVIEWING"]);
    expect(chipStatuses("CLOSED")).toEqual(["DONE", "REJECTED"]);
    expect(chipStatuses("ALL")).toEqual([]);
    // 네 상태가 모두 어느 한 칩에 들어간다(빠지거나 겹치지 않는다)
    const grouped = [...chipStatuses("OPEN"), ...chipStatuses("CLOSED")].sort();
    expect(grouped).toEqual(["DONE", "RECEIVED", "REJECTED", "REVIEWING"]);
  });

  it("최신순으로 정렬하고, 작성 시각이 같으면 id가 큰 것이 위다(서버 정렬과 같다)", () => {
    const sorted = sortNewestFirst([
      row(1, "RECEIVED", "2026-10-01T00:00:00Z"),
      row(2, "REVIEWING", "2026-10-03T00:00:00Z"),
      row(3, "RECEIVED", "2026-10-03T00:00:00Z"),
      row(4, "REVIEWING", "2026-10-02T00:00:00Z"),
    ]);
    expect(sorted.map((r) => r.id)).toEqual([3, 2, 4, 1]);
  });

  it("합친 목록은 화면에서 쪽으로 나눈다: 쪽 경계가 어긋나지 않고, 범위를 넘은 쪽은 마지막 쪽으로 맞춘다", () => {
    const rows = Array.from({ length: 25 }, (_, i) => i + 1);
    expect(pageOfRows(rows, 0, 10)).toMatchObject({ content: rows.slice(0, 10), page: 0, totalPages: 3, totalElements: 25 });
    expect(pageOfRows(rows, 2, 10)).toMatchObject({ content: [21, 22, 23, 24, 25], page: 2, totalPages: 3 });
    expect(pageOfRows(rows, 9, 10).page).toBe(2); // 저장 뒤 건수가 줄어 쪽 번호가 범위를 넘은 경우
    expect(pageOfRows([], 0, 10)).toMatchObject({ content: [], page: 0, totalPages: 0, totalElements: 0 });
  });

  describe("묶인 상태를 모두 받아 합치기", () => {
    const fetchMock = vi.fn<typeof fetch>();
    beforeEach(() => {
      fetchMock.mockReset();
      vi.stubGlobal("fetch", fetchMock);
    });
    afterEach(() => vi.unstubAllGlobals());

    it("상태마다 끝 쪽까지(쪽 크기 50) 받아 최신순으로 합친다. 한 상태가 여러 쪽이어도 빠지지 않는다", async () => {
      // RECEIVED는 53건(2쪽: 50 + 3), REVIEWING은 2건(1쪽). id가 클수록 최신이 되게 날짜를 준다.
      const day = (id: number) => `2026-09-${String(Math.min(id, 28)).padStart(2, "0")}T00:00:${String(id % 60).padStart(2, "0")}Z`;
      const received = Array.from({ length: 53 }, (_, i) => row(i + 1, "RECEIVED", day(i + 1)));
      const reviewing = [row(100, "REVIEWING", "2026-10-10T00:00:00Z"), row(101, "REVIEWING", "2026-10-11T00:00:00Z")];
      fetchMock.mockImplementation((input) => {
        const params = new URL(String(input), "http://localhost").searchParams;
        const source = params.get("status") === "RECEIVED" ? received : reviewing;
        const page = Number(params.get("page") ?? 0);
        const size = Number(params.get("size"));
        return Promise.resolve(
          json({ content: source.slice(page * size, page * size + size), page, size, totalElements: source.length, totalPages: Math.ceil(source.length / size) }),
        );
      });

      const merged = await fetchAdminSuggestionsByStatuses("", chipStatuses("OPEN"));

      expect(merged).toHaveLength(55);
      expect(new Set(merged.map((r) => r.id)).size).toBe(55); // 중복 없음
      expect(merged[0]?.id).toBe(101); // 가장 최신
      expect(merged[1]?.id).toBe(100);
      // 요청: RECEIVED 2쪽 + REVIEWING 1쪽, 모두 쪽 크기 50
      const urls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(urls).toHaveLength(3);
      expect(urls.every((u) => u.includes(`size=${SUGGESTION_FETCH_PAGE_SIZE}`))).toBe(true);
      expect(urls.filter((u) => u.includes("status=RECEIVED")).map((u) => new URL(u, "http://localhost").searchParams.get("page")).sort()).toEqual(["0", "1"]);
    });

    it("받은 건이 없으면 빈 목록이고, 종류 조건이 있으면 그대로 붙인다", async () => {
      fetchMock.mockImplementation(() => Promise.resolve(json({ content: [], page: 0, size: 50, totalElements: 0, totalPages: 0 })));
      expect(await fetchAdminSuggestionsByStatuses("BUG", chipStatuses("CLOSED"))).toEqual([]);
      const urls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(urls).toHaveLength(2); // DONE, REJECTED 한 번씩
      expect(urls.every((u) => u.includes("category=BUG"))).toBe(true);
    });
  });
});
