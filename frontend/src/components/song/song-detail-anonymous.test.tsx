import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SongDetailView } from "@/components/song/SongDetailView";
import type { DifficultyTableResponse, SongDetailResponse } from "@/lib/api-types";
import { ANONYMOUS_VIEWER_ID } from "@/lib/viewer";

vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));

const table: DifficultyTableResponse = {
  id: 3,
  name: "SRN+ 서열표",
  instrumentPart: "GUITAR",
  noteOption: "SUPER_RANDOM_PLUS",
  status: "ACTIVE",
  revision: 1,
};

const song: SongDetailResponse = {
  id: 1,
  title: "테스트곡",
  artist: "아티스트",
  addedVersion: "V5",
  titleFolder: null,
  bpmMin: 120,
  bpmMax: 180,
  source: null,
  titles: [],
  difficulties: [{ id: 10, songId: 1, instrumentPart: "GUITAR", difficultyType: "MASTER", level: 9.8, noteCount: 1234 }],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** 비로그인 방문자(D43): 곡 정보는 보이고, 내 기록은 로그인 안내로 바뀌며, 기록 API는 부르지 않는다. */
describe("곡 상세 (비로그인)", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/difficulty-tables/") && url.includes("/entries")) {
        return Promise.resolve(json({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }));
      }
      if (url.endsWith("/difficulty-tables")) return Promise.resolve(json([table]));
      if (url.includes("/tier-history")) return Promise.resolve(json({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 }));
      if (url.includes("/songs/")) return Promise.resolve(json(song));
      return Promise.resolve(json({}, 404));
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("곡 정보와 내 기록 칸의 로그인 안내를 보여 주고 /records를 부르지 않는다", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <SongDetailView songId={1} chartId={10} origin="songs" userId={ANONYMOUS_VIEWER_ID} />
      </QueryClientProvider>,
    );

    expect((await screen.findAllByText("테스트곡")).length).toBeGreaterThan(0);
    const mine = screen.getByRole("region", { name: "내 기록" });
    expect(mine).toHaveTextContent("기록을 입력하려면 로그인해 주세요.");
    expect(screen.getByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("button", { name: /기록 (등록|입력)/ })).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/records"))).toBe(false);
  });
});
