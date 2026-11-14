import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminBackLink } from "@/components/admin/AdminBackLink";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminMenu } from "@/components/admin/AdminMenu";
import { AdminNavLink } from "@/components/AdminNavLink";
import { AuthProvider } from "@/components/AuthProvider";
import { ADMIN_MENU_GROUPS, ADMIN_MENU_ITEMS, canSeeAdminMenu, hasRoleAtLeast, visibleAdminMenuGroups } from "@/lib/admin";
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

  it("서열표 분석(D77) 메뉴는 ADMIN 이상에게만 보이고 USER·비로그인에게는 보이지 않는다", () => {
    const item = ADMIN_MENU_ITEMS.find((i) => i.href === "/admin/chart-stats");
    expect(item?.minRole).toBe("ADMIN");
    expect(hasRoleAtLeast("USER", item!.minRole)).toBe(false);
    expect(hasRoleAtLeast(null, item!.minRole)).toBe(false);
    expect(hasRoleAtLeast("ADMIN", item!.minRole)).toBe(true);
    expect(hasRoleAtLeast("ROOT", item!.minRole)).toBe(true);
    // USER가 볼 수 있는 관리 메뉴 항목은 하나도 없다
    expect(ADMIN_MENU_ITEMS.filter((i) => hasRoleAtLeast("USER", i.minRole))).toEqual([]);
  });

  it("관리 메뉴는 ADMIN과 ROOT만 볼 수 있다", () => {
    expect(canSeeAdminMenu("ROOT")).toBe(true);
    expect(canSeeAdminMenu("ADMIN")).toBe(true);
    expect(canSeeAdminMenu("USER")).toBe(false);
    expect(canSeeAdminMenu(null)).toBe(false);
  });
});

describe("AdminMenu 묶음·항목 (D78)", () => {
  const menuFetch = vi.fn<typeof fetch>();
  beforeEach(() => {
    menuFetch.mockReset();
    vi.stubGlobal("fetch", menuFetch);
  });
  afterEach(() => vi.unstubAllGlobals());

  const withReceived = (received: number) =>
    menuFetch.mockImplementation((input) =>
      String(input).includes("/received-count") ? Promise.resolve(json({ received })) : Promise.resolve(json({}, 404)),
    );
  const renderMenu = (role: "ADMIN" | "ROOT") =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AdminMenu role={role} viewerId={9} />
      </QueryClientProvider>,
    );
  const group = (name: string) => within(screen.getByRole("region", { name }));

  it("메뉴는 콘텐츠 · 운영 · 시스템 세 묶음이고 항목이 알맞은 묶음에 있다 (ROOT)", async () => {
    withReceived(0);
    renderMenu("ROOT");
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["콘텐츠", "운영", "시스템ROOT"]);

    const content = group("콘텐츠");
    expect(content.getByRole("link", { name: /곡 관리/ })).toHaveAttribute("href", "/songs");
    expect(content.getByRole("link", { name: /서열표 관리/ })).toHaveAttribute("href", "/table");
    expect(content.getByRole("link", { name: /서열표 분석/ })).toHaveAttribute("href", "/admin/chart-stats");
    expect(content.getByRole("link", { name: /공식 곡 목록 갱신/ })).toHaveAttribute("href", "/admin/song-import");
    expect(content.getAllByRole("link")).toHaveLength(4);

    const ops = group("운영");
    expect(ops.getByRole("link", { name: /건의 관리/ })).toHaveAttribute("href", "/admin/suggestions");
    expect(ops.getByRole("link", { name: /사용자/ })).toHaveAttribute("href", "/admin/users");
    expect(ops.getAllByRole("link")).toHaveLength(2);

    const system = group("시스템ROOT");
    expect(system.getByRole("link", { name: /^설정/ })).toHaveAttribute("href", "/admin/settings");
    expect(system.getByRole("link", { name: /감사 로그/ })).toHaveAttribute("href", "/admin/audit-logs");
    expect(system.getAllByRole("link")).toHaveLength(2);
    // 시스템 묶음 제목 옆의 ROOT 칩은 글자로 보인다
    expect(system.getByText("ROOT")).toBeInTheDocument();
  });

  it("ADMIN에게는 ROOT 전용 항목이 숨겨지고 시스템 묶음이 통째로 없다", async () => {
    withReceived(0);
    renderMenu("ADMIN");
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["콘텐츠", "운영"]);
    expect(screen.getByRole("link", { name: /곡 관리/ })).toHaveAttribute("href", "/songs");
    expect(screen.getByRole("link", { name: /서열표 관리/ })).toHaveAttribute("href", "/table");
    expect(screen.getByRole("link", { name: /서열표 분석/ })).toHaveAttribute("href", "/admin/chart-stats");
    expect(screen.getByRole("link", { name: /건의 관리/ })).toHaveAttribute("href", "/admin/suggestions");
    expect(screen.queryByRole("link", { name: /공식 곡 목록 갱신/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /사용자/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /감사 로그/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /^설정/ })).toBeNull();
    expect(screen.queryByText("ROOT")).toBeNull();
    expect(screen.queryByRole("region", { name: /시스템/ })).toBeNull();
  });

  it("USER에게 보이는 묶음·항목은 하나도 없다", () => {
    expect(visibleAdminMenuGroups("USER")).toEqual([]);
    expect(visibleAdminMenuGroups(null)).toEqual([]);
    expect(visibleAdminMenuGroups("ADMIN").flatMap((g) => g.items).every((i) => i.minRole === "ADMIN")).toBe(true);
    // 묶음을 펼친 항목 목록과 같은 항목이다(빠진 항목·중복 없음)
    const hrefs = ADMIN_MENU_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(ADMIN_MENU_ITEMS.map((i) => i.href).sort()).toEqual([...hrefs].sort());
  });

  it("새 건의(접수 대기)가 있으면 건의 관리 줄에 개수 배지가 붙고 글자로도 읽힌다", async () => {
    withReceived(3);
    renderMenu("ADMIN");
    const link = await screen.findByRole("link", { name: /건의 관리.*접수 대기 3건/ });
    expect(within(link).getByText("3")).toBeInTheDocument();
    // 다른 항목에는 배지가 없다
    expect(screen.getByRole("link", { name: /서열표 관리/ }).textContent).not.toMatch(/접수 대기/);
  });

  it("접수 대기가 없으면 배지가 없고, 99건을 넘으면 99+로 줄여 보인다", async () => {
    withReceived(0);
    const { unmount } = renderMenu("ADMIN");
    await vi.waitFor(() => expect(menuFetch).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByRole("link", { name: /건의 관리/ }).textContent).not.toMatch(/접수 대기/);
    unmount();

    withReceived(120);
    renderMenu("ADMIN");
    const link = await screen.findByRole("link", { name: /건의 관리.*접수 대기 120건/ });
    expect(within(link).getByText("99+")).toBeInTheDocument();
  });

  it("개수를 받지 못해도 메뉴는 그대로 보인다(배지만 없다)", async () => {
    menuFetch.mockResolvedValue(json({ code: "FORBIDDEN", message: "x" }, 403));
    renderMenu("ADMIN");
    expect(screen.getByRole("link", { name: /건의 관리/ })).toHaveAttribute("href", "/admin/suggestions");
    await vi.waitFor(() => expect(menuFetch).toHaveBeenCalled());
    expect(screen.getByRole("link", { name: /건의 관리/ }).textContent).not.toMatch(/접수 대기/);
  });

  it("설명은 한 줄(말줄임)이고 전체 글은 title로 볼 수 있다", () => {
    withReceived(0);
    renderMenu("ROOT");
    const desc = screen.getByText("레이팅 계수, 재킷 표시, 연락처를 바꿉니다.");
    expect(desc).toHaveClass("truncate");
    expect(desc).toHaveAttribute("title", "레이팅 계수, 재킷 표시, 연락처를 바꿉니다.");
  });
});

describe("AdminBackLink (D78)", () => {
  it("‹ 관리 모양이고 관리 메뉴(/admin)로 돌아간다", () => {
    render(<AdminBackLink />);
    const link = screen.getByRole("link", { name: "관리로" });
    expect(link).toHaveAttribute("href", "/admin");
    expect(link).toHaveTextContent("관리");
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
