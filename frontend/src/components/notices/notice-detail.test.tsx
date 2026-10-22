import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NoticeDetailView } from "@/components/notices/NoticeDetailView";
import type { NoticeResponse } from "@/lib/api-types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }) }));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function notice(id: number, title: string, content: string): NoticeResponse {
  return { id, title, content, createdAt: "2026-10-08T15:30:00Z", updatedAt: "2026-10-08T15:30:00Z" };
}

function renderView(canWrite: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NoticeDetailView viewerId={1} noticeId={1} canWrite={canWrite} />
    </QueryClientProvider>,
  );
}

describe("NoticeDetailView", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    push.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("제목·날짜(서울 시간)·본문을 보여 주고 목록으로 가는 링크가 있다. 일반 사용자에게는 수정·삭제가 없다", async () => {
    fetchMock.mockResolvedValue(json(notice(1, "제목", "줄1\n줄2")));
    renderView(false);

    expect(await screen.findByRole("heading", { name: "제목" })).toBeInTheDocument();
    expect(screen.getByText(/줄1/)).toBeInTheDocument();
    expect(screen.getByText("2026-10-09")).toBeInTheDocument(); // UTC 15:30은 서울에서 다음 날 00:30
    expect(screen.getByRole("link", { name: "← 목록으로" })).toHaveAttribute("href", "/notices");
    expect(screen.queryByRole("button", { name: /수정|삭제/ })).not.toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toContain("/notices/1");
  });

  it("HTML은 해석하지 않고 글자 그대로 보여 준다", async () => {
    fetchMock.mockResolvedValue(json(notice(1, "제목", "<b>굵게</b><script>alert(1)</script>")));
    const { container } = renderView(false);

    expect(await screen.findByText("<b>굵게</b><script>alert(1)</script>")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
  });

  it("없는 공지(404)는 찾을 수 없다고 알린다", async () => {
    fetchMock.mockResolvedValue(json({ code: "NOT_FOUND", message: "찾을 수 없습니다.", timestamp: "t" }, 404));
    renderView(false);
    expect(await screen.findByRole("alert")).toHaveTextContent("공지사항을 찾을 수 없습니다.");
  });

  it("관리자가 고치면 PUT으로 보내고 상세로 돌아온다", async () => {
    fetchMock.mockImplementation((_input, init) =>
      Promise.resolve(init?.method === "PUT" ? json(notice(1, "고친 제목", "내용")) : json(notice(1, "원래 제목", "내용"))),
    );
    renderView(true);
    fireEvent.click(await screen.findByRole("button", { name: "원래 제목 수정" }));
    const form = screen.getByRole("form", { name: "공지 수정" });
    expect(within(form).getByLabelText("제목")).toHaveValue("원래 제목");
    fireEvent.change(within(form).getByLabelText("제목"), { target: { value: "고친 제목" } });
    fireEvent.click(within(form).getByRole("button", { name: "저장" }));

    await waitFor(() => expect(fetchMock.mock.calls.some((c) => c[1]?.method === "PUT")).toBe(true));
    const put = fetchMock.mock.calls.find((c) => c[1]?.method === "PUT");
    expect(String(put?.[0])).toContain("/admin/notices/1");
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ title: "고친 제목", content: "내용" });
    await waitFor(() => expect(screen.queryByRole("form", { name: "공지 수정" })).not.toBeInTheDocument());
  });

  it("삭제는 확인을 거치고, 취소하면 요청하지 않으며, 삭제하면 목록으로 간다", async () => {
    fetchMock.mockImplementation((_input, init) =>
      Promise.resolve(init?.method === "DELETE" ? new Response(null, { status: 204 }) : json(notice(1, "지울 공지", "내용"))),
    );
    renderView(true);
    fireEvent.click(await screen.findByRole("button", { name: "지울 공지 삭제" }));
    const dialog = screen.getByRole("alertdialog", { name: "공지 삭제 확인" });
    fireEvent.click(within(dialog).getByRole("button", { name: "취소" }));
    expect(fetchMock.mock.calls.some((c) => c[1]?.method === "DELETE")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "지울 공지 삭제" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => c[1]?.method === "DELETE")).toBe(true));
    const del = fetchMock.mock.calls.find((c) => c[1]?.method === "DELETE");
    expect(String(del?.[0])).toContain("/admin/notices/1");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/notices"));
  });
});
