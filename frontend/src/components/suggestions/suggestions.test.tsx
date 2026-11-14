import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SuggestionsAdminView } from "@/components/admin/SuggestionsAdminView";
import { SongRequestLink } from "@/components/songs/SongRequestLink";
import { SuggestionsView } from "@/components/suggestions/SuggestionsView";
import type { AdminSuggestionResponse, SuggestionResponse } from "@/lib/api-types";
import { DESKTOP_QUERY } from "@/lib/use-media-query";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function item(id: number, over: Partial<AdminSuggestionResponse> = {}): AdminSuggestionResponse {
  return {
    id,
    category: "SONG_REQUEST",
    title: `건의 ${id}`,
    content: "줄1\n줄2",
    requestedPart: null,
    requestedDifficulty: null,
    status: "RECEIVED",
    adminNote: null,
    authorNickname: "tester",
    // 서버는 작성 시각 최신순이다: id가 작을수록 최신이 되게 날짜를 거꾸로 준다(건의 1이 가장 최신)
    createdAt: `2026-10-${String(20 - id).padStart(2, "0")}T01:00:00Z`,
    updatedAt: `2026-10-${String(20 - id).padStart(2, "0")}T01:00:00Z`,
    ...over,
  };
}

function pageOf<T>(content: T[]) {
  return { content, page: 0, size: 10, totalElements: content.length, totalPages: 1 };
}

function wrap(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe("SuggestionsView", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const calls = (method: string) =>
    fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") === method).map(([input, init]) => ({ url: String(input), init }));
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("내 건의를 종류·처리 상태·관리자 답변과 함께 글자로 보여 준다", async () => {
    const mine: SuggestionResponse = { ...item(1, { status: "DONE", adminNote: "등록했습니다." }) };
    fetchMock.mockResolvedValue(json(pageOf([mine])));
    wrap(<SuggestionsView viewerId={1} />);

    const list = await screen.findByRole("list", { name: "내 건의 목록" });
    expect(list).toHaveTextContent("건의 1");
    expect(list).toHaveTextContent("곡 추가");
    expect(list).toHaveTextContent("처리 완료");
    expect(list).toHaveTextContent("관리자 답변등록했습니다.");
  });

  it("주소에서 받은 종류와 제목이 폼에 미리 채워진다", async () => {
    fetchMock.mockResolvedValue(json(pageOf([])));
    wrap(<SuggestionsView viewerId={1} initialCategory="SONG_REQUEST" initialTitle="Prog for yuor soul" />);

    expect(await screen.findByLabelText("제목")).toHaveValue("Prog for yuor soul");
    expect(screen.getByLabelText("종류")).toHaveValue("SONG_REQUEST");
    expect(await screen.findByText("보낸 건의가 없습니다.")).toBeInTheDocument();
  });

  it("가져오기에서 넘어온 파트·난이도를 보여 주고 곡 추가 건의와 함께 보낸다", async () => {
    fetchMock.mockImplementation((_input, init) =>
      Promise.resolve(init?.method === "POST" ? json(item(2), 201) : json(pageOf([]))),
    );
    wrap(
      <SuggestionsView
        viewerId={1}
        initialCategory="SONG_REQUEST"
        initialTitle="새 곡"
        initialChart={{ part: "BASS", difficulty: "MASTER" }}
      />,
    );
    expect(await screen.findByText("Bass | MAS")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("내용"), { target: { value: "추가해 주세요" } });
    fireEvent.click(screen.getByRole("button", { name: "건의 보내기" }));

    await waitFor(() => expect(calls("POST")).toHaveLength(1));
    expect(JSON.parse(String(calls("POST")[0].init?.body))).toEqual({
      category: "SONG_REQUEST",
      title: "새 곡",
      content: "추가해 주세요",
      requestedPart: "BASS",
      requestedDifficulty: "MASTER",
    });
  });

  it("종류를 곡 추가가 아닌 것으로 바꾸면 파트·난이도는 보내지 않는다", async () => {
    fetchMock.mockImplementation((_input, init) =>
      Promise.resolve(init?.method === "POST" ? json(item(2), 201) : json(pageOf([]))),
    );
    wrap(
      <SuggestionsView
        viewerId={1}
        initialCategory="SONG_REQUEST"
        initialTitle="새 곡"
        initialChart={{ part: "GUITAR", difficulty: "EXTREME" }}
      />,
    );
    await screen.findByText("Guitar | EXT");

    fireEvent.change(screen.getByLabelText("종류"), { target: { value: "BUG" } });
    expect(screen.queryByText("Guitar | EXT")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("내용"), { target: { value: "내용" } });
    fireEvent.click(screen.getByRole("button", { name: "건의 보내기" }));

    await waitFor(() => expect(calls("POST")).toHaveLength(1));
    const body = JSON.parse(String(calls("POST")[0].init?.body));
    expect(body.requestedPart).toBeNull();
    expect(body.requestedDifficulty).toBeNull();
  });

  it("내 목록에 요청한 파트·난이도를 같이 보여 준다", async () => {
    fetchMock.mockResolvedValue(json(pageOf([item(1, { requestedPart: "GUITAR", requestedDifficulty: "MASTER" })])));
    wrap(<SuggestionsView viewerId={1} />);

    expect(await screen.findByRole("list", { name: "내 건의 목록" })).toHaveTextContent("Guitar | MAS");
  });

  it("비어 있으면 서버에 보내지 않고 안내 문구를 보여 준다", async () => {
    fetchMock.mockResolvedValue(json(pageOf([])));
    wrap(<SuggestionsView viewerId={1} />);
    await screen.findByText("보낸 건의가 없습니다.");

    fireEvent.click(screen.getByRole("button", { name: "건의 보내기" }));

    expect(await screen.findByText("제목을 입력해 주세요.")).toBeInTheDocument();
    expect(screen.getByText("내용을 입력해 주세요.")).toBeInTheDocument();
    expect(calls("POST")).toHaveLength(0);
  });

  it("보내면 종류·제목·내용을 POST하고 입력을 비운다", async () => {
    fetchMock.mockImplementation((_input, init) =>
      Promise.resolve(init?.method === "POST" ? json(item(2), 201) : json(pageOf([]))),
    );
    wrap(<SuggestionsView viewerId={1} />);
    await screen.findByText("보낸 건의가 없습니다.");

    fireEvent.change(screen.getByLabelText("종류"), { target: { value: "BUG" } });
    fireEvent.change(screen.getByLabelText("제목"), { target: { value: " 화면이 깨져요 " } });
    fireEvent.change(screen.getByLabelText("내용"), { target: { value: "자세한 내용" } });
    fireEvent.click(screen.getByRole("button", { name: "건의 보내기" }));

    await waitFor(() => expect(calls("POST")).toHaveLength(1));
    expect(JSON.parse(String(calls("POST")[0].init?.body))).toEqual({
      category: "BUG",
      title: "화면이 깨져요",
      content: "자세한 내용",
      requestedPart: null,
      requestedDifficulty: null,
    });
    await waitFor(() => expect(screen.getByLabelText("제목")).toHaveValue(""));
  });

  it("서버가 거절하면(하루 제한) 문구를 보여 주고 입력은 지우지 않는다", async () => {
    fetchMock.mockImplementation((_input, init) =>
      Promise.resolve(
        init?.method === "POST"
          ? json({ code: "SUGGESTION_LIMIT", message: "오늘은 건의를 더 보낼 수 없습니다. 내일 다시 보내 주세요." }, 429)
          : json(pageOf([])),
      ),
    );
    wrap(<SuggestionsView viewerId={1} />);
    await screen.findByText("보낸 건의가 없습니다.");

    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "제목" } });
    fireEvent.change(screen.getByLabelText("내용"), { target: { value: "내용" } });
    fireEvent.click(screen.getByRole("button", { name: "건의 보내기" }));

    expect(await screen.findByText(/오늘은 건의를 더 보낼 수 없습니다/)).toBeInTheDocument();
    expect(screen.getByLabelText("제목")).toHaveValue("제목");
  });
});

describe("SuggestionsAdminView", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  /** 칩의 개수는 목록 API를 상태별로 한 건씩(size=1) 요청해 더한다. */
  const isChipCount = (url: string) => /[?&]size=1(&|$)/.test(url);

  /**
   * 서버를 흉내 낸 건의 5건(최신순 1→5): 1·2 접수(RECEIVED), 3 확인 중(REVIEWING), 4 처리 완료(DONE), 5 반려(REJECTED).
   * 칩 묶음: 접수 = 1·2·3(3건), 처리 완료 = 4·5(2건), 전체 = 5건.
   */
  const DATASET = [
    item(1),
    item(2, { category: "BUG", authorNickname: "other" }),
    item(3, { category: "IMPROVEMENT", status: "REVIEWING" }),
    item(4, { category: "OTHER", status: "DONE", adminNote: "반영했습니다." }),
    item(5, { category: "OTHER", status: "REJECTED" }),
  ];

  /** 목록 요청의 status·category·page·size를 보고 DATASET에서 골라 돌려준다(서버의 페이지네이션과 같은 모양). */
  function listResponse(url: string) {
    const params = new URL(url, "http://localhost").searchParams;
    const status = params.get("status");
    const category = params.get("category");
    const size = Number(params.get("size") ?? 10);
    const page = Number(params.get("page") ?? 0);
    const rows = DATASET.filter((row) => (!status || row.status === status) && (!category || row.category === category));
    return {
      content: rows.slice(page * size, page * size + size),
      page,
      size,
      totalElements: rows.length,
      totalPages: Math.ceil(rows.length / size),
    };
  }

  function routes(patched?: AdminSuggestionResponse) {
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes("/received-count")) return Promise.resolve(json({ received: 2 }));
      if (init?.method === "PATCH") return Promise.resolve(json(patched ?? item(1)));
      if (url.endsWith("/difficulty-tables")) return Promise.resolve(json([]));
      return Promise.resolve(json(listResponse(url)));
    });
  }

  /** 건의 관리 목록 요청만(칩의 개수 요청 size=1은 뺀다). */
  const listCalls = () =>
    fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/admin/suggestions?") && !isChipCount(u));

  /** 압축 카드의 머리 버튼(제목이 들어 있다). 폰에서는 aria-expanded, 데스크톱에서는 aria-current를 가진다. */
  const cardHead = (title: string) =>
    screen.getAllByRole("button").find((b) => (b.hasAttribute("aria-expanded") || b.hasAttribute("aria-current")) && (b.textContent ?? "").startsWith(title)) as HTMLElement;

  function stubDesktop() {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === DESKTOP_QUERY,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  }

  it("건의를 닉네임과 함께 보여 주고 접수 대기 건수를 보여 준다", async () => {
    routes();
    wrap(<SuggestionsAdminView viewerId={9} />);

    const list = await screen.findByRole("list", { name: "건의 목록" });
    expect(list).toHaveTextContent("건의 1");
    expect(list).toHaveTextContent("보낸 사람 tester");
    expect(list).toHaveTextContent("보낸 사람 other");
    expect(await screen.findByText(/접수 대기/)).toHaveTextContent("2건"); // 배지 숫자는 RECEIVED만 센다
    // 다른 관리 화면과 같은 뒤로 버튼
    expect(screen.getByRole("link", { name: "관리로" })).toHaveAttribute("href", "/admin");
  });

  it("처음에는 접수 대기가 있으면 `접수` 칩만, 없으면 `전체`를 보여 주고, 직접 고르면 그 값을 쓴다", async () => {
    routes();
    const { unmount } = wrap(<SuggestionsAdminView viewerId={9} />);
    await screen.findByRole("list", { name: "건의 목록" });
    // 접수 칩 = RECEIVED + REVIEWING 두 상태를 각각 끝 쪽까지(쪽 크기 50) 받는다. 건수를 받은 뒤에 시작한다.
    expect(listCalls().sort()).toEqual([
      expect.stringContaining("status=RECEIVED"),
      expect.stringContaining("status=REVIEWING"),
    ]);
    expect(listCalls().every((u) => u.includes("size=50"))).toBe(true);
    const group = screen.getByRole("group", { name: "상태" });
    expect(within(group).getByRole("button", { name: /^접수\s*3$/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(group).getByRole("button", { name: /^전체\s*5$/ })).toHaveAttribute("aria-pressed", "false");
    const before = listCalls().length;
    fireEvent.click(within(group).getByRole("button", { name: /^전체/ }));
    await waitFor(() => expect(listCalls().slice(before).some((u) => !u.includes("status="))).toBe(true));
    expect(within(group).getByRole("button", { name: /^전체/ })).toHaveAttribute("aria-pressed", "true");
    unmount();

    fetchMock.mockReset();
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/received-count")) return Promise.resolve(json({ received: 0 }));
      return Promise.resolve(json(listResponse(url)));
    });
    wrap(<SuggestionsAdminView viewerId={9} />);
    await screen.findByRole("list", { name: "건의 목록" });
    expect(listCalls()[0]).not.toContain("status=");
    expect(within(screen.getByRole("group", { name: "상태" })).getByRole("button", { name: /^전체/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("상태 칩 개수는 묶인 상태의 합이다: 접수 = 접수 + 확인 중, 처리 완료 = 처리 완료 + 반려", async () => {
    routes();
    wrap(<SuggestionsAdminView viewerId={9} />);
    await screen.findByRole("list", { name: "건의 목록" });
    const group = screen.getByRole("group", { name: "상태" });
    await waitFor(() => {
      const names = within(group).getAllByRole("button").map((b) => b.textContent);
      // DATASET: RECEIVED 2 + REVIEWING 1 = 3 / DONE 1 + REJECTED 1 = 2 / 전체 5
      expect(names).toEqual(["접수3", "처리 완료2", "전체5"]);
    });
    // 칩의 개수 요청은 상태별로 한 건씩이다(묶음의 합을 서버가 내주지 않는다)
    const chipUrls = fetchMock.mock.calls.map((c) => String(c[0])).filter(isChipCount);
    for (const status of ["RECEIVED", "REVIEWING", "DONE", "REJECTED"]) {
      expect(chipUrls.some((u) => u.includes(`status=${status}`))).toBe(true);
    }
  });

  it("`접수` 칩에는 접수와 확인 중이, `처리 완료` 칩에는 처리 완료와 반려가 모이고, 카드 태그는 실제 상태 이름이다", async () => {
    routes();
    wrap(<SuggestionsAdminView viewerId={9} />);
    const list = await screen.findByRole("list", { name: "건의 목록" });
    // 접수 칩: 건의 1·2(접수) + 건의 3(확인 중), 최신순
    expect(within(list).getAllByRole("listitem").map((li) => li.querySelector("button span span")?.textContent)).toEqual(["건의 1", "건의 2", "건의 3"]);
    expect(within(list).getAllByText("접수")).toHaveLength(2);
    expect(within(list).getByText("확인 중")).toBeInTheDocument();
    expect(within(list).queryByText("처리 완료")).toBeNull();

    const group = screen.getByRole("group", { name: "상태" });
    const before = listCalls().length;
    fireEvent.click(within(group).getByRole("button", { name: /^처리 완료/ }));
    await waitFor(() => expect(within(screen.getByRole("list", { name: "건의 목록" })).getByText("건의 4")).toBeInTheDocument());
    const closedCalls = listCalls().slice(before);
    expect(closedCalls.some((u) => u.includes("status=DONE"))).toBe(true);
    expect(closedCalls.some((u) => u.includes("status=REJECTED"))).toBe(true);
    const closed = screen.getByRole("list", { name: "건의 목록" });
    expect(within(closed).getAllByRole("listitem")).toHaveLength(2);
    expect(within(closed).getByText("처리 완료")).toBeInTheDocument(); // 건의 4(DONE)의 태그
    expect(within(closed).getByText("반려")).toBeInTheDocument(); // 건의 5(REJECTED)의 태그
    expect(within(group).getByRole("button", { name: /^처리 완료/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(group).getByRole("button", { name: /^접수/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("압축 카드는 제목·종류·상태·보낸 사람·한 줄 미리보기만 보이고, 누르면 펼쳐 상태·답변·저장이 나온다", async () => {
    routes();
    wrap(<SuggestionsAdminView viewerId={9} />);
    await screen.findByRole("list", { name: "건의 목록" });
    expect(screen.getByRole("list", { name: "건의 목록" })).toHaveTextContent("줄1 줄2"); // 줄바꿈은 한 줄 미리보기로
    expect(screen.queryByLabelText("건의 1 상태")).toBeNull();
    expect(cardHead("건의 1")).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(cardHead("건의 1"));
    expect(cardHead("건의 1")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("건의 1 상태")).toBeInTheDocument();
    expect(screen.getByLabelText("건의 1 답변")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "건의 1 처리 저장" })).toBeInTheDocument();
  });

  it("한 번에 하나만 펼쳐지고, 다시 누르면 접힌다", async () => {
    routes();
    wrap(<SuggestionsAdminView viewerId={9} />);
    await screen.findByRole("list", { name: "건의 목록" });

    fireEvent.click(cardHead("건의 1"));
    fireEvent.click(cardHead("건의 2"));
    expect(cardHead("건의 2")).toHaveAttribute("aria-expanded", "true");
    expect(cardHead("건의 1")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("건의 1 상태")).toBeNull();
    expect(screen.getByLabelText("건의 2 상태")).toBeInTheDocument();

    fireEvent.click(cardHead("건의 2"));
    expect(cardHead("건의 2")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("건의 2 상태")).toBeNull();
  });

  it("데스크톱(1024px 이상)에서는 왼쪽 목록 + 오른쪽 상세이고, 펼침 대신 선택한다(처음에는 첫 건)", async () => {
    stubDesktop();
    routes();
    wrap(<SuggestionsAdminView viewerId={9} />);
    await screen.findByRole("list", { name: "건의 목록" });

    // 고르기 전에도 오른쪽 칸이 비지 않게 첫 건이 선택돼 있다
    expect(cardHead("건의 1")).toHaveAttribute("aria-current", "true");
    expect(cardHead("건의 2")).toHaveAttribute("aria-current", "false");
    expect(screen.getByRole("region", { name: "건의 1" })).toBeInTheDocument();
    expect(screen.getByLabelText("건의 1 상태")).toBeInTheDocument();
    // 목록 안에서 펼치지 않는다(입력칸이 한 번만 있다)
    expect(screen.getAllByLabelText("건의 1 상태")).toHaveLength(1);

    fireEvent.click(cardHead("건의 2"));
    expect(cardHead("건의 2")).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("region", { name: "건의 2" })).toBeInTheDocument();
    expect(screen.queryByLabelText("건의 1 상태")).toBeNull();
    expect(screen.getByLabelText("건의 2 상태")).toBeInTheDocument();
  });

  it("곡 추가 건의에서 곡 등록 창을 곡명과 요청 채보로 채워 연다", async () => {
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/received-count")) return Promise.resolve(json({ received: 1 }));
      if (url.endsWith("/difficulty-tables")) return Promise.resolve(json([]));
      // 접수 칩은 접수·확인 중 두 상태를 따로 받는다. 접수 건만 있고 확인 중에는 없는 경우다
      const status = new URL(url, "http://localhost").searchParams.get("status");
      const rows = status === "REVIEWING" ? [] : [item(1, { title: "새 곡", requestedPart: "BASS", requestedDifficulty: "EXTREME" })];
      return Promise.resolve(json(pageOf(rows)));
    });
    wrap(<SuggestionsAdminView viewerId={9} />);
    const list = await screen.findByRole("list", { name: "건의 목록" });
    expect(list).toHaveTextContent("Bass | EXT");

    fireEvent.click(cardHead("새 곡")); // 카드를 펼쳐야 곡 등록 버튼이 보인다
    fireEvent.click(screen.getByRole("button", { name: "새 곡 건의로 곡 등록" }));

    expect(await screen.findByLabelText("곡명")).toHaveValue("새 곡");
    expect(screen.getByLabelText("채보 1 파트")).toHaveValue("BASS");
    expect(screen.getByLabelText("채보 1 난이도")).toHaveValue("EXTREME");
    // 자동 등록이 아니다: 창만 열었을 뿐 곡을 만드는 요청은 없다
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("곡 추가가 아닌 건의에는 곡 등록 버튼이 없다", async () => {
    routes();
    wrap(<SuggestionsAdminView viewerId={9} />);
    await screen.findByRole("list", { name: "건의 목록" });

    fireEvent.click(cardHead("건의 1"));
    expect(screen.getByRole("button", { name: "건의 1 건의로 곡 등록" })).toBeInTheDocument();
    fireEvent.click(cardHead("건의 2")); // 버그 건의라 곡 등록 버튼이 없다
    expect(screen.queryByRole("button", { name: "건의 2 건의로 곡 등록" })).not.toBeInTheDocument();
  });

  it("종류를 고르면 category 파라미터를 붙여 다시 요청한다", async () => {
    routes();
    wrap(<SuggestionsAdminView viewerId={9} />);
    await screen.findByRole("list", { name: "건의 목록" });

    fireEvent.change(screen.getByLabelText("종류"), { target: { value: "BUG" } });

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/admin/suggestions") && String(input).includes("category=BUG"))).toBe(true),
    );
  });

  it("상태와 답변을 바꿔 저장하면 PATCH로 보낸다", async () => {
    routes(item(1, { status: "DONE", adminNote: "등록했습니다." }));
    wrap(<SuggestionsAdminView viewerId={9} />);
    await screen.findByRole("list", { name: "건의 목록" });

    fireEvent.click(cardHead("건의 1"));
    fireEvent.change(screen.getByLabelText("건의 1 상태"), { target: { value: "DONE" } });
    fireEvent.change(screen.getByLabelText("건의 1 답변"), { target: { value: "등록했습니다." } });
    fireEvent.click(screen.getByRole("button", { name: "건의 1 처리 저장" }));

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
      expect(patch).toBeDefined();
      expect(String(patch?.[0])).toContain("/admin/suggestions/1");
      expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ status: "DONE", adminNote: "등록했습니다." });
    });
  });
});

describe("SongRequestLink", () => {
  it("곡 추가 종류와 검색어를 담은 건의하기 주소로 연결한다", () => {
    render(<SongRequestLink query="  Prog for yuor soul " />);
    const href = screen.getByRole("link", { name: "곡 추가 건의하기" }).getAttribute("href") ?? "";
    const url = new URL(href, "http://x");
    expect(url.pathname).toBe("/suggestions");
    expect(url.searchParams.get("category")).toBe("SONG_REQUEST");
    expect(url.searchParams.get("title")).toBe("Prog for yuor soul");
  });
});
