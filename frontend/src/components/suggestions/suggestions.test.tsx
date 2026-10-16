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
    expect(JSON.parse(String(calls("POST")[0].init?.body))).toEqual({ category: "BUG", title: "화면이 깨져요", content: "자세한 내용" });
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
