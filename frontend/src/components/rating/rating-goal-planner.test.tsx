import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RatingGoalPlanner } from "@/components/rating/RatingGoalPlanner";
import type { DifficultyTableResponse, SkillEntryResponse, SkillResponse, TableEntryResponse, TierGroupResponse } from "@/lib/api-types";

// 직접 계산: A 6.0/80% = 240 (95%는 304, 여지 64), B 7.0/90% = 362.67 (95%는 384, 여지 21.33), C 6.0/90% = 282.67 (여지 21.33)
function entry(id: number, title: string, tier: number, rate: number, score: number): SkillEntryResponse {
  return {
    rank: id, songDifficultyId: id * 10, songId: id, title, part: "GUITAR", difficulty: "MASTER", level: 9, tier,
    pattern: "단일", achievementRate: rate, fullCombo: false, stage: "S", ratingConstant: 15, value: score / 20, score,
  };
}
const skill: SkillResponse = {
  noteOption: "SUPER_RANDOM_PLUS",
  totalScore: 1000,
  singleScore: 600,
  otherScore: 400,
  tier: { key: "ORANGE", displayName: "Orange", minScore: 1000, nextDisplayName: "Orange Gradient", nextMinScore: 1500 },
  singleLimit: 15,
  otherLimit: 25,
  single: [entry(2, "비곡", 7.0, 90, 362.6667)],
  other: [entry(1, "에이곡", 6.0, 80, 240), entry(3, "씨곡", 6.0, 90, 282.6667)],
};

const table: DifficultyTableResponse = { id: 3, name: "SRN+ 서열표", instrumentPart: "GUITAR", noteOption: "SUPER_RANDOM_PLUS", status: "ACTIVE", revision: 1 };
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

describe("RatingGoalPlanner", () => {
  const fetchMock = vi.fn<typeof fetch>();
  /** 서열표 묶음(목록 밖 채보). 기본은 비어 있어 목록 안의 곡만으로 계산한다 */
  let groups: TierGroupResponse[] = [];
  let tableFails = false;

  beforeEach(() => {
    groups = [];
    tableFails = false;
    fetchMock.mockReset();
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (tableFails) return Promise.resolve(new Response(JSON.stringify({ code: "INTERNAL", message: "x" }), { status: 500, headers: { "Content-Type": "application/json" } }));
      return Promise.resolve(url.includes("/entries") ? json({ content: groups, page: 0, size: 20, totalElements: groups.length, totalPages: 1 }) : json([table]));
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderPlanner(s: SkillResponse = skill) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <RatingGoalPlanner userId={1} skill={s} />
      </QueryClientProvider>,
    );
  }

  function openAndType(value: string, s: SkillResponse = skill) {
    renderPlanner(s);
    fireEvent.click(screen.getByRole("button", { name: /목표 레이팅/ }));
    fireEvent.change(screen.getByLabelText("목표 점수"), { target: { value } });
  }

  it("처음에는 접혀 있고 입력칸이 보이지 않는다", () => {
    renderPlanner();
    const toggle = screen.getByRole("button", { name: /목표 레이팅/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("목표 점수")).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("목표 점수")).toHaveAttribute("placeholder", "지금 1000.00");
  });

  it("목표를 입력하면 근처 폴더 평균과 구간 경로를 보여 준다 (1040: 평균 난이도 근처는 6.0 폴더 평균 85%, 에이곡 → 85%, 씨곡 → 94.38% 도전)", async () => {
    openAndType("1040");
    const list = await screen.findByRole("list", { name: "목표까지 올릴 곡" });
    const items = within(list).getAllByRole("listitem");
    // 직접 계산: 근처 6.0 폴더(에이 80%·씨 90%) 평균 85%라 85%까지가 현실적. 에이곡 80→85는 +21.33, 남은 18.67은 씨곡 90%→95% 쪽(도전):
    // 282.667 + 18.667 = 301.333 → V = 15.0667 → 80 + 3.0667/3.2×15 = 94.375 → 94.38
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByRole("link", { name: "에이곡" })).toHaveAttribute("href", "/songs/1?from=table&chart=10");
    expect(items[0]).toHaveTextContent("80.00% → 85.00%");
    expect(items[0]).toHaveTextContent("+21.33");
    expect(items[0]).not.toHaveTextContent("도전");
    expect(items[1]).toHaveTextContent("씨곡");
    expect(items[1]).toHaveTextContent("90.00% → 94.38%");
    expect(items[1]).toHaveTextContent("도전");
    expect(screen.getByText(/내 평균 난이도 근처 폴더/)).toHaveTextContent("6.0 평균 85.00% (2곡)");
    expect(screen.getByText(/목표까지/)).toHaveTextContent("+40.00");
    expect(screen.getByText(/목표까지/)).toHaveTextContent("곡 2개를 올리면 달성합니다");
    expect(screen.queryByText(/근처 폴더만으로는 모자라서/)).toBeNull();
  });

  it("근처 폴더만으로 모자라면 다른 난이도의 곡도 넣고 알린다 (1100: 근처 최대 +85.33 → 비곡 90%→95% 포함, 에이곡 80%→93.44%)", async () => {
    openAndType("1100");
    const items = within(await screen.findByRole("list", { name: "목표까지 올릴 곡" })).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("에이곡");
    expect(items[0]).toHaveTextContent("80.00% → 93.44%");
    expect(items[1]).toHaveTextContent("씨곡");
    expect(items[1]).toHaveTextContent("90.00% → 95.00%");
    expect(items[2]).toHaveTextContent("비곡");
    expect(items[2]).toHaveTextContent("90.00% → 95.00%");
    expect(screen.getByText(/근처 폴더만으로는 모자라서/)).toBeInTheDocument();
  });

  it("목록 안의 곡을 모두 올려도 모자라면 모자란 점수를 알려 준다 (1200: 106.67만 오르고 93.33 모자람)", async () => {
    openAndType("1200");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("+106.67");
    expect(alert).toHaveTextContent("93.33점이 모자랍니다");
  });

  it("이미 넘은 목표는 경로 대신 안내만 한다", async () => {
    openAndType("900");
    expect(await screen.findByText(/이미 목표를 넘었습니다/)).toHaveTextContent("1000.00");
    expect(screen.queryByRole("list", { name: "목표까지 올릴 곡" })).toBeNull();
  });

  it("형식이 틀리면 오류를 알리고 계산하지 않는다 (글자, 소수 셋째 자리, 0, 빈 값)", async () => {
    openAndType("abc");
    expect(await screen.findByRole("alert")).toHaveTextContent("숫자로 입력해 주세요");
    fireEvent.change(screen.getByLabelText("목표 점수"), { target: { value: "1050.123" } });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("소수는 둘째 자리까지"));
    fireEvent.change(screen.getByLabelText("목표 점수"), { target: { value: "0" } });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("0보다 큰 값"));
    fireEvent.change(screen.getByLabelText("목표 점수"), { target: { value: "" } });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("입력해 주세요"));
    expect(screen.queryByRole("list", { name: "목표까지 올릴 곡" })).toBeNull();
  });

  describe("목록 밖의 곡", () => {
    // 단일 목록 한도 2: S1 6.0 90% = 282.667, S2 6.0 95% = 304 (합계 586.667). 목록 밖 7.0 채보는 70% = 280이라 맨 아래(282.667)보다 낮다.
    const small: SkillResponse = {
      ...skill,
      totalScore: 586.6667,
      singleLimit: 2,
      single: [entry(1, "에스원", 6.0, 90, 282.6667), entry(2, "에스투", 6.0, 95, 304)],
      other: [],
    };
    const outside: TableEntryResponse = {
      entryId: 9, songDifficultyId: 900, songId: 90, title: "밖의곡", addedVersion: null, part: "GUITAR", difficulty: "MASTER", level: 9.8,
      tierUncertain: false, recommend: null, recommendUncertain: false, pattern: "단일", patternUncertain: false, ratingEnabled: true,
      mine: { rate: 70, fullCombo: false, stage: "C" },
    };
    const folder = (tier: number, entries: TableEntryResponse[]): TierGroupResponse => ({
      tier, total: entries.length, recorded: 0, exc: 0, fc: 0, ss: 0, s: 0, belowS: 0, averageRecorded: null, averageWithZero: 0, entries,
    });

    it("목록 밖 곡이 들어오면 `목록 진입`과 밀려나는 곡을 보여 준다 (+30: 70.00% → 78.17%, 에스원이 밀려남)", async () => {
      groups = [folder(7.0, [outside])];
      openAndType("616.67", small);
      const list = await screen.findByRole("list", { name: "목표까지 올릴 곡" });
      await waitFor(() => expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("밖의곡"));
      const items = within(list).getAllByRole("listitem");
      expect(items).toHaveLength(1);
      expect(items[0]).toHaveTextContent("70.00% → 78.17%");
      expect(items[0]).toHaveTextContent("목록 진입");
      const displaced = screen.getByRole("list", { name: "목록에서 밀려나는 곡" });
      expect(within(displaced).getByText("에스원")).toBeInTheDocument();
      expect(displaced).toHaveTextContent("90.00% · 282.67");
      expect(screen.getByText(/밀려난 곡을 뺀 값/)).toBeInTheDocument();
    });

    it("서열표를 받지 못하면 안내하고 레이팅 목록 안의 곡만으로 계산한다", async () => {
      tableFails = true;
      openAndType("600", small);
      expect(await screen.findByText(/서열표를 불러오지 못해 레이팅 목록 안의 곡만 계산했습니다/)).toBeInTheDocument();
      const items = within(await screen.findByRole("list", { name: "목표까지 올릴 곡" })).getAllByRole("listitem");
      expect(items[0]).toHaveTextContent("에스원");
      expect(screen.queryByRole("list", { name: "목록에서 밀려나는 곡" })).toBeNull();
    });
  });

  it("다음 티어 버튼이 목표를 그 티어 최소 점수(1500)로 채운다", async () => {
    renderPlanner();
    fireEvent.click(screen.getByRole("button", { name: /목표 레이팅/ }));
    fireEvent.click(screen.getByRole("button", { name: "Orange Gradient (1500)로 정하기" }));
    expect(screen.getByLabelText("목표 점수")).toHaveValue("1500");
    // 1500은 이 목록으로는 닿지 못한다 (최대 +106.67)
    expect(await screen.findByRole("alert")).toHaveTextContent("모자랍니다");
  });

  it("최고 티어이면 다음 티어 버튼이 없다", () => {
    const top: SkillResponse = { ...skill, tier: { key: "HSB", displayName: "HSB", minScore: 11000, nextDisplayName: null, nextMinScore: null } };
    renderPlanner(top);
    fireEvent.click(screen.getByRole("button", { name: /목표 레이팅/ }));
    expect(screen.queryByRole("button", { name: /로 정하기/ })).toBeNull();
  });
});
