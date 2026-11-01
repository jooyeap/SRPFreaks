import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TierHistorySection } from "@/components/song/TierHistorySection";
import type { PageResponse, TierHistoryResponse } from "@/lib/api-types";
import ko from "../../../messages/ko.json";

const fetchMock = vi.fn<typeof fetch>();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function row(over: Partial<TierHistoryResponse> = {}): TierHistoryResponse {
  return {
    changedAt: "2026-10-22T15:30:00Z", // 서울은 10-23
    created: false,
    songDifficultyId: 10,
    part: "GUITAR",
    difficulty: "MASTER",
    level: 9.5,
    beforeTier: 9.5,
    afterTier: 9.6,
    beforePattern: "단일",
    afterPattern: "단일",
    beforeRecommend: "중",
    afterRecommend: "중",
    ...over,
  };
}

function page(content: TierHistoryResponse[], pageNo = 0, totalPages = 1): PageResponse<TierHistoryResponse> {
  return { content, page: pageNo, size: 10, totalElements: content.length, totalPages };
}

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale="ko" messages={ko}>
      <QueryClientProvider client={client}>
        <TierHistorySection songId={1} />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe("서열표 변경 이력", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("이력이 없으면 안내만 보여 준다", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json(page([]))));
    renderSection();

    expect(await screen.findByText("아직 변경 이력이 없습니다.")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toContain("/songs/1/tier-history?page=0&size=10");
  });

  it("바뀐 항목만 `전 → 후`로 보여 주고 날짜는 서울 기준이다", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        json(
          page([
            row(),
            row({ beforeTier: 9.6, afterTier: 9.6, beforePattern: "단일", afterPattern: "복합", part: "BASS", difficulty: "EXTREME" }),
          ]),
        ),
      ),
    );
    renderSection();

    const region = await screen.findByRole("region", { name: "서열표 변경 이력" });
    const items = await within(region).findAllByRole("listitem");
    expect(items[0]).toHaveTextContent("2026-10-23");
    expect(items[0]).toHaveTextContent("Guitar MAS");
    expect(items[0]).toHaveTextContent("기준 난이도 9.5 → 9.6");
    expect(items[0]).not.toHaveTextContent("속성");
    expect(items[1]).toHaveTextContent("Bass EXT");
    expect(items[1]).toHaveTextContent("속성 단일 → 복합");
    expect(items[1]).not.toHaveTextContent("기준 난이도");
  });

  it("추천만 바뀐 줄은 `추천 중 → 상`만 보여 준다", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(json(page([row({ beforeTier: 9.5, afterTier: 9.5, afterRecommend: "상" })]))),
    );
    renderSection();

    const item = (await screen.findAllByRole("listitem"))[0];
    expect(item).toHaveTextContent("추천 중 → 상");
    expect(item).not.toHaveTextContent("기준 난이도");
  });

  it("값이 사라지면 미정, 속성이 없으면 –로 보여 준다", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(json(page([row({ beforeTier: 9.5, afterTier: null, beforePattern: "단일", afterPattern: null })]))),
    );
    renderSection();

    const item = (await screen.findAllByRole("listitem"))[0];
    expect(item).toHaveTextContent("기준 난이도 9.5 → 미정");
    expect(item).toHaveTextContent("속성 단일 → –");
  });

  it("서열표에 추가된 줄은 그때의 값을 보여 준다", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(json(page([row({ created: true, beforeTier: null, afterTier: 9.5, beforePattern: null, afterPattern: "복합" })]))),
    );
    renderSection();

    const item = (await screen.findAllByRole("listitem"))[0];
    expect(item).toHaveTextContent("서열표에 추가");
    expect(item).toHaveTextContent("기준 난이도 9.5");
    expect(item).toHaveTextContent("속성 복합");
    expect(item).toHaveTextContent("추천 중");
  });

  it("더 보기를 누르면 다음 페이지를 이어 붙인다", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        String(input).includes("page=1")
          ? json(page([row({ changedAt: "2026-09-01T00:00:00Z", beforeTier: 8.9, afterTier: 9.0 })], 1, 2))
          : json(page([row()], 0, 2)),
      ),
    );
    renderSection();

    fireEvent.click(await screen.findByRole("button", { name: "더 보기" }));

    expect(await screen.findByText("기준 난이도 8.9 → 9.0")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "더 보기" })).toBeNull();
  });

  it("불러오지 못하면 이 구역에만 오류를 보이고 다시 시도할 수 있다", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json({ code: "INTERNAL_ERROR", message: "x" }, 500)));
    renderSection();

    expect(await screen.findByText("변경 이력을 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });
});
