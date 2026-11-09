import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
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

import { RivalCompareView } from "@/components/rivals/RivalCompareView";
import type { RivalCompareRatingResponse, RivalRatingRow } from "@/lib/api-types";

const gold = { key: "GOLD", displayName: "Gold", minScore: 5500, nextMinScore: 6000, nextDisplayName: "Platinum" };
const MINUS = "−";

function row(rank: number, over: Partial<RivalRatingRow> = {}): RivalRatingRow {
  return {
    rank, songDifficultyId: 10 + rank, songId: 100 + rank, title: `Song ${rank}`, part: "GUITAR", difficulty: "MASTER", level: 9.5, tier: 5.4,
    pattern: "복합(단일)", rate: 95.2, stage: "SS", score: 238.1, myRate: 96, myScore: 240.38, diff: 2.28, ...over,
  };
}
function response(rows: RivalRatingRow[]): RivalCompareRatingResponse {
  return {
    userId: 7, nickname: "Rumi", tier: gold, totalScore: 9516.42, myTier: gold, myTotalScore: 9204.32,
    counts: { win: 1, lose: 1, tie: 1, theirsOnly: 1 }, single: rows, other: [],
  };
}

const fetchMock = vi.fn<typeof fetch>();
function show(rows: RivalRatingRow[]) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(response(rows)), { status: 200, headers: { "Content-Type": "application/json" } }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RivalCompareView viewerId={1} targetId={7} />
    </QueryClientProvider>,
  );
}
async function lines(): Promise<HTMLElement[]> {
  // 따라잡을 곡 구역(ul, D66)이 함께 있을 수 있어서 레이팅 목록(ol)만 고른다
  const list = (await screen.findAllByRole("list")).find((el) => el.tagName === "OL");
  if (!list) throw new Error("레이팅 목록(ol)이 없음");
  return within(list).getAllByRole("listitem");
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

describe("라이벌 비교 줄 차이 칩 (D65, 2026-11-09: 달성률 차 %)", () => {
  it("앞이면 +, 뒤면 −(진짜 마이너스), 같으면 ±, 내 기록이 없으면 `내 기록 없음`을 글자로 보인다(내 달성률 − 상대 달성률, 둘째 자리 %)", async () => {
    show([
      row(1, { myRate: 97.84, rate: 96, diff: 2.28 }),
      row(2, { myRate: 90, rate: 92.1, diff: -4.37, myScore: 233.73 }),
      row(3, { myRate: 95.2, rate: 95.2, diff: 0, myScore: 238.1 }),
      row(4, { myRate: null, myScore: null, diff: null }),
    ]);
    const items = await lines();
    expect(items).toHaveLength(4);
    expect(within(items[0]).getByText("+1.84%")).toBeInTheDocument();
    expect(within(items[1]).getByText(`${MINUS}2.10%`)).toBeInTheDocument();
    expect(within(items[2]).getByText("±0.00%")).toBeInTheDocument();
    expect(within(items[3]).getByText("내 기록 없음")).toBeInTheDocument();
    // 점수 차(+2.28)는 칩에 보이지 않는다
    expect(within(items[0]).queryByText("+2.28")).toBeNull();
  });

  it("칩 값은 점수가 아니라 달성률 차다: 점수가 같아도(95% 이상) 달성률 차가 보인다", async () => {
    show([row(1, { myRate: 98.5, rate: 96.4, diff: 0, myScore: 238.1 })]);
    const [item] = await lines();
    expect(within(item).getByText("+2.10%")).toBeInTheDocument();
  });

  it("경계: 부동소수점 찌꺼기는 ±0.00%이고 +0.00%, −0.00%은 나오지 않는다. +0.01%, −0.01%은 부호가 보인다", async () => {
    show([
      row(1, { myRate: 0.3, rate: 0.1 + 0.2 }),
      row(2, { myRate: 95.1, rate: 95.1 }),
      row(3, { myRate: 96.01, rate: 96 }),
      row(4, { myRate: 95.99, rate: 96 }),
    ]);
    const items = await lines();
    expect(within(items[0]).getByText("±0.00%")).toBeInTheDocument();
    expect(within(items[1]).getByText("±0.00%")).toBeInTheDocument();
    expect(within(items[2]).getByText("+0.01%")).toBeInTheDocument();
    expect(within(items[3]).getByText(`${MINUS}0.01%`)).toBeInTheDocument();
    expect(screen.queryByText("+0.00%")).toBeNull();
    expect(screen.queryByText(`${MINUS}0.00%`)).toBeNull();
  });

  it("차이 칩 색은 앞=초록·뒤=주황·같음/없음=중립이고, 부호 글자가 같이 있다(색만으로 구분하지 않는다)", async () => {
    show([
      row(1, { myRate: 97.84, rate: 96 }),
      row(2, { myRate: 90, rate: 92.1 }),
      row(3, { myRate: 95.2, rate: 95.2 }),
      row(4, { myScore: null, myRate: null, diff: null }),
    ]);
    const items = await lines();
    expect(within(items[0]).getByText("+1.84%")).toHaveClass("text-done-text", "border-done");
    expect(within(items[1]).getByText(`${MINUS}2.10%`)).toHaveClass("text-weak-text", "border-weak");
    expect(within(items[2]).getByText("±0.00%")).not.toHaveClass("text-done-text", "text-weak-text");
    expect(within(items[3]).getByText("내 기록 없음")).not.toHaveClass("text-done-text", "text-weak-text");
    // 읽기 프로그램용 이름에도 부호가 들어간다(달성률 차)
    expect(within(items[1]).getByLabelText(`상대와의 달성률 차 ${MINUS}2.10%`)).toBeInTheDocument();
  });
});

describe("라이벌 비교 줄 구성 (D65)", () => {
  it("순번, `속성 | 서열 난이도`, 곡명, 난이도 알약, 파트, 상대 점수, `나 점수` 순으로 한 줄에 담는다", async () => {
    show([row(3)]);
    const [item] = await lines();
    expect(item).toHaveTextContent("3");
    expect(item).toHaveTextContent("복합(단일)");
    expect(item).toHaveTextContent("5.4");
    expect(within(item).getByRole("link", { name: "Song 3" })).toHaveAttribute("href", "/songs/103?chart=13");
    expect(item).toHaveTextContent("MAS 9.50");
    expect(item).toHaveTextContent("Guitar");
    expect(item).toHaveTextContent("238");
    expect(within(item).getByText("나 240.38")).toBeInTheDocument();
    expect(item).toHaveClass("h-[68px]");
  });

  it("재킷은 설정이 켜졌을 때만 칸이 있고, 꺼지면 칸 자체가 없다", async () => {
    const { unmount } = show([row(1)]);
    const [off] = await lines();
    expect(off.querySelector("img")).toBeNull();
    expect(off.querySelector(".size-12")).toBeNull();
    unmount();

    act(() => setJacketData({ enabled: true, jackets: { "101": "/jackets/101.webp" } }));
    show([row(1)]);
    const [on] = await lines();
    expect(on.querySelector(".size-12")).not.toBeNull();
    expect(on.querySelector("img")).toHaveAttribute("src", "/jackets/101.webp");
  });

  it("일본어도 같은 구조이고 속성은 일본어 표기, 칩 문구와 안내문이 번역된다", async () => {
    state.locale = "ja";
    show([row(1, { myRate: 90, rate: 92.1, diff: -4.37 }), row(2, { myScore: null, myRate: null, diff: null })]);
    const items = await lines();
    expect(items[0]).toHaveTextContent("複合(単色)");
    expect(within(items[0]).getByText(`${MINUS}2.10%`)).toBeInTheDocument();
    expect(within(items[0]).getByText("自分 240.38")).toBeInTheDocument();
    expect(within(items[1]).getByText("記録なし")).toBeInTheDocument();
    expect(screen.getByText(`+は自分が上、${MINUS}は自分が下(自分のスコア ${MINUS} 相手のスコア)`)).toBeInTheDocument();
    expect(screen.queryByText(/내/)).toBeNull();
  });

  it("목록 맨 아래에 안내 한 줄이 있다", async () => {
    show([row(1)]);
    await lines();
    expect(screen.getByText(`+는 내가 앞, ${MINUS}는 내가 뒤 (내 점수 ${MINUS} 상대 점수)`)).toBeInTheDocument();
  });
});

describe("레이팅 비교 문구 (ko/ja)", () => {
  it("새 문구는 ko/ja 둘 다 있고 자리표시자가 같다", () => {
    const keys = ["ratingLegend", "myScoreLine", "diffNone", "rateDiffAria"] as const;
    for (const key of keys) {
      const k = ko.Rival[key];
      const j = ja.Rival[key];
      expect(k).toBeTruthy();
      expect(j).toBeTruthy();
      expect(j.match(/\{\w+\}/g)?.sort()).toEqual(k.match(/\{\w+\}/g)?.sort());
    }
  });
});
