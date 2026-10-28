import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeSnapshotLine } from "@/components/home/HomeSnapshotLine";
import { ToastProvider } from "@/components/Toast";
import type { SkillSnapshotStatusResponse, SnapshotCompareResponse } from "@/lib/api-types";

const compareOk: SnapshotCompareResponse = {
  available: true, reason: null, fromDate: "2026-10-25", toDate: null, fromTotal: 1366.08, toTotal: 1400, totalChange: 33.92,
  entered: [], improved: [], declined: [], left: [],
};

describe("HomeSnapshotLine", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let status: SkillSnapshotStatusResponse;
  let compare: SnapshotCompareResponse;
  const json = (body: unknown, code = 200) => new Response(JSON.stringify(body), { status: code, headers: { "Content-Type": "application/json" } });

  const renderLine = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ToastProvider>
          <HomeSnapshotLine userId={1} />
        </ToastProvider>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    status = { available: true, reason: null, replacesToday: false };
    compare = compareOk;
    fetchMock.mockReset();
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (init?.method === "POST") return Promise.resolve(json({ id: 3, date: "2026-10-27", totalScore: 1400, singleScore: 700, otherScore: 700, change: 33.92 }, 201));
      if (url.includes("/snapshots/status")) return Promise.resolve(json(status));
      if (url.includes("/compare-current")) return Promise.resolve(json(compare));
      return Promise.resolve(json({}, 404));
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("점수가 바뀌었으면 마지막 기록 이후 변화량과 기록 버튼을 보여 주고, 누를 때만 기록한다", async () => {
    renderLine();
    const line = await screen.findByRole("region", { name: "레이팅 기록 제안" });
    await waitFor(() => expect(line.textContent).toContain("마지막 기록(2026-10-25) 이후 ▲ +33.92"));
    expect(fetchMock.mock.calls.some((c) => c[1]?.method === "POST")).toBe(false); // 자동 저장 없음
    fireEvent.click(screen.getByRole("button", { name: "지금 레이팅 기록하기" }));
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => c[1]?.method === "POST")).toBe(true));
  });

  it("오늘 이미 기록했으면 오늘 기록 이후 변화와 갱신 버튼을 보여 준다", async () => {
    status = { available: true, reason: null, replacesToday: true };
    renderLine();
    const line = await screen.findByRole("region", { name: "레이팅 기록 제안" });
    await waitFor(() => expect(line.textContent).toContain("오늘 기록 이후 ▲ +33.92"));
    expect(screen.getByRole("button", { name: "오늘 기록 갱신" })).toBeInTheDocument();
  });

  it("점수가 같아 기록할 수 없으면 아무것도 그리지 않는다", async () => {
    status = { available: false, reason: "NO_CHANGE", replacesToday: false };
    const { container } = renderLine();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(container.querySelector("section")).toBeNull();
  });

  it("처음이면(기록 없음) 첫 기록을 권한다", async () => {
    compare = { ...compareOk, available: false, reason: "NO_SNAPSHOT", fromDate: null };
    renderLine();
    expect(await screen.findByText("아직 기록한 레이팅이 없습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "지금 레이팅 기록하기" })).toBeInTheDocument();
  });
});
