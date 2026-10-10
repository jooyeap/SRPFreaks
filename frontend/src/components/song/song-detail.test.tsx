import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { SongDetailView } from "@/components/song/SongDetailView";
import type {
  DifficultyTableResponse,
  SongDetailResponse,
  TableEntryResponse,
  TierGroupResponse,
} from "@/lib/api-types";
import { clearAccessToken } from "@/lib/auth-token";
import type { SongDetailOrigin } from "@/lib/songs";

const back = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ back, push: vi.fn(), replace: vi.fn() }) }));
// 링크가 기록을 쌓는지(push) 바꿔치는지(replace) 확인할 수 있게, 진짜 Link 대신 replace 여부를 표시하는 a 태그를 쓴다
vi.mock("next/link", () => ({
  default: ({ href, replace, children, ...rest }: { href: string; replace?: boolean; children: React.ReactNode }) => (
    <a href={href} data-replace={replace ? "true" : "false"} {...rest}>
      {children}
    </a>
  ),
}));

const table: DifficultyTableResponse = {
  id: 3,
  name: "SRN+ 서열표",
  instrumentPart: "GUITAR",
  noteOption: "SUPER_RANDOM_PLUS",
  status: "ACTIVE",
  revision: 1,
};

const song: SongDetailResponse = {
  id: 1,
  title: "테스트곡",
  artist: "아티스트",
  addedVersion: "V5",
  titleFolder: null,
  bpmMin: 120,
  bpmMax: 180,
  source: null,
  titles: [],
  difficulties: [
    { id: 10, songId: 1, instrumentPart: "GUITAR", difficultyType: "MASTER", level: 9.8, noteCount: 1234 },
    { id: 11, songId: 1, instrumentPart: "GUITAR", difficultyType: "EXTREME", level: 7.2, noteCount: null },
    { id: 12, songId: 1, instrumentPart: "BASS", difficultyType: "MASTER", level: 8.5, noteCount: 900 },
  ],
};

function entry(over: Partial<TableEntryResponse> & { songDifficultyId: number }): TableEntryResponse {
  return {
    entryId: over.songDifficultyId,
    songId: 1,
    title: "테스트곡",
    addedVersion: "V5",
    part: "GUITAR",
    difficulty: "MASTER",
    level: 9.8,
    tierUncertain: false,
    recommend: "상",
    recommendUncertain: false,
    pattern: "복합",
    patternUncertain: false,
    ratingEnabled: true,
    mine: null,
    ...over,
  };
}

const prevEntry = entry({ songDifficultyId: 90, songId: 9, title: "앞곡", level: 9.9, mine: { rate: 91, fullCombo: false, stage: "S" } });
const mainEntry = entry({ songDifficultyId: 10, mine: { rate: 100, fullCombo: true, stage: "EXC" } });
const nextEntry = entry({ songDifficultyId: 91, songId: 8, title: "뒷곡", level: 9.5, mine: null });
const groups: TierGroupResponse[] = [
  {
    tier: 5.8,
    total: 3,
    recorded: 2,
    exc: 1,
    fc: 0,
    ss: 0,
    s: 1,
    belowS: 0,
    averageRecorded: 95.5,
    averageWithZero: 63.67,
    entries: [prevEntry, mainEntry, nextEntry],
  },
  {
    tier: 5.1,
    total: 2,
    recorded: 0,
    exc: 0,
    fc: 0,
    ss: 0,
    s: 0,
    belowS: 0,
    averageRecorded: null,
    averageWithZero: 0,
    entries: [
      entry({ songDifficultyId: 11, difficulty: "EXTREME", level: 7.2, recommend: "하", pattern: "단일" }),
      entry({ songDifficultyId: 12, part: "BASS", level: 8.5, recommend: null, pattern: null }),
    ],
  },
];

const AUTH = {
  accessToken: "t",
  tokenType: "Bearer",
  expiresIn: 900,
  user: { id: 1, email: "a@example.com", nickname: null, role: "USER", createdAt: "2026-10-01T00:00:00Z" },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("SongDetailView", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let tables: DifficultyTableResponse[];
  let songResponse: () => Response;

  beforeEach(() => {
    clearAccessToken();
    back.mockReset();
    fetchMock.mockReset();
    tables = [table];
    songResponse = () => json(song);
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return Promise.resolve(json(AUTH));
      if (url.includes("/difficulty-tables/") && url.includes("/entries")) {
        return Promise.resolve(json({ content: groups, page: 0, size: 20, totalElements: 2, totalPages: 1 }));
      }
      if (url.endsWith("/difficulty-tables")) return Promise.resolve(json(tables));
      if (url.includes("/songs/")) return Promise.resolve(songResponse());
      if (url.includes("/records?")) {
        return Promise.resolve(
          json({
            content: [{ id: 5, songDifficultyId: 10, achievementRate: 100, fullCombo: true, stage: "EXC", playedAt: "2026-10-04T15:00:00Z" }],
            page: 0,
            size: 1,
            totalElements: 1,
            totalPages: 1,
          }),
        );
      }
      return Promise.resolve(json({}, 404));
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  function renderView(origin: SongDetailOrigin, chartId: number | null, wrapAuth = false, canEditTable = false) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = <SongDetailView songId={1} chartId={chartId} origin={origin} userId={1} canEditTable={canEditTable} />;
    return render(<QueryClientProvider client={client}>{wrapAuth ? <AuthProvider>{view}</AuthProvider> : view}</QueryClientProvider>);
  }

  it("미정 묶음의 채보는 곡 상세에서 보이되 `묶음 전체 보기` 링크는 없다 (서열표 화면에서 뺀 묶음이라)", async () => {
    const undecided: TierGroupResponse = { ...groups[1], tier: null, entries: [mainEntry] };
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return Promise.resolve(json(AUTH));
      if (url.includes("/difficulty-tables/") && url.includes("/entries")) {
        return Promise.resolve(json({ content: [undecided], page: 0, size: 20, totalElements: 1, totalPages: 1 }));
      }
      if (url.includes("/difficulty-tables")) return Promise.resolve(json(tables));
      return Promise.resolve(songResponse());
    });
    renderView("table", 10);
    const neighbors = await screen.findByRole("region", { name: "같은 난이도의 곡" });
    expect(within(neighbors).queryByRole("link", { name: "묶음 전체 보기" })).not.toBeInTheDocument();
  });

  it("서열표에서: 속성 칩, 서열표 정보, 내 기록, 같은 난이도의 곡 목록, 다른 채보를 보여 준다", async () => {
    renderView("table", 10);
    expect(await screen.findByRole("heading", { name: "테스트곡" })).toBeInTheDocument();
    expect(await screen.findByText("속성 복합")).toBeInTheDocument();
    expect(screen.getByText(/SRN\+ 서열표 ·/)).toHaveTextContent("5.8");

    const info = await screen.findByRole("region", { name: "서열표 정보" });
    expect(within(info).getByText(/묶음 3개/)).toHaveTextContent("5.8 묶음 3개 · 내 평균 95.50%");
    expect(within(info).getByRole("list", { name: "묶음 안의 내 달성 현황" }).textContent).toBe("EXC 1FC 0SS 0S 1");

    const mine = screen.getByRole("region", { name: "내 기록" });
    expect(within(mine).getByText("MAX")).toBeInTheDocument();
    expect(within(mine).getByLabelText("달성 단계 EXC")).toBeInTheDocument();
    expect(within(mine).getByText("2026-10-05")).toBeInTheDocument(); // UTC 15:00 = 서울 다음 날 00:00
    expect(within(mine).getByText("SRN+")).toBeInTheDocument();
    expect(within(mine).getByText("서열표는 SRN+, Premium Free 기준입니다.")).toBeInTheDocument();

    const neighbors = screen.getByRole("region", { name: "같은 난이도의 곡" });
    expect(within(neighbors).getByRole("link", { name: /앞곡/ })).toHaveAttribute("href", "/songs/9?from=table&chart=90");
    expect(within(neighbors).getByRole("link", { name: /뒷곡/ })).toHaveAttribute("href", "/songs/8?from=table&chart=91");
    expect(within(neighbors).getByText("기록 없음")).toBeInTheDocument();
    // 묶음 전체 목록: 지금 보는 곡은 강조(aria-current)와 글자("보는 중")로 표시하고, 묶음 페이지로 가는 링크가 있다
    const current = within(neighbors).getAllByRole("listitem").filter((li) => li.getAttribute("aria-current") === "true");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("보는 중");
    expect(within(neighbors).getAllByRole("listitem")).toHaveLength(3);
    expect(within(neighbors).getByRole("link", { name: "묶음 전체 보기" })).toHaveAttribute("href", "/table/folder/5.8");

    expect(screen.getByText("이 곡의 다른 채보 2개")).toBeInTheDocument();
  });

  it("서열표에서: EXC 기록의 달성률 숫자는 그라데이션 글자로 나온다", async () => {
    renderView("table", 10);
    const mine = await screen.findByRole("region", { name: "내 기록" });
    await waitFor(() => expect(within(mine).getByText("MAX")).toHaveClass("stage-grad-text"));
  });

  it("곡 목록에서: 버전 카드와 레벨 정보 표를 보여 주고 BPM·노트 수·속성은 보여 주지 않는다", async () => {
    renderView("songs", 10);
    const cards = await screen.findByRole("list", { name: "곡 정보 요약" });
    expect(within(cards).getByText("V5")).toBeInTheDocument();
    // BPM과 노트 수는 화면에서 뺐다
    expect(within(cards).queryByText("BPM")).toBeNull();
    expect(within(cards).queryByText("노트 수")).toBeNull();
    expect(screen.queryByText("120~180")).toBeNull();
    expect(screen.queryByText("1,234")).toBeNull();

    const table = screen.getByRole("region", { name: "레벨 정보" });
    const rows = await within(table).findAllByRole("link");
    expect(rows).toHaveLength(3);
    // Guitar EXT 7.20 -> Guitar MAS 9.80 -> Bass MAS 8.50 순서, 기준 난이도와 추천이 서열표에서 채워진다
    expect(rows[0]).toHaveTextContent("Guitar");
    await waitFor(() => expect(rows[0]).toHaveTextContent("5.1"));
    expect(rows[1]).toHaveTextContent("5.8");
    expect(rows[1]).toHaveAttribute("aria-current", "true");
    expect(rows[1]).toHaveAttribute("href", "/songs/1?from=songs&chart=10");
    expect(rows[2]).toHaveTextContent("–");

    expect(screen.queryByText(/속성/)).toBeNull();
    expect(screen.queryByRole("region", { name: "같은 난이도의 곡" })).toBeNull();
  });

  it("chart 값이 이 곡의 채보가 아니면 레벨이 가장 높은 채보를 고른다", async () => {
    renderView("songs", 99999);
    const table = await screen.findByRole("region", { name: "레벨 정보" });
    await waitFor(() => expect(within(table).getAllByRole("link")[1]).toHaveAttribute("aria-current", "true"));
  });

  it("일반 사용자에게는 서열표 값 수정 버튼이 없다", async () => {
    renderView("table", 10);
    await screen.findByRole("region", { name: "서열표 정보" });
    expect(screen.queryByRole("button", { name: "서열표 값 수정" })).toBeNull();
    expect(screen.queryByRole("button", { name: "서열표에 추가" })).toBeNull();
  });

  it("ROOT·ADMIN(canEditTable)이면 서열표 값 수정 창이 열리고 지금 값이 채워져 있다", async () => {
    renderView("table", 10, false, true);
    fireEvent.click(await screen.findByRole("button", { name: "서열표 값 수정" }));

    expect(screen.getByLabelText("레이팅 상수 난이도")).toHaveValue("5.8");
    expect(screen.getByLabelText("추천도")).toHaveValue("상");
    expect(screen.getByLabelText("속성")).toHaveValue("복합");
  });

  it("ROOT·ADMIN이면 곡 목록에서 들어온 곡 상세에서도 수정 버튼이 보인다", async () => {
    renderView("songs", 10, false, true);
    expect(await screen.findByRole("button", { name: "서열표 값 수정" })).toBeInTheDocument();
  });

  it("서열표를 받지 못하면(오류) 수정·추가 버튼을 숨긴다 (이미 있는 줄을 빈 값으로 덮어쓰지 않게)", async () => {
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return Promise.resolve(json(AUTH));
      if (url.includes("/entries")) return Promise.resolve(json({ code: "INTERNAL_ERROR", message: "x", timestamp: "t" }, 500));
      if (url.endsWith("/difficulty-tables")) return Promise.resolve(json(tables));
      if (url.includes("/songs/")) return Promise.resolve(json(song));
      return Promise.resolve(json({}, 404));
    });
    renderView("table", 10, false, true);
    expect(await screen.findByText("이 채보는 서열표에 없습니다.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /서열표/ })).toBeNull();
  });

  it("서열표에 없는 채보는 '서열표에 추가' 버튼이 보인다", async () => {
    // 13번 채보(Bass EXT)는 서열표 데이터에 없다
    songResponse = () =>
      json({
        ...song,
        difficulties: [
          ...song.difficulties,
          { id: 13, songId: 1, instrumentPart: "BASS", difficultyType: "EXTREME", level: 6.1, noteCount: null },
        ],
      });
    renderView("table", 13, false, true);
    expect(await screen.findByRole("button", { name: "서열표에 추가" })).toBeInTheDocument();
  });

  it("곡이 없으면(404) 안내 문구를 보여 준다", async () => {
    songResponse = () => json({ code: "NOT_FOUND", message: "찾을 수 없습니다.", timestamp: "t" }, 404);
    renderView("songs", null);
    expect(await screen.findByRole("alert")).toHaveTextContent("곡을 찾을 수 없습니다.");
  });

  it("서열표가 없어도 곡 정보와 기록 등록 버튼은 쓸 수 있다", async () => {
    tables = [];
    renderView("table", 10);
    expect(await screen.findByRole("heading", { name: "테스트곡" })).toBeInTheDocument();
    expect(await screen.findByText("이 채보는 서열표에 없습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "기록 등록" })).toBeEnabled();
    expect(screen.queryByText(/^속성/)).toBeNull();
  });

  it("곡 상세 안에서 다른 채보·곡으로 옮기는 링크는 기록을 쌓지 않고 바꿔치기(replace)한다", async () => {
    // 쌓으면 뒤로가기가 곡 목록이 아니라 직전에 본 곡으로 간다
    renderView("songs", 10);
    const table = await screen.findByRole("region", { name: "레벨 정보" });
    for (const link of within(table).getAllByRole("link")) {
      expect(link).toHaveAttribute("data-replace", "true");
    }
  });

  it("서열표에서: 같은 난이도의 곡과 다른 채보 링크도 바꿔치기(replace)한다", async () => {
    renderView("table", 10);
    const neighbors = await screen.findByRole("region", { name: "같은 난이도의 곡" });
    for (const link of within(neighbors).getAllByRole("link")) {
      // 맨 위의 `묶음 전체 보기`는 다른 화면으로 나가는 링크라 기록을 쌓는다
      if (link.getAttribute("href")?.startsWith("/table/folder")) {
        expect(link).toHaveAttribute("data-replace", "false");
      } else {
        expect(link).toHaveAttribute("data-replace", "true");
      }
    }
    fireEvent.click(screen.getByText("이 곡의 다른 채보 2개"));
    const others = screen.getByText("이 곡의 다른 채보 2개").closest("details");
    expect(others).not.toBeNull();
    for (const link of within(others as HTMLElement).getAllByRole("link")) {
      expect(link).toHaveAttribute("data-replace", "true");
    }
  });

  it("뒤로 버튼은 이전 화면으로 돌아간다", async () => {
    renderView("songs", 10);
    fireEvent.click(await screen.findByRole("button", { name: "뒤로" }));
    expect(back).toHaveBeenCalled();
  });

  it("기록 등록 버튼을 누르면 이 채보의 기록 창이 열린다", async () => {
    renderView("songs", 10, true);
    fireEvent.click(await screen.findByRole("button", { name: "기록 등록" }));
    expect(await screen.findByRole("heading", { name: "기록 등록", level: 2 })).toBeInTheDocument();
    expect(screen.getByLabelText("달성률")).toBeInTheDocument();
  });
});
