import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DifficultyTableView } from "@/components/table/DifficultyTableView";
import type { DifficultyTableResponse, TableEntryResponse, TierGroupResponse } from "@/lib/api-types";
import { resetTableTilesForTest, TIP_SEEN_KEY } from "@/lib/table-tiles";
import { DEFAULT_VIEW_STATE } from "@/lib/table-view-state";

const table: DifficultyTableResponse = { id: 3, name: "SRN+ 서열표", instrumentPart: "GUITAR", noteOption: "SUPER_RANDOM_PLUS", status: "ACTIVE", revision: 1 };

function entry(id: number, over: Partial<TableEntryResponse> = {}): TableEntryResponse {
  return {
    entryId: id,
    songDifficultyId: id,
    songId: id,
    title: `곡${id}`,
    addedVersion: "V1",
    part: "GUITAR",
    difficulty: "MASTER",
    level: 9.5,
    tierUncertain: false,
    recommend: "상",
    recommendUncertain: false,
    pattern: "단일",
    patternUncertain: false,
    ratingEnabled: true,
    mine: null,
    ...over,
  };
}

/** 한 난이도 묶음: total개 중 recorded개에 기록이 있다. recommend 값을 바꾸면 기본 필터(상·중)에서 빠진다 */
function tier(value: number | null, recorded: number, total: number, recommend = "상"): TierGroupResponse {
  const entries = Array.from({ length: total }, (_, i) =>
    entry(Math.round((value ?? 0) * 100) + i, { recommend, mine: i < recorded ? { rate: 90, fullCombo: false, stage: "S" } : null }),
  );
  return { tier: value, total, recorded, exc: 0, fc: 0, ss: 0, s: recorded, belowS: 0, averageRecorded: null, averageWithZero: 0, entries };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("서열표 첫 화면 (타일 격자)", () => {
  const fetchMock = vi.fn<typeof fetch>();

  /** 서열표 목록 · 전체 묶음 · 내 평균 난이도를 가짜로 돌려준다 */
  function serve(groups: TierGroupResponse[], playLevel: unknown = { status: "NEW_PLAYER", tier: null }) {
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/skills/me/play-level")) return Promise.resolve(json(playLevel));
      if (url.includes("/entries")) return Promise.resolve(json({ content: groups, page: 0, size: 20, totalElements: groups.length, totalPages: 1 }));
      return Promise.resolve(json([table]));
    });
  }
  function renderView(userId = 1, props: Partial<Parameters<typeof DifficultyTableView>[0]> = {}) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <DifficultyTableView userId={userId} {...props} />
      </QueryClientProvider>,
    );
  }
  const tiles = () => within(screen.getByRole("list", { name: "난이도 목록" })).getAllByRole("link");
  const tileTiers = () => tiles().map((a) => a.textContent?.slice(0, 3));
  const calls = (part: string) => fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes(part));

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    resetTableTilesForTest();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("평균이 있으면 맨 위에 `5.8 내 평균 난이도 · 기록 n곡`, 어려운 순으로 평균 타일 위 3칸까지 보이고 그 위는 접힌다", async () => {
    // 4.9 ~ 7.0 22개 난이도, 곡 10개씩. 기록 수는 난이도 순서대로 0,1,2,...,10,10,10... (합계는 아래에서 센다)
    const groups = Array.from({ length: 22 }, (_, i) => tier((49 + i) / 10, Math.min(i, 10), 10));
    const sum = groups.reduce((acc, g) => acc + g.recorded, 0);
    serve(groups, { status: "READY", tier: 5.84 });
    renderView();

    expect(await screen.findAllByText("내 평균 난이도")).toHaveLength(2); // 맨 위 줄 + 평균 타일의 숨은 글자
    // 맨 위 줄의 라벨 옆에 `?` 설명 버튼이 하나 있다(타일 줄·곡 줄에는 없다)
    expect(screen.getAllByRole("button", { name: "내 평균 난이도 설명 보기" })).toHaveLength(1);
    expect(document.querySelector("p .text-3xl")).toHaveTextContent("5.8"); // 서버 평균 5.84를 0.1 단위로
    expect(screen.getByText(`기록 ${sum}곡`)).toBeInTheDocument();
    expect(screen.queryByText(/처음이라면/)).toBeNull();
    expect(tileTiers()).toEqual(["6.1", "6.0", "5.9", "5.8", "5.7", "5.6", "5.5", "5.4", "5.3", "5.2", "5.1", "5.0", "4.9"]);
    expect(document.querySelector("[data-average='true']")).toHaveTextContent("5.8");
    expect(screen.getByRole("button", { name: /더 높은 난이도 9개 6\.2~7\.0/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "어려운 순" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /더 높은 난이도/ }));
    expect(tiles()).toHaveLength(22);
  });

  it("평균은 새로 계산하지 않고 세트리스트 추천과 같은 서버 값(/skills/me/play-level)을 쓴다", async () => {
    serve([tier(5.8, 1, 2)], { status: "READY", tier: 5.8 });
    renderView();
    await screen.findAllByText("내 평균 난이도");
    expect(calls("/skills/me/play-level")).toHaveLength(1);
    expect(calls("/skills/me").filter((u) => !u.includes("/play-level"))).toHaveLength(0); // 레이팅 목록(/skills/me)을 따로 받아 계산하지 않는다
  });

  it("타일에는 기록/전체가 보이고 누르면 폴더로 간다. 완료는 `완료` 숨은 글자가 있고, 미정 묶음은 타일이 없다", async () => {
    serve([tier(5.9, 0, 3), tier(5.8, 3, 3), tier(null, 2, 2)]);
    renderView();
    await screen.findByRole("list", { name: "난이도 목록" });
    const links = tiles();
    expect(links).toHaveLength(2); // 미정 타일 없음
    const done = screen.getByRole("link", { name: /^5\.8/ });
    expect(done).toHaveAttribute("href", "/table/folder/5.8");
    expect(done).toHaveTextContent("3/3");
    expect(done).toHaveTextContent("완료");
    expect(screen.getByRole("link", { name: /^5\.9/ })).toHaveTextContent("0/3");
    expect(screen.getByRole("link", { name: /^5\.9/ })).not.toHaveTextContent("완료");
  });

  it("기록이 없으면(NEW_PLAYER) 맨 위가 `처음이라면 5.0부터 시작해 보세요`, 쉬운 순 기본이고 평균 타일·깜빡임·접힘이 없다", async () => {
    const groups = Array.from({ length: 22 }, (_, i) => tier((49 + i) / 10, 0, 2));
    serve(groups, { status: "NEW_PLAYER", tier: null });
    renderView();
    expect(await screen.findByText("처음이라면 5.0부터 시작해 보세요")).toBeInTheDocument();
    expect(screen.queryByText("내 평균 난이도")).toBeNull();
    expect(screen.getByRole("button", { name: "쉬운 순" })).toHaveAttribute("aria-pressed", "true");
    expect(tileTiers()[0]).toBe("4.9");
    expect(tiles()).toHaveLength(22);
    expect(document.querySelector("[data-average]")).toBeNull();
    expect(document.querySelector(".tile-glow")).toBeNull();
    expect(screen.queryByRole("button", { name: /더 (높은|낮은) 난이도/ })).toBeNull();
  });

  it("비로그인이면 평균을 묻지 않고 시작 안내 + 쉬운 순으로 보인다", async () => {
    serve([tier(5.0, 0, 2), tier(5.1, 0, 2)]);
    renderView(0);
    expect(await screen.findByText("처음이라면 5.0부터 시작해 보세요")).toBeInTheDocument();
    expect(calls("/skills/me")).toHaveLength(0); // 평균(play-level)도 묻지 않는다
    expect(tileTiers()).toEqual(["5.0", "5.1"]);
  });

  it("평균 근거가 모자란 기록 있는 사용자(INSUFFICIENT)는 기록 수만 보이고 시작 안내는 없다", async () => {
    serve([tier(5.0, 2, 4), tier(5.1, 1, 4)], { status: "INSUFFICIENT", tier: null });
    renderView();
    expect(await screen.findByText("기록 3곡")).toBeInTheDocument();
    expect(screen.queryByText(/처음이라면/)).toBeNull();
    expect(document.querySelector("[data-average]")).toBeNull();
  });

  it("평균을 못 받아도(서버 오류) 타일은 평균 없이 그려진다", async () => {
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/skills/me/play-level")) return Promise.resolve(json({ code: "INTERNAL", message: "오류", timestamp: "t" }, 500));
      if (url.includes("/entries")) return Promise.resolve(json({ content: [tier(5.8, 1, 2)], page: 0, size: 20, totalElements: 1, totalPages: 1 }));
      return Promise.resolve(json([table]));
    });
    renderView();
    await screen.findByRole("list", { name: "난이도 목록" });
    expect(document.querySelector("[data-average]")).toBeNull();
  });

  it("`어려운 순 | 쉬운 순`을 누르면 보기 상태(order)로 알리고, 받은 순서로 타일이 다시 놓인다", async () => {
    serve([tier(5.0, 0, 2), tier(5.1, 0, 2), tier(5.2, 0, 2)]);
    const onStateChange = vi.fn();
    const { rerender } = renderView(1, { state: DEFAULT_VIEW_STATE, onStateChange });
    await screen.findByRole("list", { name: "난이도 목록" });
    expect(tileTiers()).toEqual(["5.0", "5.1", "5.2"]);
    fireEvent.click(screen.getByRole("button", { name: "어려운 순" }));
    expect(onStateChange).toHaveBeenLastCalledWith({ ...DEFAULT_VIEW_STATE, order: "hard" });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    rerender(
      <QueryClientProvider client={client}>
        <DifficultyTableView userId={1} state={{ ...DEFAULT_VIEW_STATE, order: "hard" }} onStateChange={onStateChange} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(tileTiers()).toEqual(["5.2", "5.1", "5.0"]));
  });

  it("`필터 ▾` 한 버튼으로 필터를 열고, 바꾸면 서버에 다시 묻지 않고 타일의 기록/전체가 바뀐다", async () => {
    // 5.8: 상 2곡(기록 1) + 하 2곡(기록 0). 기본 필터(상·중)에서는 1/2, 추천 `전체`로 풀면 1/4
    const mixed = tier(5.8, 1, 2);
    const low = tier(5.8, 0, 2, "하");
    serve([{ ...mixed, total: 4, entries: [...mixed.entries, ...low.entries] }]);
    renderView();
    await screen.findByRole("list", { name: "난이도 목록" });
    expect(screen.queryByRole("group", { name: "추천" })).toBeNull(); // 처음에는 접혀 있다
    expect(screen.queryByRole("group", { name: "평균 계산" })).toBeNull(); // 이 화면에는 평균 계산 토글이 없다
    expect(screen.getByRole("link", { name: /^5\.8/ })).toHaveTextContent("1/2");
    const before = fetchMock.mock.calls.length;

    const button = screen.getByRole("button", { name: /^필터/ });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(within(screen.getByRole("group", { name: "추천" })).getByRole("button", { name: "전체" }));
    expect(screen.getByRole("link", { name: /^5\.8/ })).toHaveTextContent("1/4");
    expect(fetchMock.mock.calls.length).toBe(before);
  });

  it("필터를 적용한 뒤 곡이 0개인 난이도는 타일을 만들지 않는다", async () => {
    serve([tier(5.8, 0, 2, "하"), tier(5.9, 1, 2)]);
    renderView();
    await screen.findByRole("list", { name: "난이도 목록" });
    expect(tileTiers()).toEqual(["5.9"]);
  });

  it("서열표 화면에는 `모두 펼치기` 버튼이 없고 검색창·출처 문구는 그대로 있다", async () => {
    serve([tier(5.8, 1, 2)]);
    renderView();
    await screen.findByRole("list", { name: "난이도 목록" });
    expect(screen.queryByRole("button", { name: "모두 펼치기" })).toBeNull();
    expect(screen.getByRole("link", { name: /イズニャン/ })).toHaveAttribute("href", "https://x.com/trist_is");
    expect(document.getElementById("table-search-input")).not.toBeNull();
  });

  it("SRN+ 서열표가 없으면 안내 문구를 보여 준다", async () => {
    fetchMock.mockResolvedValue(json([{ ...table, noteOption: "NORMAL" }]));
    renderView();
    expect(await screen.findByText("SRN+ 서열표가 아직 없습니다.")).toBeInTheDocument();
  });

  it("서버 오류는 서버가 준 문구로 알려 준다", async () => {
    fetchMock.mockResolvedValue(json({ code: "INTERNAL", message: "서버에 문제가 생겼습니다.", timestamp: "t" }, 500));
    renderView();
    expect(await screen.findByRole("alert")).toHaveTextContent("서버에 문제가 생겼습니다.");
  });

  describe("첫 방문 안내 말풍선", () => {
    const tip = "색이 진할수록 기록이 많은 난이도입니다. 타일을 누르면 그 난이도의 곡이 열립니다.";

    it("처음에는 보이고, ×로 닫으면 이 기기에서 다시 뜨지 않는다 (화면을 다시 만들어도)", async () => {
      serve([tier(5.8, 1, 2)]);
      const first = renderView();
      expect(await screen.findByText(tip)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "닫기" }));
      expect(screen.queryByText(tip)).toBeNull();
      expect(localStorage.getItem(TIP_SEEN_KEY)).toBe("1");
      first.unmount();

      renderView();
      await screen.findByRole("list", { name: "난이도 목록" });
      expect(screen.queryByText(tip)).toBeNull();
    });

    it("저장소를 읽거나 쓰지 못해도 화면은 정상이다 (읽기 실패면 안내가 보이고, 닫으면 이번 화면에서는 닫힌다)", async () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      serve([tier(5.8, 1, 2)]);
      renderView();
      expect(await screen.findByText(tip)).toBeInTheDocument();
      expect(screen.getByRole("list", { name: "난이도 목록" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "닫기" }));
      expect(screen.queryByText(tip)).toBeNull();
    });
  });
});
