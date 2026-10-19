import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SkillSnapshotPanel } from "@/components/rating/SkillSnapshotPanel";
import type { SkillSnapshotResponse, SkillSnapshotStatusResponse, SnapshotCompareChange, SnapshotCompareResponse } from "@/lib/api-types";

function row(id: number, date: string, total: number, change: number | null): SkillSnapshotResponse {
  return { id, date, totalScore: total, singleScore: total / 2, otherScore: total / 2, change };
}

function change(id: number, title: string, before: number | null, after: number | null): SnapshotCompareChange {
  return {
    songDifficultyId: id, songId: id * 10, title, part: "GUITAR", difficulty: "MASTER", group: "SINGLE",
    rateBefore: before === null ? null : 90, rateAfter: after === null ? null : 95, scoreBefore: before, scoreAfter: after,
  };
}
const emptyCompare: SnapshotCompareResponse = {
  available: true, reason: null, fromDate: "2026-10-01", toDate: "2026-10-09", fromTotal: 120, toTotal: 130, totalChange: 10,
  entered: [], improved: [], declined: [], left: [],
};

describe("SkillSnapshotPanel", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let status: SkillSnapshotStatusResponse;
  let rows: SkillSnapshotResponse[];
  let totalPages: number;
  let postResponse: () => Response;
  let compare: SnapshotCompareResponse;
  let compareStatus: number;

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
    compare = emptyCompare;
    compareStatus = 200;
    fetchMock.mockReset();
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (init?.method === "POST") return Promise.resolve(postResponse());
      if (url.includes("/compare")) {
        return Promise.resolve(compareStatus === 200 ? json(compare) : json({ code: "ERROR", message: "비교하지 못했습니다.", timestamp: "t" }, compareStatus));
      }
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

  it("총점 글자는 그 점수의 플레이어 티어 색을 갖고, 숫자는 그대로 보인다", async () => {
    rows = [row(3, "2026-10-19", 8135.47, 108.97), row(2, "2026-10-13", 7472.03, 3626.61), row(1, "2026-10-10", 3845.42, null)];
    renderPanel();
    const list = await screen.findByRole("list", { name: "레이팅 기록 목록" });
    expect(within(list).getByText("8135.47")).toHaveAttribute("data-tier", "GOLD");
    expect(within(list).getByText("7472.03")).toHaveAttribute("data-tier", "BRONZE");
    expect(within(list).getByText("3845.42")).toHaveAttribute("data-tier", "GREEN_GRADIENT");
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

  describe("이전 기록과 비교", () => {
    const compareButton = (date: string) => screen.getByRole("button", { name: `${date} 기록을 이전 기록과 비교` });

    it("가장 오래된 기록에는 비교 버튼이 없고, 이전 기록이 있는 줄에만 있다", async () => {
      renderPanel();
      await screen.findByRole("list", { name: "레이팅 기록 목록" });
      expect(compareButton("2026-10-09")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "2026-10-01 기록을 이전 기록과 비교" })).not.toBeInTheDocument();
    });

    it("누르기 전에는 비교를 불러오지 않고, 누르면 기록 갱신에 새로 들어온 곡 NEW와 오른 곡을 묶어 보여 준다", async () => {
      compare = {
        ...emptyCompare,
        entered: [change(1, "Alpha", null, 35.5)],
        improved: [change(2, "Beta", 30, 35.5)],
        declined: [change(3, "Gamma", 40, 38)],
        left: [change(4, "Delta", 20, null)],
      };
      renderPanel();
      await screen.findByRole("list", { name: "레이팅 기록 목록" });
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/compare"))).toBe(false);

      fireEvent.click(compareButton("2026-10-09"));
      const updated = await screen.findByRole("region", { name: "기록 갱신" });
      expect(within(updated).getByText("NEW")).toBeInTheDocument();
      expect(within(updated).getByText("Alpha")).toBeInTheDocument();
      // 새로 들어온 곡(Alpha)과 오른 곡(Beta)이 한 묶음에 있고 NEW는 새로 들어온 곡에만 붙는다
      const rows = within(updated).getAllByRole("listitem");
      expect(rows).toHaveLength(2);
      expect(within(updated).getAllByText("NEW")).toHaveLength(1);
      // 점수는 티어 색을 위해 각각 span이라 줄 전체 글자로 확인한다
      expect(rows[1]).toHaveTextContent(/30\.00 → 35\.50 \(\+5\.50\)/);
      expect(within(screen.getByRole("region", { name: "점수가 내려간 곡" })).getByRole("listitem")).toHaveTextContent(/\(-2\.00\)/);
      expect(within(screen.getByRole("region", { name: "후보곡" })).getByRole("listitem")).toHaveTextContent(/목록 밖/);
    });

    it("이전·이후 점수는 각각 자기 점수의 티어 색을 갖고, 숫자 글자도 그대로 보인다", async () => {
      // 곡 점수 기준(티어 최소 점수 ÷ 40): White Gradient 12.5~25, Orange 25~37.5
      compare = { ...emptyCompare, improved: [change(2, "Beta", 20, 30)], left: [change(4, "Delta", 30, null)] };
      renderPanel();
      await screen.findByRole("list", { name: "레이팅 기록 목록" });
      fireEvent.click(compareButton("2026-10-09"));

      const row = within(await screen.findByRole("region", { name: "기록 갱신" })).getByRole("listitem");
      const before = within(row).getByText("20.00");
      const after = within(row).getByText("30.00");
      expect(before).toHaveAttribute("data-tier", "WHITE_GRADIENT"); // 12.5 이상 25 미만
      expect(after).toHaveAttribute("data-tier", "ORANGE"); // 25 이상 37.5 미만
      expect(before).toHaveClass("tier-score");
      const left = within(screen.getByRole("region", { name: "후보곡" })).getByText("30.00");
      expect(left).toHaveAttribute("data-tier", "ORANGE");
    });

    it("다시 누르면 닫힌다", async () => {
      renderPanel();
      await screen.findByRole("list", { name: "레이팅 기록 목록" });
      fireEvent.click(compareButton("2026-10-09"));
      expect(await screen.findByText("곡 목록에는 달라진 점이 없습니다.")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "2026-10-09 기록을 이전 기록과 비교" }));
      await waitFor(() => expect(screen.queryByText("곡 목록에는 달라진 점이 없습니다.")).not.toBeInTheDocument());
    });

    it("곡별 상세가 없던 옛 기록이면 이유를 글자로 알려 준다", async () => {
      compare = { ...emptyCompare, available: false, reason: "NO_DETAIL" };
      renderPanel();
      await screen.findByRole("list", { name: "레이팅 기록 목록" });
      fireEvent.click(compareButton("2026-10-09"));
      expect(await screen.findByText(/곡별 상세를 남기기 전의 기록/)).toBeInTheDocument();
    });

    it("서버 오류면 문구를 보여 준다", async () => {
      compareStatus = 500;
      renderPanel();
      await screen.findByRole("list", { name: "레이팅 기록 목록" });
      fireEvent.click(compareButton("2026-10-09"));
      expect(await screen.findByRole("alert")).toHaveTextContent("비교하지 못했습니다.");
    });
  });
});
