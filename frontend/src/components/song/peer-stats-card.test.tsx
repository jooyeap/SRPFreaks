import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PeerStatsCard } from "@/components/song/PeerStatsCard";
import type { PeerChartStat, PeerStatsResponse } from "@/lib/peer-stats";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const CHART = 10;

function stat(over: Partial<PeerChartStat> = {}): PeerChartStat {
  return { songDifficultyId: CHART, users: 6, medianRate: 88, expectedGain: 12.4, inMyList: false, myRate: null, ...over };
}

/** 카드 틀은 불러오는 동안에도 있으므로, 값이 채워질 때까지 기다린 뒤 카드를 돌려준다 */
async function loadedCard(): Promise<HTMLElement> {
  await screen.findByText("레이팅에 포함된 유저 수");
  return screen.getByRole("region", { name: "같은 티어 유저 기록" });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("PeerStatsCard", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  function givenResponse(response: PeerStatsResponse) {
    fetchMock.mockResolvedValue(json(response));
  }

  function renderCard() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <PeerStatsCard chartId={CHART} userId={1} />
      </QueryClientProvider>,
    );
  }

  it("레이팅에 포함된 유저 수, 달성률 중앙값, 내 예상 레이팅을 보여 준다", async () => {
    givenResponse({ tierName: "SS 3", bandUsers: 8, charts: [stat()] });
    renderCard();

    const card = await loadedCard();
    expect(card).toHaveTextContent("레이팅에 포함된 유저 수");
    expect(card).toHaveTextContent("6명 / 8명");
    expect(card).toHaveTextContent("달성률");
    expect(card).toHaveTextContent("88.00%");
    expect(card).toHaveTextContent("내 예상 레이팅");
    expect(card).toHaveTextContent("+12.40점");
    expect(card).not.toHaveTextContent("추천");
  });

  it("이미 레이팅에 포함된 곡은 내 기록을 보여 주고, 오를 점수가 있으면 예상 레이팅도 같이 보여 준다", async () => {
    givenResponse({ tierName: "SS 3", bandUsers: 8, charts: [stat({ inMyList: true, myRate: 82.1, expectedGain: 5.2 })] });
    renderCard();

    const card = await loadedCard();
    expect(card).toHaveTextContent("82.10% · 이미 레이팅에 포함");
    expect(card).toHaveTextContent("+5.20점");
  });

  it("이미 내 기록이 더 높아 오를 점수가 0이면 예상 레이팅 줄을 숨긴다", async () => {
    givenResponse({ tierName: "SS 3", bandUsers: 8, charts: [stat({ inMyList: true, myRate: 93.4, expectedGain: 0 })] });
    renderCard();

    const card = await loadedCard();
    expect(card).toHaveTextContent("93.40% · 이미 레이팅에 포함");
    expect(card).not.toHaveTextContent("내 예상 레이팅");
  });

  it("레이팅 대상이 아니라 예상 점수가 없으면 그 줄만 없다", async () => {
    givenResponse({ tierName: "SS 3", bandUsers: 8, charts: [stat({ expectedGain: null })] });
    renderCard();

    const card = await loadedCard();
    expect(card).toHaveTextContent("6명 / 8명");
    expect(card).not.toHaveTextContent("내 예상 레이팅");
  });

  it("달성률 중앙값이 100.00이면 MAX로 쓴다", async () => {
    givenResponse({ tierName: "SS 3", bandUsers: 8, charts: [stat({ medianRate: 100 })] });
    renderCard();

    expect(await loadedCard()).toHaveTextContent("MAX");
  });

  it("기준 인원에 못 미쳐 응답에 채보가 없으면 카드를 그리지 않는다", async () => {
    givenResponse({ tierName: "SS 3", bandUsers: 4, charts: [] });
    renderCard();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("region", { name: "같은 티어 유저 기록" })).not.toBeInTheDocument());
    expect(screen.queryByText("같은 티어 유저 기록")).not.toBeInTheDocument();
  });

  it("불러오는 동안은 아무것도 그리지 않는다 (없는 경우가 흔해서 카드가 나타났다 사라지지 않게)", () => {
    fetchMock.mockReturnValue(new Promise<Response>(() => {}));
    renderCard();

    expect(screen.queryByRole("region", { name: "같은 티어 유저 기록" })).not.toBeInTheDocument();
  });

  it("실패하면 카드 안에 안내와 다시 시도 버튼을 보여 준다", async () => {
    fetchMock.mockResolvedValue(json({ code: "INTERNAL_ERROR", message: "서버 오류" }, 500));
    renderCard();

    expect(await screen.findByText("같은 티어 유저 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });

  it("`?`를 누르면 설명이 열린다", async () => {
    givenResponse({ tierName: "SS 3", bandUsers: 8, charts: [stat()] });
    renderCard();

    await loadedCard();
    expect(screen.queryByText("달성률은 그 유저들이 이 곡에 남긴 달성률의 중앙값입니다.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "같은 티어 유저 기록 설명 보기" }));

    expect(screen.getByText("나와 같은 티어의 공개 유저가 `기록하기`로 저장한 레이팅을 모은 값입니다.")).toBeInTheDocument();
    expect(screen.getByText("달성률은 그 유저들이 이 곡에 남긴 달성률의 중앙값입니다.")).toBeInTheDocument();
    expect(screen.getByText("내 예상 레이팅은 이 달성률로 쳤을 때 오르는 내 레이팅 점수입니다.")).toBeInTheDocument();
    expect(screen.getByText("유저 수가 적으면 이 기록은 보이지 않습니다.")).toBeInTheDocument();
  });
});
