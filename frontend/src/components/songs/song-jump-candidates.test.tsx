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

describe("검색 결과 줄 (D106, 카드 B)", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("아티스트·BPM 범위, 채보 칩, 서열표 난이도·속성·레이팅상수를 모두 보인다", async () => {
    const row = await renderRow({ artist: "Artist A", bpmMin: 165, bpmMax: 172, tier: 7, ratingConstant: 20, patternType: "복합" });
    expect(row.getByText("Artist A · BPM 165~172")).toBeInTheDocument();
    expect(row.getByText("난이도 7.0")).toBeInTheDocument();
    expect(row.getByText("복합")).toBeInTheDocument();
    expect(row.getByText("상수 20.0")).toBeInTheDocument();
    expect(row.getByText(/MAS 9\.60/)).toBeInTheDocument();
  });

  it("BPM이 같은 값이면 하나만 보인다", async () => {
    const row = await renderRow({ artist: "Artist A", bpmMin: 150, bpmMax: 150 });
    expect(row.getByText("Artist A · BPM 150")).toBeInTheDocument();
  });

  it("아티스트만 있거나 BPM만 있어도 줄이 깨지지 않는다", async () => {
    const onlyArtist = await renderRow({ artist: "Artist A" });
    expect(onlyArtist.getByText("Artist A")).toBeInTheDocument();
    expect(onlyArtist.queryByText(/BPM/)).toBeNull();
  });

  it("서열표에 없거나 미정인 채보는 난이도·속성·상수 칸이 빠지고 곡명·칩은 그대로다", async () => {
    const row = await renderRow({ tier: null, ratingConstant: null, patternType: null });
    expect(row.getByText("Sample Song")).toBeInTheDocument();
    expect(row.queryByText(/난이도 /)).toBeNull();
    expect(row.queryByText(/상수 /)).toBeNull();
    expect(row.queryByText("단일")).toBeNull();
    expect(row.getByText(/MAS 9\.60/)).toBeInTheDocument();
  });

  it("옛 응답(새 필드 없음)도 그대로 그려진다", async () => {
    const row = await renderRow({});
    expect(row.getByText("Sample Song")).toBeInTheDocument();
    expect(row.queryByText(/BPM/)).toBeNull();
  });

  it("기록이 없으면 단계·달성률 알약이 `–`로 비어 있다", async () => {
    const row = await renderRow({ mine: null });
    expect(row.getAllByText("–").length).toBe(2);
  });

  it("내 기록이 있으면 단계 글자와 달성률을 알약에 보인다 (색만으로 전달하지 않는다)", async () => {
    const row = await renderRow({ mine: { rate: 96.5, fullCombo: false, stage: "SS" } });
    expect(row.getByText("SS")).toBeInTheDocument();
    expect(row.getByText("96.50")).toBeInTheDocument();
  });
});
