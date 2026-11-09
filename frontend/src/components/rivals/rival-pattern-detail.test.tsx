import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTranslator } from "use-intl/core";
import ja from "../../../messages/ja.json";
import ko from "../../../messages/ko.json";
import { resetShowJacketsForTest, setJacketData } from "@/lib/jackets";

// 공용 setup은 한국어 번역만 끼우므로, 이 파일에서는 locale을 바꿔 가며 ko/ja를 모두 확인한다.
const state = vi.hoisted(() => ({ locale: "ko" as "ko" | "ja" }));
vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) =>
    createTranslator({ locale: state.locale, messages: state.locale === "ja" ? ja : ko, namespace } as never),
  useLocale: () => state.locale,
  NextIntlClientProvider: ({ children }: { children: unknown }) => children,
}));

import { RivalPatternDetailView } from "@/components/rivals/RivalPatternDetailView";
import type { RivalDetailFilter, RivalDetailRow, RivalSummaryDetailResponse } from "@/lib/api-types";

const MINUS = "−";
function detailRow(id: number, diff: number, myRate = 95): RivalDetailRow {
  return {
    songDifficultyId: id, songId: 100 + id, title: `Song ${id}`, part: "BASS", difficulty: "EXTREME", level: 9.2, tier: 5.6, pattern: "삼중",
    rate: 96, stage: "SS", score: 240, myRate, myStage: "SS", myScore: 240 + diff, diff,
  };
}
function response(over: Partial<RivalSummaryDetailResponse> = {}): RivalSummaryDetailResponse {
  return {
    userId: 7, nickname: "Rumi",
    summary: { pattern: "삼중", key: "TRIPLE", wins: 4, ties: 1, losses: 6, scoreDiffSum: -42.67, closeCount: 3, sharedCount: 11 },
    filterCounts: { all: 11, lose: 6, close: 3, win: 4 },
    rows: { content: [detailRow(1, -4.37, 93.9), detailRow(2, 2.28, 97.84), detailRow(3, 0, 96)], page: 0, size: 20, totalElements: 3, totalPages: 1 },
    ...over,
  };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const fetchMock = vi.fn<typeof fetch>();

function show(props: Partial<React.ComponentProps<typeof RivalPatternDetailView>> = {}, body: unknown = response(), status = 200) {
  fetchMock.mockImplementation(async () => json(body, status));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RivalPatternDetailView viewerId={1} targetId={7} patternKey="TRIPLE" filter="ALL" page={0} from={null} onFilterChange={vi.fn()} onPageChange={vi.fn()} {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.locale = "ko";
  localStorage.clear();
  resetShowJacketsForTest();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  act(() => setJacketData(null));
});

describe("라이벌 속성 상세 (D67, 6단계)", () => {
  it("제목 `삼중 · {닉네임}와 비교`, 요약 3칸(승·무·패 / 점수 차 합계 / 접전 곡 수)을 보인다", async () => {
    show();
    expect(await screen.findByRole("heading", { name: "삼중 · Rumi와 비교" })).toBeInTheDocument();
    const summary = screen.getByRole("region", { name: "속성 요약" });
    expect(summary).toHaveTextContent("승 4 · 무 1 · 패 6");
    expect(summary).toHaveTextContent(`${MINUS}42.67`);
    expect(summary).toHaveTextContent("접전 곡 수");
    expect(summary).toHaveTextContent("3");
    expect(summary).not.toHaveTextContent("※ 5곡 미만"); // 11곡
  });

  it("필터 칩은 전체·열세·접전·우세 순이고 각 곡 수가 들어 있다. 선택한 칩이 눌린 상태다", async () => {
    show({ filter: "LOSE" });
    await screen.findByRole("heading", { name: /Rumi/ });
    const chips = within(screen.getByRole("group", { name: "필터" })).getAllByRole("button");
    expect(chips.map((b) => b.textContent)).toEqual(["전체 11", "열세 6", "접전 3", "우세 4"]);
    expect(chips[1]).toHaveAttribute("aria-pressed", "true");
  });

  it("칩을 누르면 필터 값을 부모(주소)에 알린다", async () => {
    const onFilterChange = vi.fn<(f: RivalDetailFilter) => void>();
    show({ onFilterChange });
    fireEvent.click(await screen.findByRole("button", { name: "접전 3" }));
    expect(onFilterChange).toHaveBeenCalledWith("CLOSE");
  });

  it("곡 줄에 상대 점수 · `나 …` · 차이 칩(부호 글자)을 공통 줄로 보이고, 요청에는 속성 키·필터·쪽·크기가 실린다", async () => {
    show({ filter: "WIN", page: 2 });
    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Song 1");
    expect(items[0]).toHaveTextContent(`나 235.63`);
    // 칩은 달성률 차(%, 내 − 상대): 93.9−96=−2.10%, 97.84−96=+1.84%, 96−96=±0.00%
    expect(within(items[0]).getByText(`${MINUS}2.10%`)).toHaveClass("border-weak");
    expect(within(items[1]).getByText("+1.84%")).toHaveClass("border-done");
    expect(within(items[2]).getByText("±0.00%")).toBeInTheDocument();
    expect(within(items[0]).queryByText(`${MINUS}4.37`)).toBeNull();
    expect(within(items[0]).getByRole("link", { name: /Song 1/ })).toHaveAttribute("href", "/songs/101?chart=1");
    const url = new URL(String(fetchMock.mock.calls[0][0]), "http://localhost");
    expect(url.pathname).toBe("/api/v1/players/7/compare/summary/TRIPLE");
    expect(url.searchParams.get("filter")).toBe("WIN");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("size")).toBe("20");
    expect(url.searchParams.has("sort")).toBe(false); // 정렬은 서버 기본값
    expect(screen.getByText("+는 내가 앞, −는 내가 뒤 (내 점수 − 상대 점수)")).toBeInTheDocument();
  });

  it("쪽이 둘 이상이면 이전/다음이 나오고 누르면 쪽을 부모에 알린다", async () => {
    const onPageChange = vi.fn<(page: number) => void>();
    show({ onPageChange }, response({ rows: { content: [detailRow(1, 1)], page: 0, size: 20, totalElements: 41, totalPages: 3 } }));
    fireEvent.click(await screen.findByRole("button", { name: "다음" }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("해당하는 곡이 0곡이면 안내 문구를 보인다", async () => {
    show({}, response({ rows: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 } }));
    expect(await screen.findByText("해당하는 곡이 없습니다.")).toBeInTheDocument();
  });

  it("공유 곡이 5곡 미만이면 요약에 `※ 5곡 미만이라 참고용`을 붙인다", async () => {
    show({}, response({ summary: { pattern: "삼중", key: "TRIPLE", wins: 1, ties: 0, losses: 0, scoreDiffSum: 1, closeCount: 0, sharedCount: 1 } }));
    expect(await screen.findByText("※ 5곡 미만이라 참고용")).toBeInTheDocument();
  });

  it("뒤로 가기는 대시보드로 돌아가고, 들어올 때의 탭(`from`)이 있으면 주소에 싣는다", async () => {
    show({ from: "weak" });
    expect(await screen.findByRole("link", { name: "라이벌 비교로" })).toHaveAttribute("href", "/players/7/compare?tab=weak");
  });

  it("뒤로 가기: from이 없으면 탭 없이 돌아간다", async () => {
    show();
    expect(await screen.findByRole("link", { name: "라이벌 비교로" })).toHaveAttribute("href", "/players/7/compare");
  });

  it("상대가 비공개거나 없으면(404) 찾을 수 없다고 안내한다", async () => {
    show({}, { code: "NOT_FOUND", message: "찾을 수 없습니다." }, 404);
    expect(await screen.findByRole("alert")).toHaveTextContent("찾을 수 없");
  });

  it("일본어: 제목·필터·요약·안내", async () => {
    state.locale = "ja";
    show();
    expect(await screen.findByRole("heading", { name: "三色 · Rumiとの比較" })).toBeInTheDocument();
    const chips = within(screen.getByRole("group", { name: "絞り込み" })).getAllByRole("button");
    expect(chips.map((b) => b.textContent)).toEqual(["すべて 11", "劣勢 6", "接戦 3", "優勢 4"]);
    const summary = screen.getByRole("region", { name: "属性サマリー" });
    expect(summary).toHaveTextContent("勝 4 · 分 1 · 敗 6");
    expect(summary).toHaveTextContent("点差の合計");
    expect(summary).toHaveTextContent("接戦の曲数");
    await waitFor(() => expect(screen.getByText(/^\+は自分が上/)).toBeInTheDocument());
  });
});
