import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { DifficultyTableView } from "@/components/table/DifficultyTableView";
import { StageBadge } from "@/components/table/StageBadge";
import { TierGroupSection, groupStage } from "@/components/table/TierGroupSection";
import type { DifficultyTableResponse, PageResponse, TableEntryResponse, TierGroupResponse } from "@/lib/api-types";

function entry(over: Partial<TableEntryResponse> = {}): TableEntryResponse {
  return {
    entryId: 1,
    songDifficultyId: 10,
    songId: 100,
    title: "테스트곡",
    addedVersion: "V1",
    part: "GUITAR",
    difficulty: "MASTER",
    level: 9.5,
    tierUncertain: false,
    recommend: "상",
    recommendUncertain: false,
    pattern: "단일",
    patternUncertain: false,
    mine: { rate: 96.5, fullCombo: false, stage: "SS" },
    ...over,
  };
}

function group(over: Partial<TierGroupResponse> = {}): TierGroupResponse {
  return {
    tier: 5.8,
    total: 4,
    recorded: 3,
    exc: 1,
    fc: 0,
    ss: 1,
    s: 0,
    belowS: 1,
    averageRecorded: 90,
    averageWithZero: 67.5,
    entries: [entry()],
    ...over,
  };
}

describe("StageBadge", () => {
  it("단계 글자를 항상 표시한다 (색만으로 구분하지 않는다)", () => {
    render(<StageBadge stage="EXC" />);
    expect(screen.getByLabelText("달성 단계 EXC")).toHaveTextContent("EXC");
  });
});

describe("groupStage (묶음 전체 달성 단계)", () => {
  const all = (over: Partial<TierGroupResponse>) => group({ total: 4, recorded: 4, exc: 0, fc: 0, ss: 0, s: 0, belowS: 0, ...over });

  it("모든 곡이 EXC면 EXC", () => {
    expect(groupStage(all({ exc: 4 }))).toBe("EXC");
  });
  it("모든 곡이 같은 단계 '이상'이면 가장 낮은 그 단계 (EXC 1 + FC 1 + SS 2 → SS)", () => {
    expect(groupStage(all({ exc: 1, fc: 1, ss: 2 }))).toBe("SS");
    expect(groupStage(all({ exc: 1, fc: 3 }))).toBe("FC");
    expect(groupStage(all({ ss: 1, s: 3 }))).toBe("S");
  });
  it("한 곡이라도 S 미만이거나 기록이 없으면 없음", () => {
    expect(groupStage(all({ exc: 3, belowS: 1 }))).toBeNull();
    expect(groupStage(all({ exc: 3, recorded: 3 }))).toBeNull(); // 미플레이 1곡
  });
  it("곡이 0개인 묶음은 없음", () => {
    expect(groupStage(all({ total: 0, recorded: 0 }))).toBeNull();
  });
});

describe("TierGroupSection", () => {
  it("묶음 전체가 한 단계 이상이면 머리에 단계 효과(막대)가 붙고, 아니면 붙지 않는다", () => {
    const { container, rerender } = render(
      <TierGroupSection group={group({ total: 4, recorded: 4, exc: 1, fc: 0, ss: 3, s: 0, belowS: 0 })} includeZero={false} />,
    );
    expect(container.querySelector("header[data-group-stage='SS']")).not.toBeNull();
    expect(container.querySelector("header .stage-bar")).not.toBeNull();
    rerender(<TierGroupSection group={group()} includeZero={false} />);
    expect(container.querySelector("header[data-group-stage]")).toBeNull();
    expect(container.querySelector("header .stage-bar")).toBeNull();
  });

  it("제목, 칩 5개, 기록 n/전체, 미포함 평균을 보여 준다", () => {
    render(<TierGroupSection group={group()} includeZero={false} />);
    expect(screen.getByRole("heading", { name: /5\.8\s*4개/ })).toBeInTheDocument();
    const chips = within(screen.getByRole("list", { name: "내 달성 현황" })).getAllByRole("listitem");
    expect(chips.map((c) => c.textContent)).toEqual(["EXC 1", "FC 0", "SS 1", "S 0", "S 미만 1"]);
    expect(screen.getByText("기록 3/4")).toBeInTheDocument();
    expect(screen.getByText("90.00%")).toBeInTheDocument();
  });

  it("'0% 포함'이면 서버가 준 0% 포함 평균을 보여 준다", () => {
    render(<TierGroupSection group={group()} includeZero />);
    expect(screen.getByText("67.50%")).toBeInTheDocument();
  });

  it("기록이 하나도 없는 묶음은 미포함 평균을 `–`로 보여 준다", () => {
    render(
      <TierGroupSection
        group={group({ recorded: 0, exc: 0, ss: 0, belowS: 0, averageRecorded: null, averageWithZero: 0, entries: [entry({ mine: null })] })}
        includeZero={false}
      />,
    );
    expect(screen.getByText("기록 0/4")).toBeInTheDocument();
    // `–`는 줄마다 달성률 자리에도 나오므로 평균 문구 안에서만 확인한다
    expect(screen.getByText(/^평균/)).toHaveTextContent("평균 –");
  });

  it("기준 난이도가 없는 묶음은 `미정`이라고 쓴다", () => {
    render(<TierGroupSection group={group({ tier: null })} includeZero={false} />);
    expect(screen.getByRole("heading", { name: /미정/ })).toBeInTheDocument();
  });

  it("기록이 있는 줄은 단계 표시와 달성률을, 없는 줄은 단계 없이 `–`를 보여 준다", () => {
    render(
      <TierGroupSection
        group={group({
          entries: [
            entry({ entryId: 1, title: "기록있음", mine: { rate: 100, fullCombo: true, stage: "EXC" } }),
            entry({ entryId: 2, title: "기록없음", mine: null }),
          ],
        })}
        includeZero={false}
      />,
    );
    // 모바일 카드와 데스크톱 줄이 둘 다 DOM에 있어 곡명이 두 번씩 나온다 (보이는 쪽은 CSS가 정한다)
    expect(screen.getAllByText("기록있음")).toHaveLength(2);
    expect(screen.getAllByLabelText("달성 단계 EXC").length).toBeGreaterThan(0);
    expect(screen.getAllByText("MAX").length).toBeGreaterThan(0);
    expect(screen.queryAllByLabelText(/달성 단계/)).toHaveLength(2); // 기록 있는 곡의 카드 + 줄 하나씩, 기록 없는 곡은 없음
  });
});

describe("DifficultyTableView", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const table: DifficultyTableResponse = {
    id: 3,
    name: "SRN+ 서열표",
    instrumentPart: "GUITAR",
    noteOption: "SUPER_RANDOM_PLUS",
    status: "ACTIVE",
    revision: 1,
  };

  function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }
  function page(groups: TierGroupResponse[], over: Partial<PageResponse<TierGroupResponse>> = {}) {
    return { content: groups, page: 0, size: 10, totalElements: groups.length, totalPages: 1, ...over };
  }
  function renderView() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <DifficultyTableView userId={1} />
      </QueryClientProvider>,
    );
  }
  /** 호출된 URL 중 entries 요청의 쿼리 값을 읽는다 */
  function entryParams(index: number): URLSearchParams {
    const urls = fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/entries"));
    return new URL(urls[index], "http://x").searchParams;
  }

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("SRN+ 서열표를 골라 묶음을 보여 준다", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(String(input).includes("/entries") ? json(page([group()])) : json([table])),
    );
    renderView();
    expect(await screen.findByRole("heading", { name: "SRN+ 서열표" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /5\.8/ })).toBeInTheDocument();
    expect(String(fetchMock.mock.calls.find((c) => String(c[0]).includes("/entries"))?.[0])).toContain(
      "/difficulty-tables/3/entries",
    );
  });

  it("서열표 화면 상단에 정보 제공자 표기와 X 링크를 보여 준다", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(String(input).includes("/entries") ? json(page([group()])) : json([table])),
    );
    renderView();
    expect(await screen.findByRole("link", { name: /イズニャン/ })).toHaveAttribute("href", "https://x.com/trist_is");
  });

  it("SRN+ 서열표가 없으면 안내 문구를 보여 준다", async () => {
    fetchMock.mockResolvedValue(json([{ ...table, noteOption: "NORMAL" }]));
    renderView();
    expect(await screen.findByText("SRN+ 서열표가 아직 없습니다.")).toBeInTheDocument();
  });

  it("서버 오류는 서버가 준 문구로 알려 준다", async () => {
    fetchMock.mockResolvedValue(json({ code: "INTERNAL", message: "서버에 문제가 생겼습니다.", timestamp: "t" }, 500));
    renderView();
    expect(await screen.findByRole("alert")).toHaveTextContent("서버에 문제가 생겼습니다.");
  });

  it("필터를 바꾸면 해당 값으로 다시 요청하고 첫 페이지로 돌아간다", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        String(input).includes("/entries") ? json(page([group()], { page: 0, totalPages: 3 })) : json([table]),
      ),
    );
    renderView();
    await screen.findByRole("heading", { name: /5\.8/ });

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    await waitFor(() => expect(entryParams(1).get("page")).toBe("1"));

    fireEvent.click(within(screen.getByRole("group", { name: "파트" })).getByRole("button", { name: "Bass" }));
    await waitFor(() => expect(entryParams(2).get("part")).toBe("BASS"));
    expect(entryParams(2).get("page")).toBe("0");
  });

  it("필터는 접었다 펼 수 있고, 접힌 줄에 걸린 필터를 요약한다", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(String(input).includes("/entries") ? json(page([group()])) : json([table])),
    );
    renderView();
    const toggle = await screen.findByRole("button", { name: /^필터/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveTextContent("전체 · 평균 0% 미포함");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: "Guitar" }));
    fireEvent.click(screen.getByRole("button", { name: "상" }));
    fireEvent.click(screen.getByRole("button", { name: "0% 포함" }));
    expect(toggle).toHaveTextContent("Guitar · 추천 상 · 평균 0% 포함");
  });

  it("평균 토글은 서버를 다시 부르지 않고 표시만 바꾼다", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(String(input).includes("/entries") ? json(page([group()])) : json([table])),
    );
    renderView();
    await screen.findByText("90.00%");
    const callsBefore = fetchMock.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "0% 포함" }));
    expect(screen.getByText("67.50%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "0% 포함" })).toHaveAttribute("aria-pressed", "true");
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it("줄의 기록 버튼을 누르면 그 채보의 기록 등록 창이 열린다", async () => {
    // 기록 창 안의 "내 기록 목록"이 로그인 정보(useAuth)를 쓰므로 AuthProvider로 감싼다
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        return Promise.resolve(
          json({
            accessToken: "t",
            tokenType: "Bearer",
            expiresIn: 900,
            user: { id: 1, email: "a@example.com", nickname: null, role: "USER", createdAt: "2026-10-01T00:00:00Z" },
          }),
        );
      }
      if (url.includes("/records?")) return Promise.resolve(json(page([]) as unknown));
      return Promise.resolve(url.includes("/entries") ? json(page([group()])) : json([table]));
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <DifficultyTableView userId={1} />
        </AuthProvider>
      </QueryClientProvider>,
    );
    await screen.findByRole("heading", { name: /5\.8/ });
    expect(screen.queryByRole("heading", { name: "기록 등록" })).toBeNull();

    // 모바일 카드와 데스크톱 줄에 버튼이 하나씩 있다. 어느 쪽이 보일지는 화면 폭(CSS)이 정한다.
    fireEvent.click(screen.getAllByRole("button", { name: "테스트곡 기록 입력" })[0]);
    expect(await screen.findByRole("heading", { name: "기록 등록" })).toBeInTheDocument();
    expect(screen.getByLabelText("달성률")).toBeInTheDocument();
  });
});
