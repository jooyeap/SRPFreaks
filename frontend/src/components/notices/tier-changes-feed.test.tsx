import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import ko from "../../../messages/ko.json";
import { TierChangesFeed } from "@/components/notices/TierChangesFeed";
import type { TierChangeResponse } from "@/lib/api-types";

const base: TierChangeResponse = {
  changedAt: "2026-11-01T03:00:00Z", created: false, songId: 5, title: "Devil Fish Dumpling", songDifficultyId: 50,
  part: "GUITAR", difficulty: "EXTREME", level: 9.1, beforeTier: 5.6, afterTier: 5.7,
  beforePattern: "단일", afterPattern: "단일", beforeRecommend: "중", afterRecommend: "중",
};

function renderFeed(rows: TierChangeResponse[]) {
  vi.stubGlobal("fetch", vi.fn(async () =>
    new Response(JSON.stringify({ content: rows, page: 0, size: 30, totalElements: rows.length, totalPages: 1 }), {
      status: 200, headers: { "Content-Type": "application/json" },
    })));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="ko" messages={ko}>
        <TierChangesFeed />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("서열표 변경 탭 (D58)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("바뀐 항목만 글로 쓰고, 곡명은 서열표 곡 상세로 연결하며, 서울 날짜별로 묶는다", async () => {
    renderFeed([
      base,
      { ...base, changedAt: "2026-11-01T01:00:00Z", songId: 6, title: "Ruins", songDifficultyId: 60, beforeTier: 5.6, afterTier: 5.6, beforeRecommend: "중", afterRecommend: "상" },
      { ...base, changedAt: "2026-10-31T10:00:00Z", created: true, songId: 7, title: "AVEL", songDifficultyId: 70, beforeTier: null, beforePattern: null, beforeRecommend: null, afterRecommend: "상" },
    ]);
    const day = await screen.findByRole("region", { name: "2026-11-01" });
    const links = within(day).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/songs/5?from=table&chart=50");
    expect(links[0]).toHaveTextContent("기준 난이도 5.6 → 5.7");
    expect(links[0]).not.toHaveTextContent("추천");
    expect(links[1]).toHaveTextContent("추천 중 → 상");
    expect(links[1]).not.toHaveTextContent("기준 난이도");
    const before = screen.getByRole("region", { name: "2026-10-31" });
    expect(before).toHaveTextContent("서열표에 추가");
    expect(before).toHaveTextContent("기준 난이도 5.7 · 속성 단일 · 추천 상");
  });

  it("같은 날 같은 채보가 여러 번 바뀌면 한 줄로 흐름을 보여 준다", async () => {
    renderFeed([
      { ...base, changedAt: "2026-11-01T05:00:00Z", beforeTier: 5.2, afterTier: 5.1 },
      { ...base, changedAt: "2026-11-01T04:00:00Z", beforeTier: 5.1, afterTier: 5.2 },
      { ...base, changedAt: "2026-11-01T03:00:00Z", created: true, beforeTier: null, afterTier: 5.1, beforePattern: null, beforeRecommend: null },
    ]);
    const day = await screen.findByRole("region", { name: "2026-11-01" });
    const links = within(day).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("서열표에 추가");
    expect(links[0]).toHaveTextContent("기준 난이도 5.1 → 5.2 → 5.1 · 속성 단일 · 추천 중");
  });

  it("변경이 없으면 안내 문구", async () => {
    renderFeed([]);
    expect(await screen.findByText("아직 서열표 변경이 없습니다.")).toBeInTheDocument();
  });
});
