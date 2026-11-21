import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChartStatsView } from "@/components/admin/ChartStatsView";
import type { ChartStatsMeta, FolderDistributionPage, FolderRecord, FolderUserRecords, StatsChart } from "@/lib/chart-stats";

/** 폴더 분포의 `기록 보기`(D97): 점 카드와 표의 유저 줄에서 그 평균에 들어간 곡을 펼친다. */

const META: ChartStatsMeta = { publicUsers: 12, minPlayers: 3, minFolderCharts: 3, recentDays: 7 };

const TIER = (key: string, name: string) => ({ key, displayName: name, minScore: 0, nextDisplayName: null, nextMinScore: null });

/** 5.8 폴더 유저 3명(알파는 2곡 합 160 → 평균 80.00). 0.5 묶음(5.5~5.9)도 같은 3명이다. */
const DIST: FolderDistributionPage = {
  content: [
    {
      tier: 5.8,
      cells: [
        { userId: 1, charts: 2, sumRate: 160, lastRecordedAt: "2026-11-20T15:30:00Z" },
        { userId: 2, charts: 1, sumRate: 90, lastRecordedAt: null },
        { userId: 3, charts: 1, sumRate: 70, lastRecordedAt: null },
      ],
    },
  ],
  page: 0,
  size: 100,
  totalElements: 1,
  totalPages: 1,
  users: [
    { userId: 1, nickname: "알파", tier: TIER("RED", "Red"), totalScore: 6100 },
    { userId: 2, nickname: "베타", tier: TIER("GOLD", "Gold"), totalScore: 8100 },
    { userId: 3, nickname: "감마", tier: TIER("BRONZE", "Bronze"), totalScore: 7100 },
  ],
  meta: META,
};

function chart(id: number, title: string, part: "GUITAR" | "BASS" = "GUITAR"): StatsChart {
  return { songDifficultyId: id, songId: 100 + id, title, part, difficulty: "MASTER", level: 9.5, tier: 5.8 };
}

function record(id: number, title: string, bestRate: number, stage: FolderRecord["stage"], over: Partial<FolderRecord> = {}): FolderRecord {
  return {
    chart: chart(id, title, id % 2 === 0 ? "BASS" : "GUITAR"),
    bestRate,
    fullCombo: false,
    stage,
    savedAt: "2026-11-20T15:30:00Z",
    counted: true,
    ...over,
  };
}

/** 알파의 기록: 평균에 든 2곡(100.00 + 60.00 = 160 → 80.00)과 평균에서 빠진 1곡. */
function alphaRecords(over: Partial<FolderUserRecords> = {}): FolderUserRecords {
  const content = [
    record(11, "곡 열하나", 100, "EXC"),
    record(12, "곡 열둘", 60, "C", { savedAt: null }),
    record(13, "곡 열셋", 99, "SS", { counted: false }),
  ];
  return {
    userId: 1,
    nickname: "알파",
    tierFrom: 5.8,
    tierTo: 5.8,
    countedCharts: 2,
    sumRate: 160,
    avgRate: 80,
    excludedCharts: 1,
    content,
    page: 0,
    size: 50,
    totalElements: 3,
    totalPages: 1,
    ...over,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("폴더 기록 상세 (기록 보기)", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let recordsResponse: () => Response;

  beforeEach(() => {
    fetchMock.mockReset();
    recordsResponse = () => json(alphaRecords());
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/records")) return Promise.resolve(recordsResponse());
      if (url.includes("/folder-distribution")) return Promise.resolve(json(DIST));
      return Promise.resolve(json({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, meta: META }));
    });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function recordUrls(): string[] {
    return fetchMock.mock.calls.map((call) => String(call[0])).filter((url) => url.includes("/records"));
  }

  async function openTable(unit: "0.1" | "0.5" = "0.1") {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ChartStatsView viewerId={1} />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("tab", { name: "폴더 분포" }));
    fireEvent.click(await screen.findByRole("button", { name: unit === "0.1" ? "0.1 단위" : "0.5 단위" }));
    fireEvent.click(screen.getByRole("button", { name: "표로 보기" }));
    const list = await screen.findByRole("list", { name: "폴더별 유저 평균 달성률 표" });
    fireEvent.click(within(list).getByRole("button", { name: /^(5\.8|5\.5~5\.9) / }));
    return list;
  }

  it("표의 유저 줄을 누르면 평균 계산 근거와 곡 목록이 펼쳐지고, 누르기 전에는 요청하지 않는다", async () => {
    const list = await openTable();
    expect(recordUrls()).toHaveLength(0);
    const toggle = within(list).getByRole("button", { name: "알파 기록 보기" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveTextContent("▸");

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveTextContent("▾");
    const basis = await waitFor(() => {
      const found = list.querySelector("[data-rec-basis]");
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });
    expect(basis).toHaveTextContent("5.8 폴더 평균 계산");
    expect(basis).toHaveTextContent("달성률 합계 160.00 ÷ 2곡 = 평균 80.00%");
    expect(recordUrls()).toHaveLength(1);
    expect(recordUrls()[0]).toContain("/admin/chart-stats/folders/5.8/users/1/records");
    expect(recordUrls()[0]).toContain("unit=0.1");
    expect(document.getElementById(toggle.getAttribute("aria-controls") ?? "")).not.toBeNull();
  });

  it("곡마다 파트·달성률(MAX)·달성 단계 글자·저장일(서울 날짜)이 나오고 평균에서 빠진 곡은 글자로 구분된다", async () => {
    const list = await openTable();
    fireEvent.click(within(list).getByRole("button", { name: "알파 기록 보기" }));

    const rows = await waitFor(() => {
      const found = list.querySelectorAll("[data-rec-row]");
      expect(found).toHaveLength(3);
      return [...found] as HTMLElement[];
    });
    // 평균에 든 곡 2개(점·표의 곡 수 2곡과 같다)
    expect(rows.filter((row) => row.dataset.counted === "true")).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("곡 열하나");
    expect(rows[0]).toHaveTextContent("Guitar | MAS 9.50 · 5.8");
    expect(rows[0]).toHaveTextContent("MAX");
    expect(within(rows[0]).getByLabelText("달성 단계 EXC")).toHaveTextContent("EXC");
    // 2026-11-20 15:30 UTC = 서울 2026-11-21
    expect(rows[0]).toHaveTextContent("저장 2026-11-21");
    expect(rows[1]).toHaveTextContent("Bass | MAS 9.50");   // 파트는 Guitar / Bass 글자로
    expect(rows[1]).toHaveTextContent("60.00%");
    expect(rows[1]).toHaveTextContent("저장 -");
    expect(within(rows[1]).getByLabelText("달성 단계 C")).toBeInTheDocument();
    // 평균 제외: 값은 그대로 보이고 `평균 제외` 글자가 붙는다(색·흐림만으로 구분하지 않는다)
    expect(rows[2]).toHaveTextContent("곡 열셋");
    expect(rows[2]).toHaveTextContent("99.00%");
    expect(rows[2]).toHaveTextContent("평균 제외");
    expect(rows[0]).not.toHaveTextContent("평균 제외");
    expect(list).toHaveTextContent("평균에서 뺀 곡 1곡");
    // 곡명은 채보 상세로 가는 링크
    expect(within(rows[0]).getByRole("link", { name: "곡 열하나 유저별 상세 보기" })).toHaveAttribute("href", "/admin/chart-stats/11");
  });

  it("평균에 든 곡 수가 점·표의 곡 수와 같으면 어긋남 안내가 없고, 다르면 두 숫자를 알려 준다", async () => {
    const list = await openTable();
    fireEvent.click(within(list).getByRole("button", { name: "알파 기록 보기" }));
    await waitFor(() => expect(list.querySelector("[data-rec-basis]")).not.toBeNull());
    expect(list.querySelector("[data-rec-mismatch]")).toBeNull();
    cleanup();

    recordsResponse = () => json(alphaRecords({ countedCharts: 3, sumRate: 240, avgRate: 80 }));
    const again = await openTable();
    fireEvent.click(within(again).getByRole("button", { name: "알파 기록 보기" }));

    const note = await waitFor(() => {
      const found = again.querySelector("[data-rec-mismatch]");
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });
    expect(note).toHaveTextContent("점·표의 곡 수(2곡)와 지금 조회한 곡 수(3곡)가 다릅니다.");
  });

  it("다시 누르면 접히고, 다른 유저 줄과 따로 펼친다", async () => {
    const list = await openTable();
    const alpha = within(list).getByRole("button", { name: "알파 기록 보기" });
    const beta = within(list).getByRole("button", { name: "베타 기록 보기" });

    fireEvent.click(alpha);
    await waitFor(() => expect(list.querySelector('[data-user-records="1"] [data-folder-records]')).not.toBeNull());
    expect(beta).toHaveAttribute("aria-expanded", "false");
    expect(list.querySelector('[data-user-records="2"]')).toBeNull();

    fireEvent.click(alpha);
    expect(alpha).toHaveAttribute("aria-expanded", "false");
    expect(list.querySelector("[data-user-records]")).toBeNull();
  });

  it("0.5 단위 묶음은 묶음의 시작 난이도와 unit=0.5로 요청하고 범위를 글자로 적는다", async () => {
    recordsResponse = () => json(alphaRecords({ tierFrom: 5.5, tierTo: 5.9 }));
    const list = await openTable("0.5");

    fireEvent.click(within(list).getByRole("button", { name: "알파 기록 보기" }));

    await waitFor(() => expect(recordUrls()).toHaveLength(1));
    expect(recordUrls()[0]).toContain("/folders/5.5/users/1/records");
    expect(recordUrls()[0]).toContain("unit=0.5");
    expect((await screen.findAllByText(/5\.5~5\.9 폴더 평균 계산/)).length).toBeGreaterThan(0);
  });

  it("평균에 든 곡이 없으면 평균 대신 안내가 나온다", async () => {
    recordsResponse = () =>
      json(alphaRecords({ countedCharts: 0, sumRate: 0, avgRate: null, content: [record(13, "곡 열셋", 99, "SS", { counted: false })], totalElements: 1, excludedCharts: 1 }));
    const list = await openTable();

    fireEvent.click(within(list).getByRole("button", { name: "알파 기록 보기" }));

    expect(await within(list).findByText(/평균에 들어간 곡이 없습니다/)).toBeInTheDocument();
  });

  it("기록이 하나도 없으면 빈 안내가 나온다", async () => {
    recordsResponse = () => json(alphaRecords({ content: [], totalElements: 0, countedCharts: 0, excludedCharts: 0, sumRate: 0, avgRate: null }));
    const list = await openTable();

    fireEvent.click(within(list).getByRole("button", { name: "알파 기록 보기" }));

    expect(await within(list).findByText("이 폴더에서 기록한 곡이 없습니다.")).toBeInTheDocument();
  });

  it("조회가 실패하면 안내와 다시 시도가 나오고, 다시 시도하면 목록이 나온다", async () => {
    recordsResponse = () => json({ code: "INTERNAL_ERROR", message: "x" }, 500);
    const list = await openTable();

    fireEvent.click(within(list).getByRole("button", { name: "알파 기록 보기" }));

    expect(await within(list).findByText("기록을 불러오지 못했습니다.")).toBeInTheDocument();
    recordsResponse = () => json(alphaRecords());
    fireEvent.click(within(list).getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(list.querySelectorAll("[data-rec-row]")).toHaveLength(3));
  });

  it("점 카드의 `기록 보기`도 같은 상세를 펼치고 다른 점으로 옮기면 접힌다", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ChartStatsView viewerId={1} />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("tab", { name: "폴더 분포" }));
    fireEvent.click(await screen.findByRole("button", { name: "0.1 단위" }));
    fireEvent.click(screen.getByRole("button", { name: "전체" }));
    const plot = await screen.findByRole("group", { name: "폴더별 유저 평균 달성률 점 도표" });

    fireEvent.click(within(plot).getByRole("button", { name: "5.8 폴더 · Red · 평균 80.00%" }));
    const card = document.querySelector("[data-pick-card]") as HTMLElement;
    const open = within(card).getByRole("button", { name: "기록 보기" });
    expect(open).toHaveAttribute("aria-expanded", "false");
    expect(recordUrls()).toHaveLength(0);

    fireEvent.click(open);

    expect(await within(card).findByText(/달성률 합계 160\.00 ÷ 2곡 = 평균 80\.00%/)).toBeInTheDocument();
    expect(recordUrls()[0]).toContain("/folders/5.8/users/1/records");
    expect(within(card).getByRole("button", { name: "기록 접기" })).toHaveAttribute("aria-expanded", "true");

    // 다른 점을 누르면 그 점의 카드로 바뀌고 상세는 접혀 있다
    fireEvent.click(within(plot).getByRole("button", { name: "5.8 폴더 · Gold · 평균 90.00%" }));
    const next = document.querySelector("[data-pick-card]") as HTMLElement;
    expect(next).toHaveTextContent("베타");
    expect(next.querySelector("[data-folder-records]")).toBeNull();
    expect(within(next).getByRole("button", { name: "기록 보기" })).toHaveAttribute("aria-expanded", "false");
  });
});
