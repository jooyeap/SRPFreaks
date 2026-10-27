import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FolderThresholdNote } from "@/components/table/FolderThresholdNote";
import type { TableEntryResponse } from "@/lib/api-types";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** 순위·점수만 쓰는 목록. 맨 아래(count위) 점수가 lastScore */
function list(count: number, lastScore: number) {
  return Array.from({ length: count }, (_, i) => ({ rank: i + 1, score: i + 1 === count ? lastScore : lastScore + 50 }));
}

function entry(pattern: string | null): TableEntryResponse {
  return { pattern } as TableEntryResponse;
}

/*
 * 손으로 계산한 값 (기준 난이도 6.0 → R = 15)
 *  단일 맨 아래 258점 → 84.22% → 안내 85 / 그 외 맨 아래 300점 → 94.07% → 안내 95
 */
describe("서열표 묶음 화면의 레이팅 반영 기준", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let skill: unknown;

  beforeEach(() => {
    skill = { single: list(15, 258), other: list(25, 300), singleLimit: 15, otherLimit: 25 };
    fetchMock.mockReset();
    fetchMock.mockImplementation((input) => Promise.resolve(String(input).includes("/skills/me") ? json(skill) : json({})));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const renderNote = (entries: TableEntryResponse[]) =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <FolderThresholdNote userId={1} tier={6.0} entries={entries} />
      </QueryClientProvider>,
    );

  it("두 목록이 모두 계산되면 단일과 그 외를 나눠 보여 준다", async () => {
    renderNote([entry("단일"), entry("복합")]);
    expect(await screen.findByText(/이 구간은 단일/)).toHaveTextContent("이 구간은 단일 85% · 그 외 95% 이상이면 레이팅에 반영돼요.");
  });

  it("묶음에 그 속성의 채보가 없으면 그쪽은 쓰지 않는다", async () => {
    renderNote([entry("이중")]);
    expect(await screen.findByText(/이 구간은/)).toHaveTextContent("이 구간은 그 외 95% 이상이면 레이팅에 반영돼요.");
  });

  it("목록이 덜 찬 쪽은 쓰지 않는다", async () => {
    skill = { single: list(15, 258), other: list(10, 300), singleLimit: 15, otherLimit: 25 };
    renderNote([entry("단일"), entry("복합")]);
    expect(await screen.findByText(/이 구간은/)).toHaveTextContent("이 구간은 단일 85% 이상이면 레이팅에 반영돼요.");
  });

  it("계산되는 쪽이 없으면 아무것도 그리지 않는다", async () => {
    skill = { single: [], other: [], singleLimit: 15, otherLimit: 25 };
    const { container } = renderNote([entry("단일"), entry(null)]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
  });
});
