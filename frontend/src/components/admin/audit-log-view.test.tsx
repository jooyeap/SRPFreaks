import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminGate } from "@/components/admin/AdminGate";
import { AuditLogView } from "@/components/admin/AuditLogView";
import { AuthProvider } from "@/components/AuthProvider";
import type { AuditLogResponse, PageResponse } from "@/lib/api-types";
import { clearAccessToken } from "@/lib/auth-token";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }), usePathname: () => "/admin" }));
vi.mock("@/lib/google", () => ({ loadGoogleIdentity: vi.fn(() => Promise.resolve({ disableAutoSelect: vi.fn() })) }));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function log(id: number, over: Partial<AuditLogResponse> = {}): AuditLogResponse {
  return {
    id,
    actorId: 5,
    actorNickname: "ルート",
    action: "SONG_CREATE",
    targetType: "SONG",
    targetId: "7",
    detail: { title: "새 곡" },
    createdAt: "2026-10-08T00:00:00Z",
    ...over,
  };
}

function page(content: AuditLogResponse[], p = 0, totalPages = 1): PageResponse<AuditLogResponse> {
  return { content, page: p, size: 30, totalElements: content.length, totalPages };
}

describe("감사 로그 화면", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    clearAccessToken();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const renderView = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AuditLogView viewerId={1} />
      </QueryClientProvider>,
    );

  it("작업 이름, 사람, 대상, 세부 내용을 보여 준다", async () => {
    fetchMock.mockResolvedValueOnce(json(page([log(2), log(1, { actorId: null, actorNickname: null, action: "SOMETHING_NEW", detail: null })])));
    renderView();
    expect(await screen.findByText("곡 등록")).toBeInTheDocument();
    expect(screen.getByText(/ルート/)).toBeInTheDocument();
    expect(screen.getByText('{"title":"새 곡"}')).toBeInTheDocument();
    expect(screen.getByText("SOMETHING_NEW")).toBeInTheDocument(); // 모르는 종류는 그대로
    expect(screen.getByText(/탈퇴한 사용자/)).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/admin/audit-logs");
  });

  it("기록이 없으면 안내 문구, 서버 오류면 오류 문구", async () => {
    fetchMock.mockResolvedValueOnce(json(page([])));
    const { unmount } = renderView();
    expect(await screen.findByText("아직 기록이 없습니다.")).toBeInTheDocument();
    unmount();

    fetchMock.mockResolvedValueOnce(json({ code: "FORBIDDEN", message: "권한이 없습니다." }, 403));
    renderView();
    expect(await screen.findByRole("alert")).toHaveTextContent("권한이 없습니다.");
  });

  it("다음 버튼으로 다음 페이지를 요청한다", async () => {
    fetchMock.mockResolvedValueOnce(json(page([log(2)], 0, 2))).mockResolvedValueOnce(json(page([log(1)], 1, 2)));
    renderView();
    await screen.findByText("곡 등록");
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(await screen.findByText("2 / 2")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("page=1");
  });
});

describe("AdminGate", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    clearAccessToken();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const login = (role: string) =>
    fetchMock.mockResolvedValueOnce(
      json({
        accessToken: "t",
        tokenType: "Bearer",
        expiresIn: 900,
        user: { id: 9, email: "a@example.com", nickname: null, role, createdAt: "2026-10-01T00:00:00Z" },
      }),
    );
  const renderGate = () =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <AdminGate title="관리">{(viewerId) => <p>안쪽 {viewerId}</p>}</AdminGate>
        </AuthProvider>
      </QueryClientProvider>,
    );

  it("ROOT면 안쪽을 보여 주고 보는 사람의 id를 넘긴다", async () => {
    login("ROOT");
    renderGate();
    expect(await screen.findByText("안쪽 9")).toBeInTheDocument();
  });

  it("ADMIN·USER는 권한 없음 문구만 보인다", async () => {
    login("ADMIN");
    renderGate();
    expect(await screen.findByRole("alert")).toHaveTextContent("권한이 없습니다.");
    expect(screen.queryByText(/안쪽/)).toBeNull();
  });

  it("로그인하지 않았으면 로그인 링크", async () => {
    fetchMock.mockResolvedValueOnce(json({ code: "UNAUTHORIZED", message: "로그인이 필요합니다." }, 401));
    renderGate();
    expect(await screen.findByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login");
  });
});
