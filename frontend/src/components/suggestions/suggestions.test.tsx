import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SuggestionsAdminView } from "@/components/admin/SuggestionsAdminView";
import { SongRequestLink } from "@/components/songs/SongRequestLink";
import { SuggestionsView } from "@/components/suggestions/SuggestionsView";
import type { AdminSuggestionResponse, SuggestionResponse } from "@/lib/api-types";

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
    createdAt: "2026-10-16T01:00:00Z",
    updatedAt: "2026-10-16T01:00:00Z",
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

  function routes(patched?: AdminSuggestionResponse) {
    fetchMock.mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes("/received-count")) return Promise.resolve(json({ received: 3 }));
      if (init?.method === "PATCH") return Promise.resolve(json(patched ?? item(1)));
      if (url.endsWith("/difficulty-tables")) return Promise.resolve(json([]));
      return Promise.resolve(json(pageOf([item(1), item(2, { category: "BUG", authorNickname: "other" })])));
    });
  }

  it("건의를 닉네임과 함께 보여 주고 접수 대기 건수를 보여 준다", async () => {
    routes();
    wrap(<SuggestionsAdminView viewerId={9} />);

    const list = await screen.findByRole("list", { name: "건의 목록" });
    expect(list).toHaveTextContent("건의 1");
    expect(list).toHaveTextContent("보낸 사람 tester");
    expect(list).toHaveTextContent("보낸 사람 other");
    expect(await screen.findByText(/접수 대기/)).toHaveTextContent("3건");
  });

  it("처음에는 접수 대기가 있으면 `접수 대기`만, 없으면 `전체`를 보여 주고, 직접 고르면 그 값을 쓴다", async () => {
    routes();
    const { unmount } = wrap(<SuggestionsAdminView viewerId={9} />);
    await screen.findByRole("list", { name: "건의 목록" });
    const listCalls = () => fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("/admin/suggestions?"));
    expect(listCalls()).toHaveLength(1); // 건수를 받은 뒤 한 번만 요청한다
    expect(listCalls()[0]).toContain("status=RECEIVED");
    expect(screen.getAllByLabelText("상태", { exact: true })[0]).toHaveValue("RECEIVED");
    fireEvent.change(screen.getAllByLabelText("상태", { exact: true })[0], { target: { value: "" } });
    await waitFor(() => expect(listCalls().some((u) => !u.includes("status="))).toBe(true));
    unmount();

    fetchMock.mockReset();
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/received-count")) return Promise.resolve(json({ received: 0 }));
      return Promise.resolve(json(pageOf([item(1)])));
    });
    wrap(<SuggestionsAdminView viewerId={9} />);
    await screen.findByRole("list", { name: "건의 목록" });
    expect(listCalls()[0]).not.toContain("status=");
  });

  it("곡 추가 건의에서 곡 등록 창을 곡명과 요청 채보로 채워 연다", async () => {
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/received-count")) return Promise.resolve(json({ received: 1 }));
      if (url.endsWith("/difficulty-tables")) return Promise.resolve(json([]));
      return Promise.resolve(
        json(pageOf([item(1, { title: "새 곡", requestedPart: "BASS", requestedDifficulty: "EXTREME" })])),
      );
    });
    wrap(<SuggestionsAdminView viewerId={9} />);
    const list = await screen.findByRole("list", { name: "건의 목록" });
    expect(list).toHaveTextContent("Bass | EXT");

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

    expect(screen.getByRole("button", { name: "건의 1 건의로 곡 등록" })).toBeInTheDocument();
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
