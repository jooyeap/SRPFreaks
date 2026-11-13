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

import { AnalysisTab } from "@/components/mypage/AnalysisTab";
import type { SetlistItemResponse } from "@/lib/api-types";
import type { WeaknessAnalysisResponse, WeaknessBandRow, WeaknessEasyChart, WeaknessPatternRow } from "@/lib/weakness";

const MINUS = "−";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const fetchMock = vi.fn<typeof fetch>();
let setlist: SetlistItemResponse[] = [];

function pattern(p: WeaknessPatternRow["pattern"], over: Partial<WeaknessPatternRow> = {}): WeaknessPatternRow {
  return { pattern: p, myCharts: 0, myAvg: null, peerAvg: null, peerUsers: null, diff: null, ...over };
}
function band(from: number, over: Partial<WeaknessBandRow> = {}): WeaknessBandRow {
  return { tierFrom: from, tierTo: Math.round((from + 0.4) * 10) / 10, myCharts: 4, myAvg: 80, peerAvg: 82, peerUsers: 6, diff: -2, weak: false, ...over };
}
function easy(id: number, over: Partial<WeaknessEasyChart> = {}): WeaknessEasyChart {
  return {
    songDifficultyId: 10 + id, songId: 100 + id, title: `Song ${id}`, part: "GUITAR", difficulty: "MASTER", level: 9.5, tier: 6.2, pattern: "단일",
    currentRate: 70, targetRate: 88, expectedGain: 50, peerUsers: 6, ...over,
  };
}
function response(over: Partial<WeaknessAnalysisResponse> = {}): WeaknessAnalysisResponse {
  return {
    tierName: "SS 3", bandUsers: 6, peerAvailable: true, minChartsPerBand: 3, bandWidth: 0.5,
    patterns: [
      pattern("SINGLE", { myCharts: 8, myAvg: 87.12, peerAvg: 89.47, peerUsers: 6, diff: -2.35 }),
      pattern("COMPOUND", { myCharts: 5, myAvg: 90, peerAvg: 89, peerUsers: 6, diff: 1 }),
      pattern("DOUBLE", { myCharts: 0 }),
      pattern("TRIPLE", { myCharts: 2, myAvg: 70, peerAvg: null, peerUsers: null, diff: null }),
    ],
    bands: [band(7, { myAvg: 95, peerAvg: 94, diff: 1 }), band(6, { weak: true, myAvg: 70, peerAvg: 85, diff: -15 })],
    weakBandFrom: 6,
    easyCharts: [easy(1), easy(2, { currentRate: null, expectedGain: 30.5 }), easy(3, { currentRate: 60, targetRate: 100, expectedGain: 12 })],
    ...over,
  };
}
function setlistItem(songDifficultyId: number): SetlistItemResponse {
  return {
    id: songDifficultyId, songDifficultyId, songId: 1, title: "x", part: "GUITAR", difficulty: "MASTER", level: 9.5, tier: 5.4, pattern: "단일", mine: null, done: false, createdAt: "2026-11-09T00:00:00Z",
  };
}

function show(body: WeaknessAnalysisResponse | { status: number }) {
  fetchMock.mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.includes("/skills/me/weakness")) return "status" in body ? json({ code: "INTERNAL", message: "x", timestamp: "t" }, body.status) : json(body);
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
      <AnalysisTab userId={1} />
    </QueryClientProvider>,
  );
}

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

const patternList = () => screen.findByRole("list", { name: "속성별" });
const bandList = () => screen.findByRole("list", { name: "난이도대별 (서열표 기준)" });

describe("분석 탭 · 약점 분석 (D72)", () => {
  it("속성 네 줄: 평균 달성률 차는 부호가 글자로 보이고(−/+), 줄 아래에 내 값·같은 티어 값·인원이 글자로 있다", async () => {
    show(response());
    const list = await patternList();
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent("단일");
    expect(items[0]).toHaveTextContent(`${MINUS}2.35%`);
    expect(items[0]).toHaveTextContent("같은 티어 6명 · 8곡");
    expect(items[1]).toHaveTextContent("+1.00%");
    // 내 목록에 없는 속성: 차이 대신 `–`, 안내 한 줄
    expect(items[2]).toHaveTextContent("내 레이팅 목록에 없습니다.");
    expect(within(items[2]).getAllByText("–")).toHaveLength(3);   // 차이 · 내 막대 · 같은 티어 막대 값
    // 이 묶음만 같은 티어 인원이 모자란 경우: 차이는 `–`, `비교 대상이 적어요`
    expect(items[3]).toHaveTextContent("2곡 · 비교 대상이 적어요");
    // 막대는 장식(aria-hidden)이고 값은 글자 줄이 담는다
    expect(items[0].querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("줄마다 막대가 두 개: `나`(초록)와 `같은 티어`(회색), 각 막대 오른쪽에 둘째 자리 숫자가 글자로 있다", async () => {
    show(response());
    const items = within(await patternList()).getAllByRole("listitem");
    const bar = (li: HTMLElement, kind: string) => li.querySelector(`[data-bar="${kind}"]`) as HTMLElement;
    const fill = (el: HTMLElement) => el.querySelector('[aria-hidden="true"] > div') as HTMLElement;

    // 단일: 내 87.12 / 같은 티어 89.47
    expect(bar(items[0], "me")).toHaveTextContent("나");
    expect(bar(items[0], "me")).toHaveTextContent("87.12");
    expect(bar(items[0], "peer")).toHaveTextContent("같은 티어");
    expect(bar(items[0], "peer")).toHaveTextContent("89.47");
    // 색은 토큰 클래스(초록 = 나, 회색 = 같은 티어)이고 막대 끝 테두리(border-r)는 없다
    expect(fill(bar(items[0], "me")).className).toContain("bg-done");
    expect(fill(bar(items[0], "peer")).className).toContain("bg-ctl");
    expect(fill(bar(items[0], "me")).className).not.toContain("border-r");
    // 눈금 80~100: 87.12 → 35.6%, 89.47 → 47.35%
    expect(fill(bar(items[0], "me")).style.width).toBe("35.6%");
    expect(fill(bar(items[0], "peer")).style.width).toBe("47.35%");
  });

  it("같은 티어 값이 없으면 같은 티어 막대는 길이 0과 `–`이고, 흰 세로선(bg-fg)은 어디에도 없다", async () => {
    show(response());
    const items = within(await patternList()).getAllByRole("listitem");
    const peer = items[3].querySelector('[data-bar="peer"]') as HTMLElement;
    expect(peer).toHaveTextContent("같은 티어");
    expect(peer).toHaveTextContent("–");
    expect((peer.querySelector('[aria-hidden="true"] > div') as HTMLElement).style.width).toBe("0%");
    expect(items[3].querySelector('[data-bar="me"]')).toHaveTextContent("70.00");
    expect((items[3].querySelector('[data-bar="me"] [aria-hidden="true"] > div') as HTMLElement).style.width).toBe("0%");   // 80 미만은 잘림
    for (const li of items) expect(li.querySelector(".bg-fg")).toBeNull();
  });

  it("차이 글자는 낮으면 주황(weak-text), 높으면 초록(done-text) 토큰이고 부호가 글자로 같이 있다", async () => {
    show(response());
    const items = within(await patternList()).getAllByRole("listitem");
    expect(within(items[0]).getByText(`${MINUS}2.35%`).className).toContain("text-weak-text");
    expect(within(items[1]).getByText("+1.00%").className).toContain("text-done-text");
  });

  it("맨 위 범례(나 / 같은 티어)와 목록 아래 눈금 80·85·90·95·100, 눈금 안내가 있고 옛 하단 설명 문장은 없다", async () => {
    show(response());
    await patternList();
    const legendMe = screen.getAllByText("나")[0];
    expect(legendMe).toBeInTheDocument();
    expect(screen.getAllByText("눈금은 80~100입니다(80 미만은 잘림).")).toHaveLength(1);   // 탭에서 한 번만(난이도대별 목록 아래)
    for (const tick of ["80", "85", "90", "95", "100"]) expect(screen.getAllByText(tick).length).toBeGreaterThanOrEqual(2);
    // 안내는 난이도대별 목록 아래에 있고 속성별 목록 아래에는 없다
    const note = screen.getByText("눈금은 80~100입니다(80 미만은 잘림).");
    const bandSection = screen.getByRole("region", { name: "난이도대별 (서열표 기준)" });
    expect(bandSection.contains(note)).toBe(true);
    expect(screen.getByRole("region", { name: "속성별" }).contains(note)).toBe(false);
    expect(screen.queryByText("막대는 내 평균 달성률, 세로선은 같은 티어 평균입니다.")).toBeNull();
  });

  it("난이도대 줄은 높은 순으로 나오고 약점에만 `약점` 글자 표지가 있다", async () => {
    show(response());
    const items = within(await bandList()).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("7.0~7.4");
    expect(items[0]).not.toHaveTextContent("약점");
    expect(items[1]).toHaveTextContent("6.0~6.4");
    expect(items[1]).toHaveTextContent("약점");
    expect(items[1]).toHaveTextContent(`${MINUS}15.00%`);
    expect(items[1]).toHaveAttribute("data-weak", "true");
    expect(screen.getByText("서열표 기준 난이도 0.5 단위로 묶었고, 내 곡이 3곡 이상인 난이도대만 약점 후보입니다.")).toBeInTheDocument();
  });

  it("약점 난이도대 아래에 올리기 쉬운 곡 3개: 현재 → 목표, 예상 점수 증가, 곡마다 담기 버튼 하나(한꺼번에 담기 없음)", async () => {
    show(response());
    const section = await screen.findByRole("region", { name: "6.0~6.4에서 올리기 쉬운 곡" });
    const items = within(section).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Song 1");
    expect(items[0]).toHaveTextContent("70.00 → 88.00");
    expect(items[0]).toHaveTextContent("+50.00점");
    expect(items[1]).toHaveTextContent("– → 88.00");   // 기록이 없으면 현재는 `–`
    expect(items[1]).toHaveTextContent("+30.50점");
    expect(items[2]).toHaveTextContent("60.00 → MAX");
    expect(within(section).getAllByRole("button", { name: /담기/ })).toHaveLength(3);
    expect(within(section).queryByRole("button", { name: /모두|전체|한꺼번에/ })).toBeNull();
  });

  it("담기를 누르면 그 곡 하나만 세트리스트에 담긴다", async () => {
    show(response());
    const section = await screen.findByRole("region", { name: "6.0~6.4에서 올리기 쉬운 곡" });
    const button = await within(section).findByRole("button", { name: "Song 2 세트리스트에 담기" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => {
      const posts = fetchMock.mock.calls.filter(([url, init]) => String(url).includes("/setlist") && init?.method === "POST");
      expect(posts).toHaveLength(1);
      expect(JSON.parse(String(posts[0][1]?.body))).toEqual({ songDifficultyId: 12 });
    });
  });

  it("같은 티어 인원이 모자라면 `비교 대상이 적어요`를 보이고 비교선·차이·약점·추천 곡은 없다(내 값은 그대로)", async () => {
    show(
      response({
        peerAvailable: false, bandUsers: 3, weakBandFrom: null, easyCharts: [],
        patterns: [
          pattern("SINGLE", { myCharts: 8, myAvg: 87.12 }), pattern("COMPOUND"), pattern("DOUBLE"), pattern("TRIPLE"),
        ],
        bands: [band(6, { peerAvg: null, peerUsers: null, diff: null, myAvg: 80 })],
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("비교 대상이 적어요");
    const items = within(await patternList()).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("8곡");
    expect(items[0].textContent).not.toMatch(/[+−]\d/);
    expect(items[0].querySelector(".bg-fg")).toBeNull();   // 같은 티어 세로선이 없다
    expect(screen.queryByText("약점")).toBeNull();
    expect(screen.queryByRole("region", { name: /올리기 쉬운 곡/ })).toBeNull();
    expect(screen.queryByText("같은 티어(SS 3) 공개 유저 3명 기준")).toBeNull();
  });

  it("비교는 되지만 약점 후보가 없으면 안내 한 줄만 보이고 추천 곡 구역은 없다", async () => {
    show(response({ weakBandFrom: null, easyCharts: [], bands: [band(7, { diff: 1, peerAvg: 79 })] }));
    expect(await screen.findByText("약점으로 볼 난이도대가 아직 없습니다.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /올리기 쉬운 곡/ })).toBeNull();
    expect(screen.getByText("같은 티어(SS 3) 공개 유저 6명 기준")).toBeInTheDocument();
  });

  it("약점 난이도대에 추천할 곡이 없으면 구역에 안내만 보인다", async () => {
    show(response({ easyCharts: [] }));
    const section = await screen.findByRole("region", { name: "6.0~6.4에서 올리기 쉬운 곡" });
    expect(within(section).getByText("비교할 수 있는 곡이 아직 없습니다.")).toBeInTheDocument();
    expect(within(section).queryByRole("listitem")).toBeNull();
  });

  it("내 레이팅 목록이 비어 있으면(기록 부족) 분석 대신 안내만 보인다", async () => {
    show(
      response({
        patterns: [pattern("SINGLE"), pattern("COMPOUND"), pattern("DOUBLE"), pattern("TRIPLE")],
        bands: [], weakBandFrom: null, easyCharts: [],
      }),
    );
    expect(await screen.findByText("레이팅 목록에 곡이 없어서 분석할 수 없습니다. 기록을 입력하면 분석을 볼 수 있습니다.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "속성별" })).toBeNull();
  });

  it("서버 오류면 다시 시도할 수 있다", async () => {
    show({ status: 500 });
    expect(await screen.findByText("x")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });

  it("일본어 화면도 같은 구조다", async () => {
    state.locale = "ja";
    show(response());
    const list = await screen.findByRole("list", { name: "属性別" });
    expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("同じティア6人 · 8曲");
    expect(screen.getByText("弱点")).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "6.0~6.4で上げやすい曲" })).toBeInTheDocument();
    expect(screen.getAllByText("+50.00点").length).toBeGreaterThan(0);
  });
});
