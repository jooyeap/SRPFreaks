import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SkillSnapshotPanel } from "@/components/rating/SkillSnapshotPanel";
import type { SkillSnapshotResponse, SkillSnapshotStatusResponse } from "@/lib/api-types";

function row(id: number, date: string, total: number, change: number | null): SkillSnapshotResponse {
  return { id, date, totalScore: total, singleScore: total / 2, otherScore: total / 2, change };
}

describe("SkillSnapshotPanel", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let status: SkillSnapshotStatusResponse;
  let rows: SkillSnapshotResponse[];
  let totalPages: number;
  let postResponse: () => Response;

  const json = (body: unknown, code = 200) => new Response(JSON.stringify(body), { status: code, headers: { "Content-Type": "application/json" } });

  function renderPanel() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <SkillSnapshotPanel userId={1} />
      </QueryClientProvider>,
    );
  }
  const button = () => screen.getByRole("button", { name: /지금 레이팅 기록하기|기록 중입니다/ });

  beforeEach(() => {
    status = { available: true, reason: null };
    rows = [row(2, "2026-10-09", 130, 10), row(1, "2026-10-01", 120, null)];
    totalPages = 1;
    postResponse = () => json(row(3, "2026-10-10", 140, 10), 201);
    fetchMock.mockReset();
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (init?.method === "POST") return Promise.resolve(postResponse());
      if (url.includes("/snapshots/status")) return Promise.resolve(json(status));
      return Promise.resolve(json({ content: rows, page: 0, size: 10, totalElements: rows.length, totalPages }));
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("날짜별 목록과 증감을 글자로 보여 준다 (오름 ▲ +, 첫 기록 –)", async () => {
    renderPanel();
    const list = await screen.findByRole("list", { name: "레이팅 기록 목록" });
    const items = within(list).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("2026-10-09");
    expect(items[0]).toHaveTextContent("130.00");
    expect(items[0]).toHaveTextContent("▲ +10.00");
    expect(items[1]).toHaveTextContent("–");
  });

  it("내려간 기록은 ▼ -로 보인다", async () => {
    rows = [row(2, "2026-10-09", 110, -10), row(1, "2026-10-01", 120, null)];
    renderPanel();
    expect(await screen.findByText("▼ -10.00")).toBeInTheDocument();
  });

  it("기록할 수 있으면 버튼이 켜져 있고, 누르면 POST 한 뒤 목록을 다시 읽는다", async () => {
    renderPanel();
    await screen.findByRole("list", { name: "레이팅 기록 목록" });
    await waitFor(() => expect(button()).toBeEnabled());
    const before = fetchMock.mock.calls.length;
    fireEvent.click(button());
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => c[1]?.method === "POST")).toBe(true));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(before + 1)); // 목록·상태를 다시 읽는다
  });

  it.each([
    ["ALREADY_TODAY", "오늘은 이미 기록했습니다. 내일 다시 기록할 수 있습니다."],
    ["NO_CHANGE", "마지막 기록과 점수가 같아 기록할 수 없습니다."],
    ["NO_RECORDS", "레이팅에 들어간 기록이 없어 기록할 수 없습니다."],
  ] as const)("%s이면 버튼이 꺼지고 이유를 글자로 적는다", async (reason, text) => {
    status = { available: false, reason };
    renderPanel();
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(button()).toBeDisabled();
  });

  it("서버가 거절하면(409) 서버 문구를 알려 준다", async () => {
    postResponse = () => json({ code: "CONFLICT", message: "오늘은 이미 기록했습니다. 내일 다시 기록해 주세요.", timestamp: "t" }, 409);
    renderPanel();
    await waitFor(() => expect(button()).toBeEnabled());
    fireEvent.click(button());
    expect(await screen.findByRole("alert")).toHaveTextContent("오늘은 이미 기록했습니다. 내일 다시 기록해 주세요.");
  });

  it("기록이 하나도 없으면 안내만 보인다", async () => {
    rows = [];
    renderPanel();
    expect(await screen.findByText("아직 기록한 레이팅이 없습니다.")).toBeInTheDocument();
  });

  it("페이지가 둘 이상이면 이전/다음 이동이 나온다", async () => {
    totalPages = 3;
    renderPanel();
    const nav = await screen.findByRole("navigation", { name: "기록 페이지 이동" });
    expect(within(nav).getByRole("button", { name: "이전" })).toBeDisabled();
    fireEvent.click(within(nav).getByRole("button", { name: "다음" }));
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("page=1"))).toBe(true));
  });
});
