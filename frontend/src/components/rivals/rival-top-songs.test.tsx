import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTranslator } from "use-intl/core";
import ja from "../../../messages/ja.json";
import ko from "../../../messages/ko.json";
import { resetShowJacketsForTest, setJacketData, setShowJackets } from "@/lib/jackets";

// 공용 setup은 한국어 번역만 끼우므로, 이 파일에서는 locale을 바꿔 가며 ko/ja를 모두 확인한다.
const state = vi.hoisted(() => ({ locale: "ko" as "ko" | "ja" }));
vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) =>
    createTranslator({ locale: state.locale, messages: state.locale === "ja" ? ja : ko, namespace } as never),
  useLocale: () => state.locale,
  NextIntlClientProvider: ({ children }: { children: unknown }) => children,
}));

import { RivalTab } from "@/components/rivals/RivalTab";
import { RivalTopSongs } from "@/components/rivals/RivalTopSongs";
import type { RivalResponse, RivalTopSong } from "@/lib/api-types";

const songs: RivalTopSong[] = [
  { songId: 1, score: 304 },
  { songId: 2, score: 300.5 },
  { songId: 3, score: 280.25 },
  { songId: 4, score: 260 },
  { songId: 5, score: 240.1 },
];
const jacketsOn = { enabled: true, jackets: { "1": "/jackets/1.webp", "3": "/jackets/3.webp" } };

beforeEach(() => {
  localStorage.clear();
  resetShowJacketsForTest();
});
afterEach(() => {
  state.locale = "ko";
  vi.unstubAllGlobals();
  act(() => setJacketData(null));
});

describe("RivalTopSongs (3단계, D65)", () => {
  it("재킷이 켜져 있으면 제목과 5곡의 재킷·점수(둘째 자리)를 한 줄로 보인다", () => {
    act(() => setJacketData(jacketsOn));
    render(<RivalTopSongs songs={songs} />);
    const group = screen.getByRole("group", { name: "상대 상위 곡" });
    expect(within(group).getAllByText(/^\d+\.\d{2}$/).map((n) => n.textContent)).toEqual(["304.00", "300.50", "280.25", "260.00", "240.10"]);
    // 재킷 이미지는 주소가 있는 곡(1, 3)만, 나머지는 같은 크기의 단색 칸이다
    expect(group.querySelectorAll("img")).toHaveLength(2);
    expect(group.querySelectorAll(".aspect-square")).toHaveLength(5);
  });

  it("타일은 56px까지 커지고 좁은 폭에서는 줄어든다(5열 격자라 넘치지 않는다)", () => {
    act(() => setJacketData(jacketsOn));
    render(<RivalTopSongs songs={songs} />);
    const tile = screen.getByRole("group").querySelector(".aspect-square") as HTMLElement;
    expect(tile).toHaveClass("w-full", "max-w-14");
    expect(tile.parentElement?.parentElement).toHaveClass("grid", "grid-cols-5");
  });

  it("곡이 5곡 미만이면 있는 만큼만 그린다", () => {
    act(() => setJacketData(jacketsOn));
    render(<RivalTopSongs songs={songs.slice(0, 3)} />);
    expect(screen.getByRole("group").querySelectorAll(".aspect-square")).toHaveLength(3);
    expect(screen.getAllByText(/^\d+\.\d{2}$/)).toHaveLength(3);
  });

  it("재킷이 꺼져 있으면(운영 설정 꺼짐 / 개인 설정 꺼짐) 줄 전체를 숨긴다", () => {
    act(() => setJacketData({ enabled: false, jackets: {} }));
    const { container, rerender } = render(<RivalTopSongs songs={songs} />);
    expect(container).toBeEmptyDOMElement();

    act(() => setJacketData(jacketsOn));
    rerender(<RivalTopSongs songs={songs} />);
    expect(screen.getByRole("group")).toBeInTheDocument();
    act(() => setShowJackets(false));
    expect(container).toBeEmptyDOMElement();
  });

  it("곡이 없거나 필드가 없으면(구버전 응답) 그리지 않는다", () => {
    act(() => setJacketData(jacketsOn));
    const a = render(<RivalTopSongs songs={[]} />);
    expect(a.container).toBeEmptyDOMElement();
    const b = render(<RivalTopSongs songs={null} />);
    expect(b.container).toBeEmptyDOMElement();
    const c = render(<RivalTopSongs songs={undefined} />);
    expect(c.container).toBeEmptyDOMElement();
  });

  it("일본어 제목은 `相手の上位曲`이다", () => {
    state.locale = "ja";
    act(() => setJacketData(jacketsOn));
    render(<RivalTopSongs songs={songs} />);
    expect(screen.getByRole("group", { name: "相手の上位曲" })).toBeInTheDocument();
    expect(screen.getByText("相手の上位曲")).toBeInTheDocument();
  });
});

describe("RivalTab의 상대 상위 곡 줄", () => {
  const gold = { key: "GOLD", displayName: "Gold", minScore: 5500, nextMinScore: 6000, nextDisplayName: "Platinum" };
  const base: RivalResponse = {
    userId: 7, nickname: "Rumi", available: true, mutual: false, tier: gold, totalScore: 9516.42, scoreDiff: 312.1,
    counts: { win: 48, lose: 61, tie: 3, theirsOnly: 27 },
  };

  function mock(rivals: RivalResponse[]) {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const body = String(input).includes("/rivals/registered-me")
        ? { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }
        : rivals;
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
  }
  function renderTab() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}><RivalTab userId={1} /></QueryClientProvider>);
  }

  it("카드의 승무패 아래에 상대 상위 곡 줄이 있고, 비공개 카드에는 없다", async () => {
    act(() => setJacketData(jacketsOn));
    mock([
      { ...base, topSongs: songs },
      { userId: 9, nickname: "HJY", available: false, mutual: false, tier: null, totalScore: null, scoreDiff: null, counts: null, topSongs: null },
    ]);
    renderTab();
    const card = await screen.findByRole("link", { name: /Rumi/ });
    const group = within(card).getByRole("group", { name: "상대 상위 곡" });
    expect(group).toHaveTextContent("304.00");
    expect(screen.getAllByRole("group", { name: "상대 상위 곡" })).toHaveLength(1);
  });

  it("재킷이 꺼져 있으면 줄이 없고 카드는 그대로다", async () => {
    mock([{ ...base, topSongs: songs }]);
    renderTab();
    const card = await screen.findByRole("link", { name: /Rumi/ });
    expect(screen.queryByRole("group", { name: "상대 상위 곡" })).toBeNull();
    expect(card).toHaveTextContent("\u2212312.10");
  });

  it("topSongs 필드가 없는 구버전 응답이면 재킷이 켜져 있어도 줄이 없다", async () => {
    act(() => setJacketData(jacketsOn));
    mock([{ ...base }]);
    renderTab();
    const card = await screen.findByRole("link", { name: /Rumi/ });
    expect(card).toHaveTextContent("\u2212312.10");
    expect(screen.queryByRole("group", { name: "상대 상위 곡" })).toBeNull();
  });
});
