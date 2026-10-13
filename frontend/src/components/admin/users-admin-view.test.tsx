import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UsersAdminView } from "@/components/admin/UsersAdminView";
import type { AdminUserResponse, PageResponse } from "@/lib/api-types";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function user(id: number, over: Partial<AdminUserResponse> = {}): AdminUserResponse {
  return { id, email: `u${id}@example.com`, nickname: `ユーザー${id}`, role: "USER", status: "ACTIVE", createdAt: "2026-10-01T00:00:00Z", ...over };
}

function page(content: AdminUserResponse[]): PageResponse<AdminUserResponse> {
  return { content, page: 0, size: 30, totalElements: content.length, totalPages: 1 };
}

const rows = [user(1, { role: "ROOT", nickname: "ルート" }), user(2), user(3, { role: "ADMIN", status: "BLOCKED" }), user(4, { nickname: null })];

describe("사용자 관리 화면", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const renderView = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <UsersAdminView viewerId={1} />
      </QueryClientProvider>,
    );

  it("이메일·역할·차단 여부를 보여 주고, ROOT 줄에는 변경 칸이 없다", async () => {
    fetchMock.mockResolvedValueOnce(json(page(rows)));
    renderView();
    expect(await screen.findByText("u2@example.com")).toBeInTheDocument();
    expect(screen.getByText("(닉네임 없음)")).toBeInTheDocument();
    expect(screen.getByText(/차단됨/)).toBeInTheDocument();
    expect(screen.queryByLabelText("ルート 역할")).toBeNull();
    expect(screen.getByLabelText("ユーザー2 역할")).toHaveValue("USER");
    expect(screen.getByLabelText("ユーザー3 역할")).toHaveValue("ADMIN");
  });

  it("고를 수 있는 역할에 ROOT는 없다", async () => {
    fetchMock.mockResolvedValueOnce(json(page(rows)));
    renderView();
    const select = await screen.findByLabelText("ユーザー2 역할");
    const values = Array.from(select.querySelectorAll("option")).map((o) => o.getAttribute("value"));
    expect(values).toEqual(["USER", "ADMIN"]);
  });

  it("역할을 바꿔 저장하면 PATCH /admin/users/{id}/role로 보낸다", async () => {
    fetchMock
      .mockResolvedValueOnce(json(page(rows)))
      .mockResolvedValueOnce(json(user(2, { role: "ADMIN" })))
      .mockResolvedValue(json(page(rows)));
    renderView();
    const select = await screen.findByLabelText("ユーザー2 역할");
    expect(screen.getByRole("button", { name: "ユーザー2 역할 저장" })).toBeDisabled();
    fireEvent.change(select, { target: { value: "ADMIN" } });
    fireEvent.click(screen.getByRole("button", { name: "ユーザー2 역할 저장" }));

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/admin/users/2/role");
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("PATCH");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ role: "ADMIN" });
  });

  it("서버가 거절하면 그 줄에 오류를 보여 준다", async () => {
    fetchMock
      .mockResolvedValueOnce(json(page(rows)))
      .mockResolvedValueOnce(json({ code: "FORBIDDEN", message: "권한이 없습니다." }, 403));
    renderView();
    fireEvent.change(await screen.findByLabelText("ユーザー2 역할"), { target: { value: "ADMIN" } });
    fireEvent.click(screen.getByRole("button", { name: "ユーザー2 역할 저장" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("권한이 없습니다.");
  });
});
