import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminMenu } from "@/components/admin/AdminMenu";
import { AdminNavLink } from "@/components/AdminNavLink";
import { AuthProvider } from "@/components/AuthProvider";
import { canSeeAdminMenu, hasRoleAtLeast } from "@/lib/admin";
import { clearAccessToken } from "@/lib/auth-token";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }), usePathname: () => "/admin" }));
vi.mock("@/lib/google", () => ({ loadGoogleIdentity: vi.fn(() => Promise.resolve({ disableAutoSelect: vi.fn() })) }));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("역할 조건", () => {
  it("ROOT > ADMIN > USER 순서로 기준 이상인지 본다", () => {
    expect(hasRoleAtLeast("ROOT", "ADMIN")).toBe(true);
    expect(hasRoleAtLeast("ADMIN", "ADMIN")).toBe(true);
    expect(hasRoleAtLeast("ADMIN", "ROOT")).toBe(false);
    expect(hasRoleAtLeast("USER", "ADMIN")).toBe(false);
    expect(hasRoleAtLeast(null, "ADMIN")).toBe(false);
    expect(hasRoleAtLeast(undefined, "USER")).toBe(false);
  });

  it("관리 메뉴는 ADMIN과 ROOT만 볼 수 있다", () => {
    expect(canSeeAdminMenu("ROOT")).toBe(true);
    expect(canSeeAdminMenu("ADMIN")).toBe(true);
    expect(canSeeAdminMenu("USER")).toBe(false);
    expect(canSeeAdminMenu(null)).toBe(false);
  });
});

describe("AdminMenu 항목", () => {
  it("ADMIN에게는 곡·서열표 관리만, ROOT에게는 사용자·설정·감사 로그까지 보인다", () => {
    const { unmount } = render(<AdminMenu role="ADMIN" />);
    expect(screen.getByRole("link", { name: /곡 관리/ })).toHaveAttribute("href", "/songs");
    expect(screen.getByRole("link", { name: /서열표 관리/ })).toHaveAttribute("href", "/table");
    expect(screen.queryByRole("link", { name: /사용자/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /감사 로그/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /^설정/ })).toBeNull();
    unmount();

    render(<AdminMenu role="ROOT" />);
    expect(screen.getByRole("link", { name: /곡 관리/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /사용자/ })).toHaveAttribute("href", "/admin/users");
    expect(screen.getByRole("link", { name: /^설정/ })).toHaveAttribute("href", "/admin/settings");
    expect(screen.getByRole("link", { name: /감사 로그/ })).toHaveAttribute("href", "/admin/audit-logs");
  });
});

describe("AdminNavLink / AdminGate (역할별)", () => {
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
  const wrap = (node: React.ReactNode) =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>{node}</AuthProvider>
      </QueryClientProvider>,
    );

  it("헤더의 관리 링크는 ADMIN·ROOT에게만 보인다", async () => {
    for (const role of ["ADMIN", "ROOT"]) {
      clearAccessToken();
      login(role);
      const { unmount } = wrap(<AdminNavLink />);
      expect(await screen.findByRole("link", { name: "관리" }), role).toHaveAttribute("href", "/admin");
      unmount();
    }

    clearAccessToken();
    login("USER");
    const { container } = wrap(<AdminNavLink />);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(container.querySelector("a")).toBeNull();
  });

  it("비로그인에게는 관리 링크가 없다", async () => {
    fetchMock.mockResolvedValueOnce(json({ code: "UNAUTHORIZED", message: "로그인이 필요합니다." }, 401));
    const { container } = wrap(<AdminNavLink />);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(container.querySelector("a")).toBeNull();
  });

  it("minRole이 ADMIN이면 ADMIN도 통과하고 역할을 넘겨 받는다", async () => {
    login("ADMIN");
    wrap(<AdminGate title="관리" minRole="ADMIN">{(_id, role) => <p>역할 {role}</p>}</AdminGate>);
    expect(await screen.findByText("역할 ADMIN")).toBeInTheDocument();
  });

  it("minRole이 ADMIN이어도 USER는 권한 없음", async () => {
    login("USER");
    wrap(<AdminGate title="관리" minRole="ADMIN">{() => <p>안쪽</p>}</AdminGate>);
    expect(await screen.findByRole("alert")).toHaveTextContent("권한이 없습니다.");
  });
});
