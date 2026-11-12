import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RatingCutlineCard } from "@/components/song/RatingCutlineCard";
import type { RatingSimulationResponse, SimulationResult } from "@/lib/rating-simulation";

const CHART = 10;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** 서버가 계산해서 주는 응답 모양(테스트에서는 직접 계산한 값을 그대로 넣는다) */
function response(over: Partial<RatingSimulationResponse> = {}): RatingSimulationResponse {
  return {
    status: "NO_RECORD",
    notRatedReason: null,
    group: "SINGLE",
    groupLimit: 15,
    groupSize: 15,
    currentRate: null,
    currentScore: null,
    currentRank: null,
    cutline: { lastScore: 240, requiredRate: 80.01, reachable: true, rateGap: null, groupFull: true },
    simulation: null,
    ...over,
  };
}

function result(over: Partial<SimulationResult> = {}): SimulationResult {
  return {
    achievement: 95,
    belowBest: false,
    entered: true,
    rank: 3,
    scoreAfter: 304,
    totalBefore: 848,
    totalAfter: 912,
    totalChange: 64,
    pushedOut: { songDifficultyId: 3, songId: 103, title: "탈락곡", part: "GUITAR", difficulty: "MASTER", level: 9.5, score: 240 },
    ...over,
  };
}

describe("RatingCutlineCard", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  /** achievement 쿼리가 없으면 컷라인 응답, 있으면 시뮬레이션 응답을 준다 */
  function givenServer(cutline: RatingSimulationResponse, simulation: SimulationResult = result()) {
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      return Promise.resolve(json(url.includes("achievement=") ? { ...cutline, simulation } : cutline));
    });
  }

  function renderCard() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <RatingCutlineCard chartId={CHART} userId={1} />
      </QueryClientProvider>,
    );
  }

  async function card(): Promise<HTMLElement> {
    return screen.findByRole("region", { name: "컷라인 · 목표 달성률" });
  }

  function achievementsRequested(): string[] {
    return fetchMock.mock.calls
      .map(([input]) => new URL(String(input), "http://localhost").searchParams.get("achievement"))
      .filter((value): value is string => value !== null);
  }

  it("이미 목록 안이면 순위와 컷라인까지 여유를 보여 주고, 입력칸은 비어 있다", async () => {
    givenServer(
      response({
        status: "IN_LIST",
        currentRate: 90,
        currentScore: 282.67,
        currentRank: 3,
        cutline: { lastScore: 282.67, requiredRate: 80.01, reachable: true, rateGap: -9.99, groupFull: true },
      }),
    );
    renderCard();

    const el = await card();
    expect(el).toHaveTextContent("단일 · 15/15곡");
    expect(el).toHaveTextContent("90.00% · 282.67 · 3위");
    expect(el).toHaveTextContent("컷라인 80.01%까지 9.99% 여유가 있습니다.");
    expect(el).not.toHaveTextContent("목록에 들어가려면");
    expect(screen.getByLabelText("목표 달성률")).toHaveValue("");
  });

  it("목록 밖이면 필요 달성률과 더 올릴 양을 보여 주고, 입력칸은 컷라인 달성률에서 시작한다", async () => {
    givenServer(
      response({
        status: "OUT_OF_LIST",
        currentRate: 70,
        currentScore: 210,
        cutline: { lastScore: 240, requiredRate: 80.01, reachable: true, rateGap: 10.01, groupFull: true },
      }),
    );
    renderCard();

    const el = await card();
    expect(el).toHaveTextContent("70.00% · 210.00 · 목록 밖");
    expect(el).toHaveTextContent("목록에 들어가려면 80.01% 이상(+10.01%)");
    expect(screen.getByLabelText("목표 달성률")).toHaveValue("8001");
  });

  it("기록이 없으면 입력이 컷라인 달성률에서 시작한다", async () => {
    givenServer(response());
    renderCard();

    const el = await card();
    expect(el).toHaveTextContent("기록 없음");
    expect(el).toHaveTextContent("목록에 들어가려면 80.01% 이상");
    expect(el).not.toHaveTextContent("(+");
    expect(screen.getByLabelText("목표 달성률")).toHaveValue("8001");
  });

  it("그룹이 덜 찼으면 기록만 남기면 들어간다고 알린다", async () => {
    givenServer(
      response({
        groupSize: 2,
        cutline: { lastScore: null, requiredRate: 0, reachable: true, rateGap: null, groupFull: false },
      }),
    );
    renderCard();

    const el = await card();
    expect(el).toHaveTextContent("자리가 남아 있습니다");
    expect(el).toHaveTextContent("목록에 자리가 남아 있어 기록만 남기면 들어갑니다.");
  });

  it("MAX로도 못 들어가면 그렇게 알리고 입력칸은 비운다", async () => {
    givenServer(response({ cutline: { lastScore: 384, requiredRate: null, reachable: false, rateGap: null, groupFull: true } }));
    renderCard();

    const el = await card();
    expect(el).toHaveTextContent("달성률 MAX로도 목록에 들어갈 수 없습니다.");
    expect(screen.getByLabelText("목표 달성률")).toHaveValue("");
  });

  it("레이팅 대상이 아니면 카드는 숨기고 안내 한 줄만 보여 준다", async () => {
    givenServer(response({ status: "NOT_RATED", notRatedReason: "TIER_UNDECIDED", group: null, cutline: null }));
    renderCard();

    expect(await screen.findByText("서열표 기준 난이도가 정해지지 않은 채보라 레이팅에 반영되지 않습니다.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "컷라인 · 목표 달성률" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("목표 달성률")).not.toBeInTheDocument();
  });

  it("빠른 칩을 누르면 그 달성률로 묻고, 진입 순위·총점 변화·밀려나는 곡을 보여 준다", async () => {
    givenServer(response({ cutline: { lastScore: 240, requiredRate: 80.01, reachable: true, rateGap: null, groupFull: true } }));
    renderCard();
    await card();

    fireEvent.click(screen.getByRole("button", { name: "95%" }));

    const el = await screen.findByText("단일 3위로 진입");
    expect(el).toBeInTheDocument();
    expect(achievementsRequested()).toContain("95.00");
    expect(screen.getByLabelText("목표 달성률")).toHaveValue("9500");
    expect(screen.getByRole("button", { name: "95%" })).toHaveAttribute("aria-pressed", "true");
    const region = screen.getByRole("region", { name: "컷라인 · 목표 달성률" });
    expect(region).toHaveTextContent("+64.00 (848.00 → 912.00)");
    expect(region).toHaveTextContent("밀려나는 곡");
    expect(region).toHaveTextContent("탈락곡");
    expect(region).toHaveTextContent("MAS 9.50");
    expect(region).toHaveTextContent("240.00");
  });

  it("빠른 칩은 73·80·90·95 순서로 4개뿐이고 MAX 칩은 없다", async () => {
    givenServer(response());
    renderCard();
    await card();

    const chips = within(screen.getByRole("group", { name: "빠른 입력" })).getAllByRole("button");
    expect(chips.map((b) => b.textContent)).toEqual(["73%", "80%", "90%", "95%"]);
    expect(screen.queryByRole("button", { name: "MAX" })).not.toBeInTheDocument();
  });

  it.each([
    ["73%", "73.00", "7300"],
    ["80%", "80.00", "8000"],
    ["90%", "90.00", "9000"],
  ])("%s 칩은 %s로 묻는다", async (label, requested, inputText) => {
    givenServer(response());
    renderCard();
    await card();

    fireEvent.click(screen.getByRole("button", { name: label }));

    await waitFor(() => expect(achievementsRequested()).toContain(requested));
    expect(screen.getByLabelText("목표 달성률")).toHaveValue(inputText);
  });

  it("MAX(100.00)는 칩이 없어도 직접 입력으로 묻는다", async () => {
    givenServer(response());
    renderCard();
    await card();

    fireEvent.change(screen.getByLabelText("목표 달성률"), { target: { value: "10000" } });

    await waitFor(() => expect(achievementsRequested()).toContain("100.00"));
  });

  it("못 들어가는 달성률이면 그렇게 알리고, 내 최고 기록보다 낮으면 변화가 없다고 알린다", async () => {
    givenServer(response(), result({ entered: false, rank: null, pushedOut: null, totalChange: 0, totalAfter: 848, belowBest: true }));
    renderCard();
    await card();

    fireEvent.click(screen.getByRole("button", { name: "80%" }));

    expect(await screen.findByText("목록에 들어가지 못합니다.")).toBeInTheDocument();
    expect(screen.getByText("내 최고 기록보다 낮아 변화가 없습니다.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "컷라인 · 목표 달성률" })).toHaveTextContent("±0.00");
    expect(screen.queryByText("밀려나는 곡")).not.toBeInTheDocument();
  });

  it("이미 목록 안인 채보를 시뮬레이션하면 '진입'이 아니라 순위만 말한다", async () => {
    givenServer(
      response({ status: "IN_LIST", currentRate: 90, currentScore: 282.67, currentRank: 3, cutline: { lastScore: 282.67, requiredRate: 80.01, reachable: true, rateGap: -9.99, groupFull: true } }),
      result({ pushedOut: null }),
    );
    renderCard();
    await card();

    fireEvent.click(screen.getByRole("button", { name: "90%" }));

    expect(await screen.findByText("단일 3위")).toBeInTheDocument();
    expect(screen.queryByText(/로 진입/)).not.toBeInTheDocument();
  });

  it("범위를 벗어난 입력은 오류를 보여 주고 서버에 묻지 않는다", async () => {
    givenServer(response());
    renderCard();
    await card();
    const input = screen.getByLabelText("목표 달성률");

    fireEvent.change(input, { target: { value: "10001" } });

    expect(await screen.findByRole("alert")).toHaveTextContent("달성률은 0 이상 10000 이하여야 합니다.");
    await new Promise((resolve) => setTimeout(resolve, 600)); // 입력을 멈춘 뒤 기다리는 시간(400ms)보다 오래 기다려도
    expect(achievementsRequested()).not.toContain("100.01");
  });

  it("소수점 같은 숫자 이외의 글자는 칸에 들어가지 못하고, 입력을 멈추면 그 값으로 묻는다", async () => {
    givenServer(response());
    renderCard();
    await card();
    const input = screen.getByLabelText("목표 달성률");

    fireEvent.change(input, { target: { value: "96.5" } });

    expect(input).toHaveValue("965");
    // 세 자리는 끝에 0을 붙여 읽는다(965 -> 96.50). 기록 입력과 같은 규칙이다
    await waitFor(() => expect(achievementsRequested()).toContain("96.50"));
  });

  it("컷라인을 불러오지 못하면 카드 안에서 안내하고 다시 시도할 수 있다", async () => {
    fetchMock.mockResolvedValue(json({ code: "INTERNAL_ERROR", message: "x" }, 500));
    renderCard();

    expect(await screen.findByText("컷라인을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /다시 시도/ })).toBeInTheDocument();
  });
});
