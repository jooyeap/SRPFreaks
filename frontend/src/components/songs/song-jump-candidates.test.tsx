import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SongJumpCandidates } from "@/components/songs/SongJumpCandidates";
import type { ChartRowResponse, PageResponse } from "@/lib/api-types";

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

const base: ChartRowResponse = {
  songDifficultyId: 1,
  songId: 101,
  title: "Sample Song",
  addedVersion: "V5",
  part: "GUITAR",
  difficulty: "MASTER",
  level: 9.6,
  mine: null,
};

function page(content: ChartRowResponse[]): PageResponse<ChartRowResponse> {
  return { content, page: 0, size: 8, totalElements: content.length, totalPages: 1 };
}

async function renderRow(over: Partial<ChartRowResponse>) {
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(json(page([{ ...base, ...over }]))));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SongJumpCandidates userId={0} query="sample" />
    </QueryClientProvider>,
  );
  return within(await screen.findByRole("link", { name: /Sample Song/ }));
}

/** 정보 칸(라벨 + 값). 라벨 글자로 칸을 찾고 값은 같은 칸 안에서 읽는다 */
function cell(row: ReturnType<typeof within>, label: string): HTMLElement {
  const box = row.getByText(label).parentElement;
  if (!box) {
    throw new Error("cell not found");
  }
  return box;
}

describe("검색 결과 줄 (D106, 카드 B)", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("전체 값: 곡명·아티스트, 칩 · 버전 · BPM, 정보 칸 3개(기준 난이도 소수 1자리 · 상수 소수 2자리 · 속성)", async () => {
    const row = await renderRow({ artist: "Artist A", addedVersion: "HIGH-VOLTAGE", bpmMin: 165, bpmMax: 172, tier: 5.7, ratingConstant: 12, patternType: "단일" });
    expect(row.getByText("Sample Song")).toBeInTheDocument();
    expect(row.getByText("Artist A")).toBeInTheDocument();
    expect(row.getByText(/MAS 9\.60/)).toBeInTheDocument();
    expect(row.getByText("HIGH-VOLTAGE")).toBeInTheDocument();
    expect(row.getByText("165~172")).toBeInTheDocument();
    expect(within(cell(row, "기준 난이도")).getByText("5.7")).toBeInTheDocument();
    expect(within(cell(row, "레이팅상수")).getByText("12.00")).toBeInTheDocument();
    expect(within(cell(row, "속성")).getByText("단일")).toBeInTheDocument();
  });

  it("정보 칸은 같은 폭 3열 grid(gap 6px)이고 값이 달라도 항상 3칸이다", async () => {
    const row = await renderRow({});
    const grid = cell(row, "기준 난이도").parentElement;
    expect(grid?.className).toContain("grid-cols-3");
    expect(grid?.className).toContain("gap-1.5");
    expect(grid?.children.length).toBe(3);
  });

  it("기준 난이도 미정: 칸은 남고 `미정`, 상수·속성은 `–`", async () => {
    const row = await renderRow({ tier: null, ratingConstant: null, patternType: null });
    expect(within(cell(row, "기준 난이도")).getByText("미정")).toBeInTheDocument();
    expect(within(cell(row, "레이팅상수")).getByText("–")).toBeInTheDocument();
    expect(within(cell(row, "속성")).getByText("–")).toBeInTheDocument();
  });

  it("BPM이 없으면 `BPM 미기입`", async () => {
    const none = await renderRow({ bpmMin: null, bpmMax: null });
    expect(none.getByText("BPM 미기입")).toBeInTheDocument();
  });

  it("BPM 최소=최대면 한 값만 보인다", async () => {
    const row = await renderRow({ bpmMin: 150, bpmMax: 150 });
    expect(row.getByText("150")).toBeInTheDocument();
    expect(row.queryByText(/미기입/)).toBeNull();
  });

  it("속성이 `레이팅 제외`이면 그대로 적는다", async () => {
    const row = await renderRow({ tier: 4.8, ratingConstant: 3, patternType: "레이팅 제외" });
    expect(within(cell(row, "속성")).getByText("레이팅 제외")).toBeInTheDocument();
    expect(within(cell(row, "레이팅상수")).getByText("3.00")).toBeInTheDocument();
  });

  it("속성이 null이면 속성 칸이 `–`이고 다른 칸은 그대로다", async () => {
    const row = await renderRow({ tier: 5.7, ratingConstant: 12, patternType: null });
    expect(within(cell(row, "속성")).getByText("–")).toBeInTheDocument();
    expect(within(cell(row, "기준 난이도")).getByText("5.7")).toBeInTheDocument();
  });

  it("아티스트·버전이 없으면 그 줄·칸만 빠진다 (옛 응답도 그려진다)", async () => {
    const row = await renderRow({ addedVersion: null });
    expect(row.getByText("Sample Song")).toBeInTheDocument();
    expect(row.getByText("BPM 미기입")).toBeInTheDocument();
  });

  it("기록이 없으면 단계·달성률 알약이 `–`로 비어 있다", async () => {
    const row = await renderRow({ mine: null, tier: null });
    // 알약의 `–` 2개 + 상수·속성 칸의 `–` 2개
    expect(row.getAllByText("–").length).toBe(4);
  });

  it("내 기록이 있으면 단계 글자와 달성률을 알약에 보인다 (색만으로 전달하지 않는다)", async () => {
    const row = await renderRow({ mine: { rate: 96.5, fullCombo: false, stage: "SS" } });
    expect(row.getByText("SS")).toBeInTheDocument();
    expect(row.getByText("96.50")).toBeInTheDocument();
  });
});
