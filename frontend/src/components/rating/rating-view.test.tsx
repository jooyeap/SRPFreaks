import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RatingSummary } from "@/components/rating/RatingSummary";
import { RatingView } from "@/components/rating/RatingView";
import type { SkillEntryResponse, SkillResponse } from "@/lib/api-types";

function entry(over: Partial<SkillEntryResponse> = {}): SkillEntryResponse {
  return {
    rank: 1,
    songDifficultyId: 10,
    songId: 100,
    title: "테스트곡",
    part: "GUITAR",
    difficulty: "MASTER",
    level: 9.5,
    tier: 5.8,
    pattern: "단일",
    achievementRate: 96.5,
    fullCombo: false,
    stage: "SS",
    ratingConstant: 14,
    value: 13.2,
    score: 264,
    ...over,
  };
}

function skill(over: Partial<SkillResponse> = {}): SkillResponse {
  return {
    noteOption: "SUPER_RANDOM_PLUS",
    totalScore: 1125.5,
    singleScore: 700.25,
    otherScore: 425.25,
    tier: { key: "ORANGE", displayName: "Orange", minScore: 1000, nextDisplayName: "Orange Gradient", nextMinScore: 1500 },
    singleLimit: 15,
    otherLimit: 25,
    single: [entry()],
    other: [entry({ rank: 1, songDifficultyId: 11, title: "복합곡", pattern: "복합", stage: "EXC", achievementRate: 100, fullCombo: true })],
    ...over,
  };
}

describe("RatingSummary", () => {
  it("합계, 소계, 티어 이름, 다음 티어까지 진행도와 남은 점수를 보여 준다", () => {
    render(<RatingSummary skill={skill()} />);
    expect(screen.getByText("1125.50")).toBeInTheDocument();
    expect(screen.getByText("700.25")).toBeInTheDocument();
    expect(screen.getByText("425.25")).toBeInTheDocument();
    expect(screen.getByLabelText("플레이어 티어 Orange")).toHaveTextContent("Orange");
    const bar = screen.getByRole("progressbar", { name: "Orange Gradient까지" });
    expect(bar).toHaveAttribute("aria-valuenow", "25"); // (1125.5 - 1000) / 500 = 25.1%
    expect(screen.getByText("374.50")).toBeInTheDocument();
  });

  it("카드에 티어 키를 붙여서 색과 테두리 효과가 티어에 따라 정해진다", () => {
    render(<RatingSummary skill={skill()} />);
    expect(screen.getByRole("region", { name: "내 레이팅" })).toHaveAttribute("data-tier", "ORANGE");
  });

  it("마지막 티어는 진행 막대 대신 '최고 티어'를 보여 준다", () => {
    render(
      <RatingSummary
        skill={skill({ totalScore: 9800, tier: { key: "HASUBONG", displayName: "하수봉", minScore: 9500, nextDisplayName: null, nextMinScore: null } })}
      />,
    );
    expect(screen.getByText("최고 티어")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});

describe("RatingView", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }
  function renderView() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <RatingView userId={1} />
      </QueryClientProvider>,
    );
  }

  it("단일/그 외 구역에 채보를 나눠 보여 주고, 단계와 점수와 달성률이 함께 나온다", async () => {
    fetchMock.mockResolvedValueOnce(json(skill()));
    renderView();
    const single = await screen.findByRole("region", { name: "단일" });
    expect(within(single).getByText("1/15")).toBeInTheDocument();
    expect(within(single).getByText("테스트곡")).toBeInTheDocument();
    expect(within(single).getByLabelText("달성 단계 SS")).toBeInTheDocument();
    expect(within(single).getByText("264.00")).toBeInTheDocument();
    expect(within(single).getByText("96.50")).toBeInTheDocument();
    expect(within(single).getByText(/상수/)).toHaveTextContent("기준 5.8 · 상수 14.00 · 단일");

    const other = screen.getByRole("region", { name: "복합·이중·삼중" });
    expect(within(other).getByText("1/25")).toBeInTheDocument();
    expect(within(other).getByText("복합곡")).toBeInTheDocument();
    expect(within(other).getByLabelText("달성 단계 EXC")).toBeInTheDocument();
    expect(within(other).getByText("MAX")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/skills/me");
  });

  it("곡별 점수 숫자는 점수에 맞는 플레이어 티어 색이고, 하수봉 기준(237.5)을 넘으면 빛 단계가 붙는다", async () => {
    fetchMock.mockResolvedValueOnce(
      json(
        skill({
          single: [entry({ score: 264 })],
          other: [entry({ rank: 1, songDifficultyId: 11, title: "복합곡", pattern: "복합", score: 160.5 })],
        }),
      ),
    );
    renderView();
    const high = await screen.findByText("264.00");
    expect(high).toHaveAttribute("data-tier", "HASUBONG");
    expect(high).toHaveAttribute("data-glow", "1");
    expect(high).toHaveClass("tier-score");
    const mid = screen.getByText("160.50");
    expect(mid).toHaveAttribute("data-tier", "RED"); // 150 이상 162.5 미만
    expect(mid).not.toHaveAttribute("data-glow");
  });

  it("각 구역 제목 오른쪽에 그 구역의 점수 합산을 보여 준다", async () => {
    fetchMock.mockResolvedValueOnce(json(skill({ singleScore: 700.25, otherScore: 425.5 })));
    renderView();
    const single = await screen.findByRole("region", { name: "단일" });
    expect(within(single).getByText(/합산/)).toHaveTextContent("합산 700.25");
    const other = screen.getByRole("region", { name: "복합·이중·삼중" });
    expect(within(other).getByText(/합산/)).toHaveTextContent("합산 425.50");
  });

  it("모든 단계(S 포함)의 카드에 단계 효과(왼쪽 띠와 틴트)가 붙고, FC/EXC만 곡명 색이 바뀐다", async () => {
    fetchMock.mockResolvedValueOnce(
      json(
        skill({
          single: [
            entry({ songDifficultyId: 1, title: "에스곡", stage: "S", achievementRate: 85 }),
            entry({ songDifficultyId: 2, title: "에프씨곡", stage: "FC", achievementRate: 98, fullCombo: true }),
          ],
        }),
      ),
    );
    const { container } = renderView();
    await screen.findByText("에스곡");

    const cards = Array.from(container.querySelectorAll("li[data-stage]"));
    const byStage = (stage: string) => cards.find((li) => li.getAttribute("data-stage") === stage);
    for (const stage of ["S", "FC"]) {
      const card = byStage(stage);
      expect(card, stage).toBeDefined();
      expect(card).toHaveClass("stage-tint");
      expect(card?.querySelector(".stage-bar")).not.toBeNull();
    }
    // 곡명은 링크 안에 있고, 색 클래스는 감싼 문단에 붙는다
    expect(screen.getByText("에스곡").closest("p")).not.toHaveClass("stage-name");
    expect(screen.getByText("에프씨곡").closest("p")).toHaveClass("stage-name");
  });

  it("곡명을 누르면 그 채보의 곡 상세(서열표 기준)로 갈 수 있다", async () => {
    fetchMock.mockResolvedValueOnce(
      json(skill({ single: [entry({ songId: 100, songDifficultyId: 10, title: "링크곡" })], other: [entry({ songId: 200, songDifficultyId: 20, title: "복합링크곡" })] })),
    );
    renderView();
    expect(await screen.findByRole("link", { name: "링크곡" })).toHaveAttribute("href", "/songs/100?from=table&chart=10");
    expect(screen.getByRole("link", { name: "복합링크곡" })).toHaveAttribute("href", "/songs/200?from=table&chart=20");
  });

  it("기록이 하나도 없으면 안내와 서열표 링크를 보여 준다", async () => {
    fetchMock.mockResolvedValueOnce(json(skill({ totalScore: 0, singleScore: 0, otherScore: 0, single: [], other: [] })));
    renderView();
    expect(await screen.findByText(/레이팅에 들어갈 기록이 아직 없습니다/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "서열표" })).toHaveAttribute("href", "/table");
    expect(screen.getByText("속성이 단일인 채보의 기록이 아직 없습니다.")).toBeInTheDocument();
  });

  it("한쪽 그룹만 모자라도 있는 만큼만 보여 준다 (목록이 모자랄 때)", async () => {
    fetchMock.mockResolvedValueOnce(json(skill({ other: [] })));
    renderView();
    const single = await screen.findByRole("region", { name: "단일" });
    expect(within(single).getByText("테스트곡")).toBeInTheDocument();
    expect(screen.getByText("0/25")).toBeInTheDocument();
    expect(screen.queryByText(/레이팅에 들어갈 기록이 아직 없습니다/)).toBeNull();
  });

  it("서버 오류는 서버가 준 문구로 알려 준다", async () => {
    fetchMock.mockResolvedValueOnce(json({ code: "INTERNAL", message: "서버에 문제가 생겼습니다.", timestamp: "t" }, 500));
    renderView();
    expect(await screen.findByRole("alert")).toHaveTextContent("서버에 문제가 생겼습니다.");
  });
});
