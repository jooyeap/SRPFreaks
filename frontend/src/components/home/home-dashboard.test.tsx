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
    expect(p.groups.map((g) => g.label)).toEqual(["5.8", "5.0", "미정"]);
  });
  it("6.5 이상 묶음은 숫자를 더해 한 줄로 합치고 맨 위에 둔다 (6.4는 그대로)", () => {
    const p = tableProgress([
      group({ tier: 6.8, total: 3, recorded: 2, exc: 1, fc: 0, ss: 0, s: 1, belowS: 0 }),
      group({ tier: 6.5, total: 5, recorded: 4, exc: 0, fc: 1, ss: 1, s: 1, belowS: 1 }),
      group({ tier: 6.4, total: 7, recorded: 1, exc: 0, fc: 0, ss: 0, s: 0, belowS: 1 }),
      group({ tier: null, total: 2, recorded: 0, exc: 0, fc: 0, ss: 0, s: 0, belowS: 0 }),
    ]);
    expect(p.groups.map((g) => g.label)).toEqual(["6.5 이상", "6.4", "미정"]);
    expect(p.groups[0]).toMatchObject({ key: "merged-high", href: "/table", total: 8, recorded: 6, exc: 1, fc: 1, ss: 1, s: 2, belowS: 1 });
    expect(p.groups[1].href).toBe("/table/folder/6.4");
    // 합쳐도 전체 합계는 그대로다
    expect(p).toMatchObject({ total: 17, recorded: 7 });
  });
  it("6.5 바로 아래(6.4)와 정확히 6.5는 0.1 단위 정수로 비교한다 (부동소수 오차 없음)", () => {
    const p = tableProgress([group({ tier: 6.5 }), group({ tier: 6.4 })]);
    expect(p.groups.map((g) => g.label)).toEqual(["6.5 이상", "6.4"]);
  });
  it("6.5 이상이 하나도 없으면 합친 줄을 만들지 않는다", () => {
    expect(tableProgress([group({ tier: 5.8 })]).groups.map((g) => g.label)).toEqual(["5.8"]);
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
    // 기록이 모두 채워진 묶음(5.0, 20/20)만 완료 색(막대·기준 난이도 글자)이 붙는다. `완료` 글자는 쓰지 않는다
    expect(rows[0].closest("li")).not.toHaveAttribute("data-done");
    expect(rows[1]).toHaveTextContent("20/20");
    expect(rows[1]).not.toHaveTextContent("완료");
    expect(rows[1].closest("li")).toHaveAttribute("data-done", "true");
    expect(rows[1].querySelector(".text-done-text")).not.toBeNull();
    // 완료한 줄은 막대에 완료 색 테두리가 붙는다 (막대 안은 단계 비율 칸이다)
    expect(rows[1].querySelector("[data-stage-bar].ring-done")).not.toBeNull();
    expect(rows[0].querySelector("[data-stage-bar].ring-done")).toBeNull();
    expect(rows[2].closest("li")).not.toHaveAttribute("data-done"); // 기록 0/2는 완료가 아니다
    expect(progress.querySelector(":scope > div [data-stage-bar].ring-done")).toBeNull(); // 전체는 아직 다 채우지 않았다

    expect(screen.getByRole("link", { name: /^서열표.*레이팅 상수 난이도별로/ })).toHaveAttribute("href", "/table");

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

describe("TableProgressCard 단계 비율 막대", () => {
  const widthsOf = (bar: Element) =>
    Array.from(bar.querySelectorAll("[data-stage]")).map((el) => [el.getAttribute("data-stage"), (el as HTMLElement).style.width]);

  it("전체 막대는 EXC/FC/SS/S/S 미만을 개수 비율대로 높은 단계부터 칸으로 나눈다", () => {
    render(<TableProgressCard progress={tableProgress([group({ tier: 5.8, total: 10, recorded: 6, exc: 1, fc: 2, ss: 0, s: 2, belowS: 1 })])} />);
    const bar = screen.getByRole("region", { name: "서열표 진행도" }).querySelector("[data-stage-bar]")!;
    // 개수 0인 SS 칸은 만들지 않는다. S 미만은 A 색을 쓴다. 남은 4/10(기록 없음)은 바탕색이다
    expect(widthsOf(bar)).toEqual([
      ["EXC", "10%"],
      ["FC", "20%"],
      ["S", "20%"],
      ["A", "10%"],
    ]);
  });

  it("묶음 줄에도 같은 비율 막대가 있고, 합친 줄(6.5 이상)은 합친 숫자로 그린다", () => {
    render(
      <TableProgressCard
        progress={tableProgress([
          group({ tier: 6.6, total: 4, recorded: 4, exc: 2, fc: 0, ss: 0, s: 0, belowS: 2 }),
          group({ tier: 6.5, total: 4, recorded: 0, exc: 0, fc: 0, ss: 0, s: 0, belowS: 0 }),
        ])}
      />,
    );
    const list = screen.getByRole("list", { name: "묶음별 진행" });
    const links = within(list).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("6.5 이상");
    expect(links[0]).toHaveTextContent("4/8");
    expect(widthsOf(links[0].querySelector("[data-stage-bar]")!)).toEqual([
      ["EXC", "25%"],
      ["A", "25%"],
    ]);
  });

  it("전체가 0이면 칸 없이 바탕만 보인다", () => {
    render(<TableProgressCard progress={tableProgress([])} />);
    const bar = screen.getByRole("region", { name: "서열표 진행도" }).querySelector("[data-stage-bar]")!;
    expect(bar.querySelectorAll("[data-stage]")).toHaveLength(0);
  });
});

describe("TableProgressCard 완료 색", () => {
  it("전체 기록이 모두 채워지면 전체 막대도 완료 색이 된다", () => {
    render(<TableProgressCard progress={tableProgress([group({ tier: 5.0, total: 3, recorded: 3, exc: 3, ss: 0, s: 0, belowS: 0 })])} />);
    const card = screen.getByRole("region", { name: "서열표 진행도" });
    expect(card).toHaveTextContent("기록 3/3");
    expect(card.querySelectorAll("[data-stage-bar].ring-done").length).toBe(2); // 전체 막대 + 묶음 막대
    expect(card).not.toHaveTextContent("완료");
  });

  it("전체가 0이면 완료 색을 쓰지 않는다", () => {
    render(<TableProgressCard progress={tableProgress([])} />);
    expect(screen.getByRole("region", { name: "서열표 진행도" }).querySelector(".ring-done")).toBeNull();
  });
});
