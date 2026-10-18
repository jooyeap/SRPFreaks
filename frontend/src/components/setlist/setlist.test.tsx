import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { SetlistTab } from "@/components/setlist/SetlistTab";
import type { ChartRowResponse, RecommendationItem, SetlistItemResponse, SetlistRecommendationResponse } from "@/lib/api-types";
import { clearAccessToken } from "@/lib/auth-token";

vi.mock("@/lib/google", () => ({ loadGoogleIdentity: vi.fn(() => Promise.resolve({ disableAutoSelect: vi.fn() })) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }), usePathname: () => "/me" }));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function item(id: number, over: Partial<SetlistItemResponse> = {}): SetlistItemResponse {
  return {
    id, songDifficultyId: 100 + id, songId: 200 + id, title: `곡${String(id).padStart(2, "0")}`, part: "GUITAR", difficulty: "MASTER",
    level: 9.5, tier: 6.2, mine: null, done: false, createdAt: "2026-10-16T05:00:00Z", ...over,
  };
}
function pageOf(content: SetlistItemResponse[]) {
  return { content, page: 0, size: 30, totalElements: content.length, totalPages: 1 };
}

function rec(id: number, over: Partial<RecommendationItem> = {}): RecommendationItem {
  return { songDifficultyId: id, songId: 300 + id, title: `추천곡${id}`, part: "GUITAR", difficulty: "MASTER", level: 9.5, tier: 6.2, mine: null, ...over };
}
const NO_BASE: SetlistRecommendationResponse = { baseTier: null, rangeSs: 0.3, rangeS: 0.5, ssChallenge: [], sFill: [], page: 0, size: 5, totalPages: 0 };

const AUTH = {
  accessToken: "t", tokenType: "Bearer", expiresIn: 900,
  user: { id: 1, email: "a@example.com", nickname: null, role: "USER", createdAt: "2026-10-01T00:00:00Z" },
};

function chartRow(id: number, title: string): ChartRowResponse {
  return { songDifficultyId: id, songId: id, title, addedVersion: null, part: "GUITAR", difficulty: "MASTER", level: 9.5, mine: null };
}

describe("세트리스트", () => {
  const fetchMock = vi.fn<typeof fetch>();
  /** 응답 상태를 바꿔 가며 쓰는 가짜 서버: 세트리스트 목록과 로그인 복구만 응답한다. */
  let listed: SetlistItemResponse[] = [];
  let loggedIn = true;
  let found: ChartRowResponse[] = [];
  let recommended: SetlistRecommendationResponse = NO_BASE;
  const calls = (method: string) =>
    fetchMock.mock.calls.filter(([input, init]) => String(input).includes("/setlist") && (init?.method ?? "GET") === method);

  beforeEach(() => {
    clearAccessToken();
    listed = [];
    loggedIn = true;
    found = [];
    recommended = NO_BASE;
    fetchMock.mockReset();
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/auth/refresh")) return Promise.resolve(loggedIn ? json(AUTH) : json({ code: "AUTH_FAILED", message: "로그인이 필요합니다." }, 401));
      if (url.includes("/setlist/recommendations")) return Promise.resolve(json(recommended));
      if (url.includes("/setlist/done")) return Promise.resolve(json({ removed: listed.filter((i) => i.done).length }));
      if (url.includes("/setlist") && method === "POST") return Promise.resolve(json(item(9), 201));
      if (url.includes("/setlist") && method === "DELETE") return Promise.resolve(new Response(null, { status: 204 }));
      if (url.includes("/setlist")) return Promise.resolve(json(pageOf(listed)));
      if (url.includes("/songs/charts")) return Promise.resolve(json({ content: found, page: 0, size: 10, totalElements: found.length, totalPages: 1 }));
      if (url.includes("/records")) return Promise.resolve(json({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }));
      return Promise.resolve(json({}));
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderWith(ui: React.ReactNode) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <AuthProvider>{ui}</AuthProvider>
      </QueryClientProvider>,
    );
  }

  describe("SetlistTab", () => {
    it("완료 개수와 줄마다 완료·미완료 글자, 내 최고 기록을 보여 준다", async () => {
      listed = [
        item(1, { done: true, mine: { rate: 96.5, fullCombo: false, stage: "SS" } }),
        item(2),
      ];
      renderWith(<SetlistTab userId={1} />);

      const list = await screen.findByRole("list", { name: "세트리스트" });
      expect(screen.getByText(/완료/, { selector: "p" })).toHaveTextContent("완료 1 / 전체 2");
      const rows = within(list).getAllByRole("listitem");
      expect(rows[0]).toHaveTextContent("곡01");
      expect(rows[0]).toHaveTextContent("완료");
      expect(rows[0]).toHaveTextContent("96.50");
      expect(rows[1]).toHaveTextContent("미완료");
    });

    it("데스크톱(lg 이상)은 두 열: 왼쪽 검색·추천, 오른쪽 내 세트리스트. 모바일은 한 줄로 쌓는다", async () => {
      listed = [item(1)];
      renderWith(<SetlistTab userId={1} />);
      const list = await screen.findByRole("list", { name: "세트리스트" });
      const search = screen.getByRole("region", { name: "곡 검색해서 담기" });
      const recommend = screen.getByRole("region", { name: "내 실력대 추천" });
      const root = search.parentElement!.parentElement!;
      expect(root).toHaveClass("flex-col", "lg:grid", "lg:grid-cols-2");
      // 검색과 추천은 같은 왼쪽 묶음, 세트리스트는 다른(오른쪽) 묶음이다
      expect(recommend.parentElement).toBe(search.parentElement);
      expect(root).toContainElement(list);
      expect(search.parentElement).not.toContainElement(list);
      // 모바일 순서(검색 → 추천 → 세트리스트)는 DOM 순서 그대로다
      expect(search.compareDocumentPosition(recommend) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(recommend.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("비어 있으면 담는 방법을 안내하고 비우기 버튼은 막혀 있다", async () => {
      renderWith(<SetlistTab userId={1} />);
      expect(await screen.findByText(/담은 곡이 없습니다/)).toBeInTheDocument();
      expect(screen.getByText(/위 검색창에서/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "완료한 곡 비우기" })).toBeDisabled();
    });

    it("완료한 곡이 있으면 비우기를 눌러 DELETE /setlist/done을 보낸다", async () => {
      listed = [item(1, { done: true }), item(2)];
      renderWith(<SetlistTab userId={1} />);
      const button = await screen.findByRole("button", { name: "완료한 곡 비우기" });
      expect(button).toBeEnabled();

      fireEvent.click(button);

      await waitFor(() => expect(calls("DELETE").some(([input]) => String(input).endsWith("/setlist/done"))).toBe(true));
    });

    it("줄의 빼기 버튼은 그 줄만 DELETE한다", async () => {
      listed = [item(1), item(2)];
      renderWith(<SetlistTab userId={1} />);
      fireEvent.click(await screen.findByRole("button", { name: "곡02 세트리스트에서 빼기" }));

      await waitFor(() => expect(calls("DELETE")).toHaveLength(1));
      expect(String(calls("DELETE")[0][0])).toMatch(/\/setlist\/2$/);
    });

    it("곡이 많으면 10개씩 나눠 보인다", async () => {
      listed = Array.from({ length: 23 }, (_, i) => item(i + 1));
      renderWith(<SetlistTab userId={1} />);

      const list = await screen.findByRole("list", { name: "세트리스트" });
      expect(within(list).getAllByRole("listitem")).toHaveLength(10);
      expect(screen.getByText("1 / 3")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "다음" }));
      expect(within(screen.getByRole("list", { name: "세트리스트" })).getByText("곡11")).toBeInTheDocument();
    });

    it("기록 입력을 누르면 그 채보의 기록 등록 창이 열린다", async () => {
      listed = [item(1)];
      renderWith(<SetlistTab userId={1} />);
      fireEvent.click(await screen.findByRole("button", { name: "곡01 기록 입력" }));

      expect(await screen.findByRole("heading", { name: "기록 등록" })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByLabelText("달성률")).toBeInTheDocument());
    });
  });
  describe("곡 검색해서 담기", () => {
    const search = (text: string) => fireEvent.change(screen.getByRole("searchbox", { name: "곡 검색" }), { target: { value: text } });
    const searchCalls = () => fetchMock.mock.calls.filter(([input]) => String(input).includes("/songs/charts"));

    it("검색어가 없으면 검색을 요청하지 않는다", async () => {
      renderWith(<SetlistTab userId={1} />);
      await screen.findByText(/담은 곡이 없습니다/);
      expect(searchCalls()).toHaveLength(0);
    });

    it("검색하면 채보 목록이 나오고 담기를 누르면 POST로 그 채보를 담는다", async () => {
      found = [chartRow(55, "테스트곡")];
      renderWith(<SetlistTab userId={1} />);
      await screen.findByText(/담은 곡이 없습니다/);

      search("테스트");
      const button = await screen.findByRole("button", { name: "테스트곡 세트리스트에 담기" });
      expect(String(searchCalls()[0][0])).toContain("q=%ED%85%8C%EC%8A%A4%ED%8A%B8"); // 검색어 "테스트"
      fireEvent.click(button);

      await waitFor(() => expect(calls("POST")).toHaveLength(1));
      expect(JSON.parse(String(calls("POST")[0][1]?.body))).toEqual({ songDifficultyId: 55 });
    });

    it("이미 담은 채보는 담김 글자로 보이고 누를 수 없다", async () => {
      listed = [item(5, { songDifficultyId: 55, title: "테스트곡" })];
      found = [chartRow(55, "테스트곡")];
      renderWith(<SetlistTab userId={1} />);
      await screen.findByRole("list", { name: "세트리스트" });

      search("테스트");
      const button = await screen.findByRole("button", { name: "테스트곡 세트리스트에 담김" });
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent("담김");
    });

    it("30곡이 차 있으면 담기를 모두 막고 안내한다", async () => {
      listed = Array.from({ length: 30 }, (_, i) => item(i + 1));
      found = [chartRow(999, "새곡")];
      renderWith(<SetlistTab userId={1} />);
      await screen.findByRole("list", { name: "세트리스트" });

      search("새");
      expect(await screen.findByRole("button", { name: "새곡 세트리스트에 담기" })).toBeDisabled();
      expect(screen.getByText(/30곡이 모두 담겨 있습니다/)).toBeInTheDocument();
    });

    it("검색 결과가 없으면 안내한다", async () => {
      renderWith(<SetlistTab userId={1} />);
      await screen.findByText(/담은 곡이 없습니다/);
      search("없는곡");
      expect(await screen.findByText("검색 결과가 없습니다.")).toBeInTheDocument();
    });
  });
  describe("내 실력대 추천", () => {
    const recommendCalls = () => fetchMock.mock.calls.filter(([input]) => String(input).includes("/setlist/recommendations"));
    const based = (over: Partial<SetlistRecommendationResponse> = {}): SetlistRecommendationResponse => ({
      baseTier: 6.2, rangeSs: 0.3, rangeS: 0.5, ssChallenge: [], sFill: [], page: 0, size: 5, totalPages: 1, ...over,
    });

    it("평균 난이도와 SS 도전·S 채우기 두 묶음을 보여 주고, 기록이 없으면 글자로 알린다", async () => {
      recommended = based({
        ssChallenge: [rec(1), rec(2, { mine: { rate: 90.5, fullCombo: false, stage: "S" } })],
        sFill: [rec(3, { tier: 6.6 })],
      });
      renderWith(<SetlistTab userId={1} />);

      const section = await screen.findByRole("region", { name: "내 실력대 추천" });
      expect(await within(section).findByText(/내 평균 난이도/)).toHaveTextContent("6.2");
      expect(within(section).getByRole("heading", { name: /SS 도전/ })).toHaveTextContent("평균 ±0.3");
      expect(within(section).getByRole("heading", { name: /S 채우기/ })).toHaveTextContent("평균 ±0.5");
      const ss = within(within(section).getByRole("list", { name: "SS 도전 추천" })).getAllByRole("listitem");
      expect(ss[0]).toHaveTextContent("추천곡1");
      expect(ss[0]).toHaveTextContent("기록 없음");
      expect(ss[1]).toHaveTextContent("90.50");
      expect(ss[1]).toHaveTextContent("S");
      const s = within(within(section).getByRole("list", { name: "S 채우기 추천" })).getAllByRole("listitem");
      expect(s[0]).toHaveTextContent("추천곡3");
    });

    it("추천할 채보가 없는 묶음은 안내한다", async () => {
      recommended = based({ ssChallenge: [rec(1)] });
      renderWith(<SetlistTab userId={1} />);

      const section = await screen.findByRole("region", { name: "내 실력대 추천" });
      expect(await within(section).findByRole("list", { name: "SS 도전 추천" })).toBeInTheDocument();
      expect(within(section).getByText("추천할 채보가 없습니다.")).toBeInTheDocument();
    });

    it("평균 난이도를 구할 수 없으면 기록이 더 쌓이면 추천한다는 안내만 보인다", async () => {
      renderWith(<SetlistTab userId={1} />);

      const section = await screen.findByRole("region", { name: "내 실력대 추천" });
      expect(await within(section).findByText(/기록이 더 쌓이면 추천해 드려요/)).toBeInTheDocument();
      expect(within(section).queryByRole("button")).toBeNull();
    });

    it("담기를 누르면 그 채보를 POST로 담고 추천을 다시 불러온다", async () => {
      recommended = based({ ssChallenge: [rec(7)] });
      renderWith(<SetlistTab userId={1} />);

      fireEvent.click(await screen.findByRole("button", { name: "추천곡7 세트리스트에 담기" }));

      await waitFor(() => expect(calls("POST")).toHaveLength(1));
      expect(JSON.parse(String(calls("POST")[0][1]?.body))).toEqual({ songDifficultyId: 7 });
      await waitFor(() => expect(recommendCalls().length).toBeGreaterThanOrEqual(2)); // 담은 뒤 다시 불러온다
    });

    it("이미 담긴 채보는 담김으로 막고, 30곡이 차 있으면 담기를 모두 막는다", async () => {
      listed = Array.from({ length: 30 }, (_, i) => item(i + 1, { songDifficultyId: i === 0 ? 7 : 500 + i }));
      recommended = based({ ssChallenge: [rec(7), rec(8)] });
      renderWith(<SetlistTab userId={1} />);

      const added = await screen.findByRole("button", { name: "추천곡7 세트리스트에 담김" });
      expect(added).toBeDisabled();
      expect(screen.getByRole("button", { name: "추천곡8 세트리스트에 담기" })).toBeDisabled(); // 30곡이 찼다
    });

    it("추천이 여러 쪽이면 다음을 눌러 다음 쪽을 요청한다", async () => {
      recommended = based({ ssChallenge: [rec(1)], totalPages: 2 });
      renderWith(<SetlistTab userId={1} />);

      const section = await screen.findByRole("region", { name: "내 실력대 추천" });
      fireEvent.click(await within(section).findByRole("button", { name: "다음" }));

      await waitFor(() => expect(recommendCalls().some(([input]) => String(input).includes("page=1"))).toBe(true));
    });
  });
});
