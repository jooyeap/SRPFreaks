import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TierFolderView } from "@/components/table/TierFolderView";
import type { DifficultyTableResponse, PageResponse, TableEntryResponse, TierGroupResponse } from "@/lib/api-types";
import { DEFAULT_SORT } from "@/lib/table-sort";
import { clearFilterCarried, folderCarryFromParams, markFilterCarried, peekFilterCarried, type FolderCarry } from "@/lib/folder-filter-carry";
import { resetTableReturnForTest } from "@/lib/table-view-state";

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: replaceMock, push: vi.fn(), back: vi.fn() }) }));

const table: DifficultyTableResponse = { id: 3, name: "SRN+ 서열표", instrumentPart: "GUITAR", noteOption: "SUPER_RANDOM_PLUS", status: "ACTIVE", revision: 1 };

function entry(id: number, title: string, pattern: string): TableEntryResponse {
  return {
    entryId: id, songDifficultyId: id, songId: id, title, addedVersion: "V5", part: "GUITAR", difficulty: "MASTER", level: 9.5,
    tierUncertain: false, recommend: "상", recommendUncertain: false, pattern, patternUncertain: false, ratingEnabled: true, mine: null,
  };
}
function group(tier: number, base: number): TierGroupResponse {
  const entries = [entry(base, `${tier}단일곡`, "단일"), entry(base + 1, `${tier}복합곡`, "복합")];
  return { tier, total: 2, recorded: 0, exc: 0, fc: 0, ss: 0, sPlus: 0, s: 0, belowS: 0, averageRecorded: null, averageWithZero: 0, entries };
}
// 서버 순서: 높은 난이도 먼저
const groups = [group(5.9, 100), group(5.8, 200), group(5.7, 300)];

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

const COMPLEX: FolderCarry = { filters: { part: null, recommend: [], pattern: ["복합"] }, sort: DEFAULT_SORT, includeZero: false };
const EMPTY: FolderCarry = { filters: { part: null, recommend: [], pattern: [] }, sort: DEFAULT_SORT, includeZero: false };
const regionNotice = () => screen.queryByTestId("filter-carry-notice");

describe("폴더 이동 시 필터 이어가기 (D99)", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    resetTableReturnForTest();
    clearFilterCarried();
    replaceMock.mockReset();
    fetchMock.mockReset();
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      const page: PageResponse<TierGroupResponse> = { content: groups, page: 0, size: 20, totalElements: 3, totalPages: 1 };
      if (url.includes("/skills/me/play-level")) return Promise.resolve(json({ status: "NEW_PLAYER", tier: null }));
      if (url.includes("/skills/me")) return Promise.resolve(json({ single: [], other: [], singleLimit: 15, otherLimit: 25 }));
      return Promise.resolve(url.includes("/entries") ? json(page) : json([table]));
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderView(carry: FolderCarry | null, param = "5.8") {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <TierFolderView userId={1} param={param} carry={carry} />
      </QueryClientProvider>,
    );
  }
  const bar = () => screen.getByRole("navigation", { name: "인접 난이도" });
  const area = () => screen.getByTestId("folder-swipe-area");

  describe("필터가 이동에 실린다", () => {
    it("싣고 온 속성 필터로 시작해 그 폴더에서 같은 필터로 결과를 보여 준다", async () => {
      renderView(COMPLEX);
      expect(await screen.findByRole("heading", { name: /5\.8\s*1개/ })).toBeInTheDocument(); // 2곡 중 복합 1곡
      expect(screen.getAllByText("5.8복합곡").length).toBeGreaterThan(0);
      expect(screen.queryByText("5.8단일곡")).toBeNull();
    });

    it("아래 이웃 버튼: 걸린 필터를 쿼리로 싣고 replace 한다", async () => {
      renderView(COMPLEX);
      await screen.findByRole("heading", { name: /5\.8\s*1개/ });
      fireEvent.click(within(bar()).getByRole("button", { name: "다음 난이도 5.9" }));
      expect(replaceMock).toHaveBeenLastCalledWith("/table/folder/5.9?rec=all&pat=%EB%B3%B5%ED%95%A9", { scroll: false });
      expect(peekFilterCarried()).toBe(true);
      // 실린 주소를 도착 화면이 그대로 읽는다
      const query = (replaceMock.mock.calls[0][0] as string).split("?")[1];
      expect(folderCarryFromParams(new URLSearchParams(query))?.filters.pattern).toEqual(["복합"]);
    });

    it("좌우 스와이프도 같은 주소로 이동한다 (기존 스와이프 규칙 그대로)", async () => {
      renderView(COMPLEX);
      await screen.findByRole("heading", { name: /5\.8\s*1개/ });
      fireEvent.touchStart(area(), { touches: [{ clientX: 200, clientY: 300 }] });
      fireEvent.touchEnd(area(), { changedTouches: [{ clientX: 120, clientY: 300 }] });
      expect(replaceMock).toHaveBeenLastCalledWith("/table/folder/5.9?rec=all&pat=%EB%B3%B5%ED%95%A9", { scroll: false });
      fireEvent.touchStart(area(), { touches: [{ clientX: 200, clientY: 300 }] });
      fireEvent.touchEnd(area(), { changedTouches: [{ clientX: 280, clientY: 300 }] });
      expect(replaceMock).toHaveBeenLastCalledWith("/table/folder/5.7?rec=all&pat=%EB%B3%B5%ED%95%A9", { scroll: false });
    });

    it("난이도 칩 띠의 링크 주소에도 필터가 실린다", async () => {
      renderView(COMPLEX);
      await screen.findByRole("heading", { name: /5\.8\s*1개/ });
      const link = within(screen.getByRole("navigation", { name: "난이도 목록" })).getByRole("link", { name: /5\.9/ });
      expect(decodeURIComponent(link.getAttribute("href") ?? "")).toBe("/table/folder/5.9?rec=all&pat=복합");
      fireEvent.click(link);
      expect(peekFilterCarried()).toBe(true);
    });

    it("정렬·평균 계산도 같이 간다", async () => {
      renderView({ ...COMPLEX, sort: "title", includeZero: true });
      await screen.findByRole("heading", { name: /5\.8\s*1개/ });
      fireEvent.click(within(bar()).getByRole("button", { name: "다음 난이도 5.9" }));
      const query = new URLSearchParams((replaceMock.mock.calls[0][0] as string).split("?")[1]);
      expect(query.get("sort")).toBe("title");
      expect(query.get("zero")).toBe("1");
    });

    it("필터가 없으면 주소는 예전과 같고 표시도 남기지 않는다", async () => {
      renderView(null);
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      fireEvent.click(within(bar()).getByRole("button", { name: "다음 난이도 5.9" }));
      expect(replaceMock).toHaveBeenLastCalledWith("/table/folder/5.9", { scroll: false });
      expect(peekFilterCarried()).toBe(false);
    });
  });

  describe("안내(토스트)", () => {
    it("필터를 싣고 옮겨 온 직후에만 뜬다", async () => {
      markFilterCarried(); // 이동 직전에 이전 화면이 남기는 표시
      renderView(COMPLEX);
      await screen.findByRole("heading", { name: /5\.8\s*1개/ });
      expect(await screen.findByText("필터가 적용되어 있습니다. 초기화할까요?")).toBeInTheDocument();
      expect(peekFilterCarried()).toBe(false); // 한 번 쓰면 지워진다 -> 같은 이동에 다시 뜨지 않는다
    });

    it("표시 없이 열면(새로고침·링크 열기) 필터가 실려 있어도 뜨지 않는다", async () => {
      renderView(COMPLEX);
      await screen.findByRole("heading", { name: /5\.8\s*1개/ });
      expect(regionNotice()).toBeNull();
    });

    it("필터가 없으면 뜨지 않는다", async () => {
      markFilterCarried();
      renderView(EMPTY);
      await screen.findByRole("heading", { name: /5\.8\s*2개/ });
      expect(regionNotice()).toBeNull();
    });

    it("`초기화`를 누르면 필터가 풀려 전체 곡이 보이고 안내가 사라진다", async () => {
      markFilterCarried();
      renderView(COMPLEX);
      await screen.findByRole("heading", { name: /5\.8\s*1개/ });
      fireEvent.click(await screen.findByRole("button", { name: "필터 초기화" }));
      expect(await screen.findByRole("heading", { name: /5\.8\s*2개/ })).toBeInTheDocument();
      expect(screen.getAllByText("5.8단일곡").length).toBeGreaterThan(0);
      expect(regionNotice()).toBeNull();
    });
  });
});
