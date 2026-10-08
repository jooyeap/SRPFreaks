import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { TableProgressCard } from "@/components/home/TableProgressCard";
import type {
  DifficultyTableResponse,
  PageResponse,
  PlayerSummaryResponse,
  SkillResponse,
  TierGroupResponse,
} from "@/lib/api-types";
import { tableProgress } from "@/lib/difficulty-table";

const table: DifficultyTableResponse = {
  id: 3,
  name: "SRN+ 서열표",
  instrumentPart: "GUITAR",
  noteOption: "SUPER_RANDOM_PLUS",
  status: "ACTIVE",
  revision: 1,
};

const skill: SkillResponse = {
  noteOption: "SUPER_RANDOM_PLUS",
  totalScore: 123.45,
  singleScore: 100,
  otherScore: 23.45,
  tier: { key: "WHITE", displayName: "White", minScore: 0, nextMinScore: 500, nextDisplayName: "Gray" },
  singleLimit: 15,
  otherLimit: 25,
  single: [],
  other: [],
} as unknown as SkillResponse;

function group(over: Partial<TierGroupResponse>): TierGroupResponse {
  return {
    tier: 5.8,
    total: 10,
    recorded: 4,
    exc: 1,
    fc: 0,
    ss: 1,
    s: 1,
    belowS: 1,
    averageRecorded: 90,
    averageWithZero: 36,
    entries: [],
    ...over,
  };
}

const players: PlayerSummaryResponse[] = [
  { userId: 7, rank: 1, nickname: "あか", tier: { key: "GOLD", displayName: "Gold", minScore: 5500, nextMinScore: 6000, nextDisplayName: "Platinum" }, totalScore: 5842.6 },
];
const playersPage: PageResponse<PlayerSummaryResponse> = { content: players, page: 0, size: 5, totalElements: 1, totalPages: 1 };

const groups = [group({ tier: 5.8 }), group({ tier: 5.0, total: 20, recorded: 20, exc: 20, ss: 0, s: 0, belowS: 0 }), group({ tier: null, total: 2, recorded: 0, exc: 0, ss: 0, s: 0, belowS: 0 })];

describe("tableProgress", () => {
  it("묶음별 개수를 합치고 묶음 순서를 유지한다", () => {
    const p = tableProgress(groups);
    expect(p).toMatchObject({ total: 32, recorded: 24, exc: 21, fc: 0, ss: 1, s: 1, belowS: 1 });
    expect(p.groups.map((g) => g.tier)).toEqual([5.8, 5.0, null]);
  });
  it("묶음이 없으면 모두 0", () => {
    expect(tableProgress([])).toMatchObject({ total: 0, recorded: 0, groups: [] });
  });
});

describe("HomeDashboard", () => {
  const fetchMock = vi.fn<typeof fetch>();
  function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }
  function renderView() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <HomeDashboard userId={1} name="홍길동" />
      </QueryClientProvider>,
    );
  }

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("내 레이팅 요약, 서열표 진행도(전체·묶음별), 바로가기를 보여 준다", async () => {
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/skills/me")) return Promise.resolve(json(skill));
      if (url.includes("/players")) return Promise.resolve(json(playersPage));
      if (url.includes("/entries")) {
        const page: PageResponse<TierGroupResponse> = { content: groups, page: 0, size: 20, totalElements: 3, totalPages: 1 };
        return Promise.resolve(json(page));
      }
      return Promise.resolve(json([table]));
    });
    renderView();

    expect(screen.getByRole("heading", { name: /홍길동님의 홈/ })).toBeInTheDocument();
    expect(await screen.findByLabelText("플레이어 티어 White")).toBeInTheDocument();
    expect(screen.getByText("123.45")).toBeInTheDocument();

    const progress = await screen.findByRole("region", { name: "서열표 진행도" });
    expect(progress).toHaveTextContent("기록 24/32");
    expect(within(progress).getByRole("list", { name: "전체 달성 현황" })).toHaveTextContent("EXC 21");
    // 묶음별 진행: 각 줄은 묶음 페이지로 가는 링크
    const rows = within(within(progress).getByRole("list", { name: "묶음별 진행" })).getAllByRole("link");
    expect(rows.map((r) => r.getAttribute("href"))).toEqual([
      "/table/folder/5.8",
      "/table/folder/5.0",
      "/table/folder/undecided",
    ]);
    expect(rows[0]).toHaveTextContent("4/10");
    // 기록이 모두 채워진 묶음(5.0, 20/20)만 `완료` 글자와 완료 색(막대·기준 난이도 글자)이 붙는다
    expect(rows[0]).not.toHaveTextContent("완료");
    expect(rows[0].closest("li")).not.toHaveAttribute("data-done");
    expect(rows[1]).toHaveTextContent("완료");
    expect(rows[1]).toHaveTextContent("20/20");
    expect(rows[1].closest("li")).toHaveAttribute("data-done", "true");
    expect(rows[1].querySelector(".text-done-text")).not.toBeNull();
    expect(rows[1].querySelector(".bg-done")).not.toBeNull();
    expect(rows[0].querySelector(".bg-done")).toBeNull();
    expect(rows[2]).not.toHaveTextContent("완료"); // 기록 0/2는 완료가 아니다
    expect(progress).not.toHaveTextContent("기록 24/32완료"); // 전체는 아직 다 채우지 않았다

    expect(screen.getByRole("link", { name: /^서열표.*기준 난이도별로/ })).toHaveAttribute("href", "/table");

    // 유저 목록 미리보기: 공개한 유저 줄(상세 링크)과 전체 보기 링크
    const preview = await screen.findByRole("region", { name: "유저 목록 미리보기" });
    expect(within(preview).getByRole("link", { name: /あか/ })).toHaveAttribute("href", "/players/7");
    expect(within(preview).getByRole("link", { name: "전체 보기" })).toHaveAttribute("href", "/players");
  });

  it("공개한 유저가 없으면 설정에서 공개할 수 있다는 안내를 보여 준다", async () => {
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/players")) return Promise.resolve(json({ ...playersPage, content: [], totalElements: 0, totalPages: 0 }));
      return Promise.resolve(url.includes("/skills/me") ? json(skill) : json([{ ...table, noteOption: "NORMAL" }]));
    });
    renderView();
    const preview = await screen.findByRole("region", { name: "유저 목록 미리보기" });
    expect(await within(preview).findByText(/아직 공개한 유저가 없습니다/)).toBeInTheDocument();
    expect(within(preview).getByRole("link", { name: "설정" })).toHaveAttribute("href", "/settings");
  });

  it("유저 목록을 못 불러와도 홈의 나머지는 그대로 보여 준다", async () => {
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/players")) return Promise.resolve(json({ code: "INTERNAL", message: "x", timestamp: "t" }, 500));
      return Promise.resolve(url.includes("/skills/me") ? json(skill) : json([{ ...table, noteOption: "NORMAL" }]));
    });
    renderView();
    expect(await screen.findByText("유저 목록을 불러오지 못했습니다.")).toBeInTheDocument();
    expect(await screen.findByLabelText("플레이어 티어 White")).toBeInTheDocument();
  });

  it("레이팅이 실패해도 서열표 진행도는 보여 주고, 실패한 칸에만 안내를 둔다", async () => {
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/skills/me")) return Promise.resolve(json({ code: "INTERNAL", message: "x", timestamp: "t" }, 500));
      if (url.includes("/players")) return Promise.resolve(json(playersPage));
      if (url.includes("/entries")) {
        const page: PageResponse<TierGroupResponse> = { content: groups, page: 0, size: 20, totalElements: 3, totalPages: 1 };
        return Promise.resolve(json(page));
      }
      return Promise.resolve(json([table]));
    });
    renderView();
    expect(await screen.findByText("레이팅을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.")).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "서열표 진행도" })).toBeInTheDocument();
  });

  it("SRN+ 서열표가 없으면 안내 문구를 보여 준다", async () => {
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/players")) return Promise.resolve(json(playersPage));
      return Promise.resolve(url.includes("/skills/me") ? json(skill) : json([{ ...table, noteOption: "NORMAL" }]));
    });
    renderView();
    expect(await screen.findByText("SRN+ 서열표가 아직 없습니다.")).toBeInTheDocument();
  });
});

describe("TableProgressCard 완료 표시", () => {
  it("전체 기록이 모두 채워지면 전체 막대에도 완료가 붙는다", () => {
    render(<TableProgressCard progress={tableProgress([group({ tier: 5.0, total: 3, recorded: 3, exc: 3, ss: 0, s: 0, belowS: 0 })])} />);
    expect(screen.getByRole("region", { name: "서열표 진행도" })).toHaveTextContent("기록 3/3완료");
  });

  it("전체가 0이면 완료로 보지 않는다", () => {
    render(<TableProgressCard progress={tableProgress([])} />);
    expect(screen.getByRole("region", { name: "서열표 진행도" })).not.toHaveTextContent("완료");
  });
});
