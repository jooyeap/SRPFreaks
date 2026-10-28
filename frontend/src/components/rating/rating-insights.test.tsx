import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RatingInsights } from "@/components/rating/RatingInsights";
import { ToastProvider } from "@/components/Toast";
import type { SkillSnapshotStatusResponse, SnapshotCompareResponse } from "@/lib/api-types";

const compareOk: SnapshotCompareResponse = {
  available: true, reason: null, fromDate: "2026-10-10", toDate: null, fromTotal: 1366.08, toTotal: 1400, totalChange: 33.92,
  entered: [{ songDifficultyId: 9, songId: 9, title: "신곡", part: "GUITAR", difficulty: "MASTER", group: "SINGLE", rateBefore: null, rateAfter: 95, scoreBefore: null, scoreAfter: 280 }],
  improved: [], declined: [], left: [],
};

describe("RatingInsights", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let status: SkillSnapshotStatusResponse;
  let compare: SnapshotCompareResponse;
  const json = (body: unknown, code = 200) => new Response(JSON.stringify(body), { status: code, headers: { "Content-Type": "application/json" } });

  function renderInsights() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <RatingInsights userId={1} />
        </ToastProvider>
      </QueryClientProvider>,
    );
  }

  beforeEach(() => {
    status = { available: true, reason: null, replacesToday: false };
    compare = compareOk;
    fetchMock.mockReset();
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (init?.method === "POST") return Promise.resolve(json({ id: 3, date: "2026-10-16", totalScore: 1400, singleScore: 700, otherScore: 700, change: 33.92 }, 201));
      if (url.includes("/snapshots/status")) return Promise.resolve(json(status));
      if (url.includes("/compare-current")) return Promise.resolve(json(compare));
      return Promise.resolve(json({}, 404));
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("오늘 기록할 수 있으면 변화량과 함께 기록 제안을 눈에 띄게 보여 주고, 누르면 기록한다", async () => {
    renderInsights();
    const banner = await screen.findByRole("region", { name: "레이팅 기록 제안" });
    expect(await within(banner).findByText(/마지막 기록\(2026-10-10\) 이후 레이팅이 ▲ \+33\.92 달라졌습니다\./)).toBeInTheDocument();
    fireEvent.click(within(banner).getByRole("button", { name: "지금 레이팅 기록하기" }));
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => c[1]?.method === "POST")).toBe(true));
  });

  it("점수가 같아 기록할 수 없으면 제안을 보이지 않는다", async () => {
    status = { available: false, reason: "NO_CHANGE", replacesToday: false };
    renderInsights();
    await screen.findByText(/새로 들어온 곡/); // 요약은 보인다
    expect(screen.queryByRole("region", { name: "레이팅 기록 제안" })).toBeNull();
  });

  it("오늘 이미 기록했으면 갱신할 수 있어도 제안을 다시 띄우지 않는다(저장할 때마다 뜨지 않게)", async () => {
    status = { available: true, reason: null, replacesToday: true };
    renderInsights();
    await screen.findByText(/새로 들어온 곡/); // 요약은 보인다
    expect(screen.queryByRole("region", { name: "레이팅 기록 제안" })).toBeNull();
  });

  it("처음이면(기록 없음) 첫 기록을 권한다", async () => {
    compare = { ...compareOk, available: false, reason: "NO_SNAPSHOT", totalChange: null as unknown as number };
    renderInsights();
    expect(await screen.findByText("아직 기록한 레이팅이 없습니다.")).toBeInTheDocument();
  });

  it("요약 한 줄은 변화량과 새로 들어온 곡 수를 보이고, 누르면 곡별 비교를 펼친다", async () => {
    renderInsights();
    const summary = await screen.findByRole("button", { name: /마지막 기록\(2026-10-10\) 대비/ });
    expect(summary).toHaveTextContent("▲ +33.92");
    expect(summary).toHaveTextContent("새로 들어온 곡 1개");
    expect(summary).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(summary);
    expect(await screen.findByRole("region", { name: "기록 갱신" })).toHaveTextContent("신곡");
  });

  it("점수도 목록도 그대로면 접는 줄 대신 `변화가 없습니다` 한 줄만 보인다", async () => {
    compare = { ...compareOk, toTotal: 1366.08, totalChange: 0, entered: [] };
    renderInsights();
    expect(await screen.findByText("마지막 기록(2026-10-10) 이후 레이팅 변화가 없습니다.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /대비/ })).toBeNull();
  });

  it("새로 들어온 곡이 없으면 `새로 들어온 곡 0개`는 빼고 증감만 적는다", async () => {
    compare = { ...compareOk, entered: [], improved: [{ ...compareOk.entered[0], rateBefore: 90, scoreBefore: 250 }] };
    renderInsights();
    const summary = await screen.findByRole("button", { name: /마지막 기록\(2026-10-10\) 대비/ });
    expect(summary).toHaveTextContent("▲ +33.92");
    expect(summary).not.toHaveTextContent("새로 들어온 곡");
  });
});
