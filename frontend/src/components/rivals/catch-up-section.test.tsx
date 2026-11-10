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

import { RivalCompareView } from "@/components/rivals/RivalCompareView";
import type { RivalCompareRatingResponse, RivalRatingRow, SetlistItemResponse } from "@/lib/api-types";

const gold = { key: "GOLD", displayName: "Gold", minScore: 5500, nextMinScore: 6000, nextDisplayName: "Platinum" };
const MINUS = "−";

/** 곡 한 줄: gap = 내 달성률 − 상대 달성률(%p, 상대 95.20 기준). 점수 차(diff)는 일부러 0으로 둔다(95% 이상은 점수가 같다). gap이 null이면 내 기록 없음. */
function row(id: number, gap: number | null, over: Partial<RivalRatingRow> = {}): RivalRatingRow {
  return {
    rank: id, songDifficultyId: 10 + id, songId: 100 + id, title: `Song ${id}`, part: "GUITAR", difficulty: "MASTER", level: 9.5, tier: 5.4,
    pattern: "복합(단일)", rate: 95.2, stage: "SS", score: 238.1,
    myRate: gap === null ? null : Math.round((95.2 + gap) * 100) / 100, myScore: gap === null ? null : 238.1, diff: gap === null ? null : 0, ...over,
  };
}
function response(single: RivalRatingRow[], other: RivalRatingRow[] = []): RivalCompareRatingResponse {
  return {
    userId: 7, nickname: "Rumi", tier: gold, totalScore: 9516.42, myTier: gold, myTotalScore: 9204.32,
    counts: { win: 1, lose: 1, tie: 1, theirsOnly: 1 }, single, other,
  };
}
function setlistItem(songDifficultyId: number): SetlistItemResponse {
  return {
    id: songDifficultyId, songDifficultyId, songId: 1, title: "x", part: "GUITAR", difficulty: "MASTER", level: 9.5, tier: 5.4, pattern: "단일", mine: null, done: false, createdAt: "2026-11-09T00:00:00Z",
  };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const fetchMock = vi.fn<typeof fetch>();
let setlist: SetlistItemResponse[] = [];

function show(single: RivalRatingRow[], other: RivalRatingRow[] = []) {
  fetchMock.mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.includes("/compare/rating")) return json(response(single, other));
    if (url.includes("/setlist") && method === "POST") {
      const id = JSON.parse(String(init?.body)).songDifficultyId as number;
      setlist = [...setlist, setlistItem(id)];
      return json(setlistItem(id), 201);
    }
    if (url.includes("/setlist")) return json({ content: setlist, totalElements: setlist.length, totalPages: 1, number: 0, size: 30 });
    return json({}, 404);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RivalCompareView viewerId={1} targetId={7} />
    </QueryClientProvider>,
  );
}
const section = () => screen.findByRole("region", { name: state.locale === "ja" ? "追いつきたい曲" : "따라잡을 곡" });

beforeEach(() => {
  state.locale = "ko";
  setlist = [];
  localStorage.clear();
  resetShowJacketsForTest();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  act(() => setJacketData(null));
});

describe("따라잡을 곡 (D66)", () => {
  it("내가 뒤진 곡만 차이가 작은 순으로 최대 3곡을 보이고, 제목·설명을 쓴다", async () => {
    show([row(1, -4.37), row(2, -1.85), row(3, 2.28)], [row(4, -0.5), row(5, -9), row(6, -3)]);
    const box = await section();
    expect(within(box).getByRole("heading", { name: "따라잡을 곡" })).toBeInTheDocument();
    expect(within(box).getByText("내가 뒤진 곡 중 차이가 작은 순 · 3곡")).toBeInTheDocument();
    const items = within(box).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Song 4");
    expect(items[1]).toHaveTextContent("Song 2");
    expect(items[2]).toHaveTextContent("Song 6");
    // 선택·정렬은 칩과 같은 달성률 차 기준이고(D67 개정), 칩은 달성률 차(%)로 부호가 글자로 보이며 뒤진 쪽 색(주황)이다
    expect(within(items[0]).getByText(`${MINUS}0.50%`)).toHaveClass("text-weak-text", "border-weak");
    expect(within(items[1]).getByText(`${MINUS}1.85%`)).toBeInTheDocument();
    expect(within(items[2]).getByText(`${MINUS}3.00%`)).toBeInTheDocument();
  });

  it("점수 차가 0이어도(달성률 95 이상) 달성률로 뒤졌으면 뽑히고, 칩은 항상 −다(`뒤진 곡인데 +로 보이는` 어긋남이 없다)", async () => {
    show([row(1, -2.1), row(2, 0.5), row(3, 0)]);
    const box = await section();
    const items = within(box).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Song 1");
    expect(within(items[0]).getByText(`${MINUS}2.10%`)).toBeInTheDocument();
    expect(within(box).queryByText(/^\+/)).toBeNull();
    expect(within(box).queryByText("±0.00%")).toBeNull();
  });

  it("앞선 곡·동점·내 기록 없음은 넣지 않는다", async () => {
    show([row(1, 2.28), row(2, 0), row(3, null), row(4, -0.01)]);
    const box = await section();
    const items = within(box).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Song 4");
  });

  it("3곡 미만이면 있는 만큼 보이고, 설명의 곡 수도 그만큼이다", async () => {
    show([row(1, -1), row(2, -2)]);
    const box = await section();
    expect(within(box).getAllByRole("listitem")).toHaveLength(2);
    expect(within(box).getByText("내가 뒤진 곡 중 차이가 작은 순 · 2곡")).toBeInTheDocument();
  });

  it("뒤진 곡이 하나도 없으면 구역을 숨긴다", async () => {
    show([row(1, 3), row(2, 0)]);
    await screen.findByText(/^\+는 내가 앞/);
    expect(screen.queryByRole("region", { name: "따라잡을 곡" })).toBeNull();
    expect(screen.queryByText("따라잡을 곡")).toBeNull();
  });

  it("`담기`를 누르면 그 곡 하나만 담기 요청을 보내고 `담김`으로 바뀐다(한꺼번에 담기 버튼은 없다)", async () => {
    show([row(1, -1), row(2, -2)]);
    const box = await section();
    const buttons = await within(box).findAllByRole("button", { name: /세트리스트에 담기$/ });
    expect(buttons).toHaveLength(2);
    await waitFor(() => expect(buttons[0]).toBeEnabled());
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(within(box).getByRole("button", { name: "Song 1 세트리스트에 담김" })).toBeDisabled());
    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(JSON.parse(String(posts[0][1]?.body))).toEqual({ songDifficultyId: 11 });
    // 다른 곡은 그대로 `담기`
    expect(within(box).getByRole("button", { name: "Song 2 세트리스트에 담기" })).toBeEnabled();
    expect(within(box).getByText("담김")).toBeInTheDocument();
  });

  it("이미 담긴 곡은 처음부터 `담김`(초록 테두리 + 글자)이고 눌리지 않는다", async () => {
    setlist = [setlistItem(11)];
    show([row(1, -1)]);
    const box = await section();
    const done = await within(box).findByRole("button", { name: "Song 1 세트리스트에 담김" });
    await waitFor(() => expect(done).toHaveTextContent("담김"));
    expect(done).toBeDisabled();
    expect(done).toHaveClass("border-done", "text-done-text");
  });

  it("세트리스트가 30곡 차 있으면 새로 담는 `담기`는 막힌다", async () => {
    setlist = Array.from({ length: 30 }, (_, i) => setlistItem(500 + i));
    show([row(1, -1)]);
    const box = await section();
    const button = await within(box).findByRole("button", { name: "Song 1 세트리스트에 담기" });
    await waitFor(() => expect(button).toBeDisabled());
  });

  it("재킷이 꺼져 있으면 재킷 칸이 없다", async () => {
    show([row(1, -1)]);
    const box = await section();
    expect(box.querySelector("li .bg-jacket")).toBeNull();
  });

  it("재킷이 켜져 있으면 줄에 재킷 칸이 생긴다(이미지가 없으면 단색 칸)", async () => {
    act(() => setJacketData({ enabled: true, jackets: {} }));
    show([row(1, -1)]);
    const box = await section();
    expect(box.querySelector("li .bg-jacket")).not.toBeNull();
  });

  it("일본어: 제목·설명·버튼이 번역되고 차이 칩 부호는 그대로다", async () => {
    state.locale = "ja";
    show([row(1, -2.1)]);
    const box = await section();
    expect(within(box).getByRole("heading", { name: "追いつきたい曲" })).toBeInTheDocument();
    expect(within(box).getByText("自分が負けている曲のうち、差が小さい順 · 1曲")).toBeInTheDocument();
    expect(within(box).getByText(`${MINUS}2.10%`)).toBeInTheDocument();
    expect(within(box).queryByText(/[가-힣]/)).toBeNull();
  });
});
