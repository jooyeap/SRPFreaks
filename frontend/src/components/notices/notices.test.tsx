import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NoticesView } from "@/components/notices/NoticesView";
import type { NoticeResponse, PageResponse } from "@/lib/api-types";
import { koT } from "@/i18n/ko-translator";
import { makeNoticeSchema } from "@/lib/notices";

const noticeSchema = makeNoticeSchema(koT);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function notice(id: number, title: string, content: string): NoticeResponse {
  return { id, title, content, createdAt: "2026-10-08T15:30:00Z", updatedAt: "2026-10-08T15:30:00Z" };
}
function pageOf(content: NoticeResponse[], over: Partial<PageResponse<NoticeResponse>> = {}): PageResponse<NoticeResponse> {
  return { content, page: 0, size: 10, totalElements: content.length, totalPages: 1, ...over };
}

function renderView(canWrite: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NoticesView viewerId={1} canWrite={canWrite} />
    </QueryClientProvider>,
  );
}

describe("noticeSchema", () => {
  it("앞뒤 공백을 자르고 비어 있거나 너무 길면 거부한다", () => {
    expect(noticeSchema.safeParse({ title: " 안내 ", content: " 내용 " })).toMatchObject({
      success: true,
      data: { title: "안내", content: "내용" },
    });
    expect(noticeSchema.safeParse({ title: "   ", content: "내용" }).success).toBe(false);
    expect(noticeSchema.safeParse({ title: "제목", content: "" }).success).toBe(false);
    expect(noticeSchema.safeParse({ title: "가".repeat(101), content: "내용" }).success).toBe(false);
    expect(noticeSchema.safeParse({ title: "가".repeat(100), content: "가".repeat(5000) }).success).toBe(true);
    expect(noticeSchema.safeParse({ title: "제목", content: "가".repeat(5001) }).success).toBe(false);
  });
});

describe("NoticesView", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("공지를 제목·날짜(서울 시간)·내용으로 보여 주고, 일반 사용자에게는 쓰기 화면이 없다", async () => {
    fetchMock.mockResolvedValue(json(pageOf([notice(2, "두 번째", "줄1\n줄2"), notice(1, "첫 번째", "내용")])));
    renderView(false);

    const list = await screen.findByRole("list", { name: "공지사항 목록" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("두 번째");
    expect(items[0]).toHaveTextContent("2026-10-09"); // UTC 15:30은 서울에서 다음 날 00:30
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    // 목록에는 본문이 없고 상세 페이지 링크만 있다
    expect(screen.queryByText(/줄1/)).not.toBeInTheDocument();
    expect(within(items[0]).getByRole("link")).toHaveAttribute("href", "/notices/2");
    expect(screen.queryByRole("button", { name: /고치기|삭제/ })).not.toBeInTheDocument();
  });

  it("공지가 없으면 안내 문구를 보여 준다", async () => {
    fetchMock.mockResolvedValue(json(pageOf([], { totalElements: 0, totalPages: 0 })));
    renderView(false);
    expect(await screen.findByText("등록된 공지사항이 없습니다.")).toBeInTheDocument();
  });

  it("서버 오류는 서버가 준 문구로 알려 준다", async () => {
    fetchMock.mockResolvedValue(json({ code: "INTERNAL_ERROR", message: "서버에 문제가 생겼습니다.", timestamp: "t" }, 500));
    renderView(false);
    expect(await screen.findByRole("alert")).toHaveTextContent("서버에 문제가 생겼습니다.");
  });

  it("관리자가 공지를 쓰면 POST로 보내고 목록을 다시 받는다", async () => {
    fetchMock.mockImplementation((_input, init) =>
      Promise.resolve(init?.method === "POST" ? json(notice(5, "새 공지", "새 내용"), 201) : json(pageOf([]))),
    );
    renderView(true);
    const form = await screen.findByRole("form", { name: "공지 쓰기" });
    fireEvent.change(within(form).getByLabelText("제목"), { target: { value: " 새 공지 " } });
    fireEvent.change(within(form).getByLabelText("내용"), { target: { value: "새 내용" } });
    fireEvent.click(within(form).getByRole("button", { name: "공지 등록" }));

    await waitFor(() => expect(fetchMock.mock.calls.some((c) => c[1]?.method === "POST")).toBe(true));
    const post = fetchMock.mock.calls.find((c) => c[1]?.method === "POST");
    expect(String(post?.[0])).toContain("/admin/notices");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ title: "새 공지", content: "새 내용" });
    await waitFor(() => expect(within(form).getByLabelText("제목")).toHaveValue("")); // 등록하면 폼을 비운다
    const gets = fetchMock.mock.calls.filter((c) => (c[1]?.method ?? "GET") === "GET");
    expect(gets.length).toBeGreaterThanOrEqual(2);
  });

  it("제목이 비어 있으면 요청을 보내지 않고 안내한다", async () => {
    fetchMock.mockResolvedValue(json(pageOf([])));
    renderView(true);
    const form = await screen.findByRole("form", { name: "공지 쓰기" });
    fireEvent.change(within(form).getByLabelText("내용"), { target: { value: "내용" } });
    fireEvent.click(within(form).getByRole("button", { name: "공지 등록" }));

    expect(await within(form).findByText("제목을 입력해 주세요.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((c) => c[1]?.method === "POST")).toBe(false);
  });

  it("서버가 거절하면 그 문구를 보여 주고 입력한 내용은 지우지 않는다", async () => {
    fetchMock.mockImplementation((_input, init) =>
      Promise.resolve(
        init?.method === "POST"
          ? json({ code: "FORBIDDEN", message: "권한이 없습니다.", timestamp: "t" }, 403)
          : json(pageOf([])),
      ),
    );
    renderView(true);
    const form = await screen.findByRole("form", { name: "공지 쓰기" });
    fireEvent.change(within(form).getByLabelText("제목"), { target: { value: "제목" } });
    fireEvent.change(within(form).getByLabelText("내용"), { target: { value: "내용" } });
    fireEvent.click(within(form).getByRole("button", { name: "공지 등록" }));

    expect(await within(form).findByText("권한이 없습니다.")).toBeInTheDocument();
    expect(within(form).getByLabelText("제목")).toHaveValue("제목");
  });

  it("페이지를 넘기면 다음 페이지를 요청한다", async () => {
    fetchMock.mockImplementation((input) => {
      const page = Number(new URL(String(input), "http://x").searchParams.get("page"));
      return Promise.resolve(json(pageOf([notice(page + 1, `공지${page}`, "내용")], { page, totalPages: 2 })));
    });
    renderView(false);
    await screen.findByText("1 / 2");
    expect(screen.getByRole("button", { name: "이전" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    await waitFor(() => expect(screen.getByText("2 / 2")).toBeInTheDocument());
  });
});
