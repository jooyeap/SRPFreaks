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

  it("오늘 기록할 수 있으면 카드 한 장에 변화량(한 번만)과 기록 버튼이 함께 있고, 누르면 기록한다", async () => {
    renderInsights();
    const card = await screen.findByRole("region", { name: "레이팅 현황" });
    // 변화량은 카드 안에 한 번만 나온다(예전에는 기록 제안 배너와 대비 줄이 각각 적어서 두 번 보였다)
    expect(await within(card).findByText(/마지막 기록\(2026-10-10\) 대비/)).toBeInTheDocument();
    expect(card.textContent?.match(/\+33\.92/g)).toHaveLength(1);
    expect(screen.queryByRole("region", { name: "레이팅 기록 제안" })).toBeNull();
    // 기록 제안 설명 줄(사용자 문구 그대로)은 같은 카드 안, 숫자 줄 아래에 있다
    const hint = within(card).getByText("지금 점수를 기록으로 남겨 두면 나중에 얼마나 올랐는지 비교할 수 있습니다.");
    expect(hint).toBeInTheDocument();
    expect(card.textContent?.match(/나중에 얼마나 올랐는지/g)).toHaveLength(1);
    const summary = within(card).getByText(/마지막 기록\(2026-10-10\) 대비/);
    expect(summary.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "지금 레이팅 기록하기" }));
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => c[1]?.method === "POST")).toBe(true));
  });

  it("점수가 같아 기록할 수 없으면 제안을 보이지 않는다", async () => {
    status = { available: false, reason: "NO_CHANGE", replacesToday: false };
    renderInsights();
    await screen.findByText(/새로 들어온 곡/); // 요약은 보인다
    expect(screen.queryByRole("button", { name: "지금 레이팅 기록하기" })).toBeNull();
    expect(screen.queryByText("지금 점수를 기록으로 남겨 두면 나중에 얼마나 올랐는지 비교할 수 있습니다.")).toBeNull(); // 기록을 권하지 않으면 설명도 없다
  });

  it("오늘 이미 기록했으면 갱신할 수 있어도 제안을 다시 띄우지 않는다(저장할 때마다 뜨지 않게)", async () => {
    status = { available: true, reason: null, replacesToday: true };
    renderInsights();
    await screen.findByText(/새로 들어온 곡/); // 요약은 보인다
    expect(screen.queryByRole("button", { name: "지금 레이팅 기록하기" })).toBeNull();
  });

  it("처음이면(기록 없음) 첫 기록을 권한다", async () => {
    compare = { ...compareOk, available: false, reason: "NO_SNAPSHOT", totalChange: null as unknown as number };
    renderInsights();
    expect(await screen.findByText("아직 기록한 레이팅이 없습니다.")).toBeInTheDocument();
    // 숫자 없이 안내와 기록 버튼만 있고, 펼칠 요약은 없다
    expect(screen.getByRole("button", { name: "지금 레이팅 기록하기" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /대비/ })).toBeNull();
    expect(screen.queryByText(/[▲▼±]/)).toBeNull();
  });

  it("기록 없음 상태에서도 안내 아래에 설명 줄이 한 번 보인다(같은 말을 되풀이하지 않는다)", async () => {
    compare = { ...compareOk, available: false, reason: "NO_SNAPSHOT", totalChange: null as unknown as number };
    renderInsights();
    const card = await screen.findByRole("region", { name: "레이팅 현황" });
    await within(card).findByText("아직 기록한 레이팅이 없습니다.");
    expect(card.textContent?.match(/나중에 얼마나 올랐는지/g)).toHaveLength(1);
  });

  it("기록 버튼과 요약(펼침) 버튼은 터치 영역이 44px 이상이다", async () => {
    renderInsights();
    const summary = await screen.findByRole("button", { name: /마지막 기록\(2026-10-10\) 대비/ });
    expect(summary.className).toContain("min-h-11");
    expect(screen.getByRole("button", { name: "지금 레이팅 기록하기" }).className).toContain("min-h-11");
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
