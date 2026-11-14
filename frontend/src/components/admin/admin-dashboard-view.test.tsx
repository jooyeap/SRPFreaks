import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminDashboardView } from "@/components/admin/AdminDashboardView";
import type { DashboardResponse } from "@/lib/dashboard";

/** 2026-11-09 ~ 11-15 (7일). 가입자 누적은 44에서 시작해 11/9 +2, 11/12 +1, 11/15 +3 = 50. */
function weekData(): DashboardResponse {
  const dates = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];
  const added = [2, 0, 0, 1, 0, 0, 3];
  const totals = [46, 46, 46, 47, 47, 47, 50];
  const records = [0, 1, 0, 0, 0, 4, 7];
  return {
    days: 7,
    zone: "Asia/Seoul",
    from: "2026-11-09",
    to: "2026-11-15",
    summary: { totalUsers: 50, newUsers: 6, publicProfiles: 20, publicRatioPercent: 40, recordsToday: 7, recordsYesterday: 4, pendingSuggestions: 3 },
    signups: dates.map((date, i) => ({ date, newUsers: added[i], totalUsers: totals[i] })),
    records: dates.map((date, i) => ({ date, records: records[i] })),
    tiers: {
      basis: "PUBLIC_PROFILES",
      recordedUsers: 9,
      countedUsers: 4,
      rows: [
        { key: "silver", displayName: "Silver", minScore: 500, users: 1 },
        { key: "gold", displayName: "Gold", minScore: 1000, users: 3 },
      ],
    },
    suggestions: [
      { status: "RECEIVED", count: 3 },
      { status: "REVIEWING", count: 0 },
      { status: "DONE", count: 5 },
      { status: "REJECTED", count: 2 },
    ],
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("AdminDashboardView (관리자 대시보드, D80)", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(() => Promise.resolve(json(weekData())));
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderView() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <AdminDashboardView viewerId={1} />
      </QueryClientProvider>,
    );
  }

  function urls(): string[] {
    return fetchMock.mock.calls.map((call) => String(call[0]));
  }

  it("요약 카드: 전체 가입자·공개 프로필·오늘 기록·접수 대기 건의를 숫자 글자로 보여 준다", async () => {
    renderView();

    const total = (await screen.findByRole("heading", { name: "전체 가입자" })).closest("section")!;
    expect(total).toHaveTextContent("50명");
    expect(total).toHaveTextContent("최근 7일 +6명");
    const open = screen.getByRole("heading", { name: "공개 프로필" }).closest("section")!;
    expect(open).toHaveTextContent("20명");
    expect(open).toHaveTextContent("전체의 40.0%");
    const today = screen.getByRole("heading", { name: "오늘 기록 입력" }).closest("section")!;
    expect(today).toHaveTextContent("7건");
    expect(today).toHaveTextContent("어제 4건 (+3)");
    const pending = screen.getByRole("heading", { name: "접수 대기 건의" }).closest("section")!;
    expect(pending).toHaveTextContent("3건");
  });

  it("기간 기본은 7일이고 칩을 누르면 그 기간으로 다시 불러온다", async () => {
    renderView();
    await screen.findByRole("heading", { name: "전체 가입자" });
    expect(urls().at(-1)).toContain("/admin/dashboard?days=7");

    const group = screen.getByRole("group", { name: "기간" });
    expect(within(group).getByRole("button", { name: "7일" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(group).getByRole("button", { name: "30일" }));
    await waitFor(() => expect(urls().some((u) => u.includes("days=30"))).toBe(true));
    expect(within(group).getByRole("button", { name: "30일" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(group).getByRole("button", { name: "90일" }));
    await waitFor(() => expect(urls().some((u) => u.includes("days=90"))).toBe(true));
    expect(within(group).getAllByRole("button")).toHaveLength(3);
  });

  it("그래프: 처음에는 마지막 날이 골라져 있어 오늘 값이 글자로 보이고, 점을 누르면 날짜와 값이 바뀐다", async () => {
    renderView();
    const charts = await screen.findAllByTestId("dashboard-chart");
    expect(charts).toHaveLength(2);
    expect(charts[0]).toHaveAttribute("data-kind", "line");
    expect(charts[1]).toHaveAttribute("data-kind", "bar");

    const signups = charts[0].closest("section")!;
    expect(within(signups).getByRole("status")).toHaveTextContent("11/15 · 누적 50명 (그날 +3)");
    // 말풍선(그림 안)에도 날짜와 값이 있다
    expect(within(signups).getByTestId("dashboard-tooltip")).toHaveTextContent("11/15 50");

    // 가운데쯤(그림 폭 320 중 170 = 가운데 날짜 11/12)을 누른다
    vi.spyOn(charts[0], "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, right: 320, bottom: 176, width: 320, height: 176, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerDown(charts[0], { clientX: 170 });
    expect(within(signups).getByRole("status")).toHaveTextContent("11/12 · 누적 47명 (그날 +1)");
    expect(within(signups).getByTestId("dashboard-tooltip")).toHaveTextContent("11/12 47");
  });

  it("막대 그래프도 같은 방식으로 고르고, 키보드 화살표로 옮길 수 있다", async () => {
    renderView();
    const charts = await screen.findAllByTestId("dashboard-chart");
    const records = charts[1].closest("section")!;
    expect(within(records).getByRole("status")).toHaveTextContent("11/15 · 7건");

    fireEvent.keyDown(charts[1], { key: "ArrowLeft" });
    expect(within(records).getByRole("status")).toHaveTextContent("11/14 · 4건");
    fireEvent.keyDown(charts[1], { key: "Home" });
    expect(within(records).getByRole("status")).toHaveTextContent("11/09 · 0건");
    fireEvent.keyDown(charts[1], { key: "ArrowLeft" });   // 처음에서 더 왼쪽으로는 가지 않는다
    expect(within(records).getByRole("status")).toHaveTextContent("11/09 · 0건");
    fireEvent.keyDown(charts[1], { key: "End" });
    expect(within(records).getByRole("status")).toHaveTextContent("11/15 · 7건");
    fireEvent.keyDown(charts[1], { key: "ArrowRight" });   // 끝에서 더 오른쪽으로도 가지 않는다
    expect(within(records).getByRole("status")).toHaveTextContent("11/15 · 7건");
    // 막대는 날짜마다 하나다
    expect(charts[1].querySelectorAll("[data-bar]")).toHaveLength(7);
  });

  it("티어 분포는 공개 프로필 유저 기준임을 적고 티어별 인원을 숫자로 보여 준다", async () => {
    renderView();

    expect(await screen.findByText("공개 프로필 유저 4명 기준 (SRN+ 기록이 있는 유저 9명 중)")).toBeInTheDocument();
    const rows = within(screen.getByTestId("tier-rows")).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Silver");
    expect(rows[0]).toHaveTextContent("1명");
    expect(rows[1]).toHaveTextContent("Gold");
    expect(rows[1]).toHaveTextContent("3명");
  });

  it("건의 처리 현황은 네 상태(접수·확인 중·처리 완료·반려)의 개수를 보여 준다", async () => {
    renderView();

    await screen.findByRole("heading", { name: "건의 처리 현황" });
    const rows = within(screen.getByTestId("suggestion-rows")).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual(["접수3건", "확인 중0건", "처리 완료5건", "반려2건"]);
  });

  it("티어를 계산할 공개 유저가 없으면 안내 글자만 보인다", async () => {
    const data = weekData();
    data.tiers = { basis: "PUBLIC_PROFILES", recordedUsers: 2, countedUsers: 0, rows: [] };
    fetchMock.mockImplementation(() => Promise.resolve(json(data)));
    renderView();

    expect(await screen.findByText("티어를 계산할 공개 유저가 없습니다.")).toBeInTheDocument();
    expect(screen.queryByTestId("tier-rows")).toBeNull();
  });

  it("가입자가 0명이면 공개 비율은 대시로 보인다", async () => {
    const data = weekData();
    data.summary = { ...data.summary, totalUsers: 0, newUsers: 0, publicProfiles: 0, publicRatioPercent: null };
    fetchMock.mockImplementation(() => Promise.resolve(json(data)));
    renderView();

    const open = (await screen.findByRole("heading", { name: "공개 프로필" })).closest("section")!;
    expect(open).toHaveTextContent("전체의 –");
  });

  it("개인 정보와 판정 말이 화면에 없다 (이메일·닉네임·방문자 수·이상·경고)", async () => {
    renderView();
    await screen.findByRole("heading", { name: "전체 가입자" });

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/@|이메일|닉네임|방문자|페이지뷰|이상 징후|경고|위험|비정상/);
  });

  it("불러오지 못하면 안내와 다시 시도 버튼이 보인다", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json({ message: "오류" }, 500)));
    renderView();

    expect(await screen.findByText("대시보드를 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });
});
