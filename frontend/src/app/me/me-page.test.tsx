import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 마이페이지 주소(?tab=, ?view=)와 옛 주소(?tab=setlist, ?tab=analysis) 처리를 확인한다. 라우터와 로그인 상태는 가짜로 끼운다.
const nav = vi.hoisted(() => ({
  search: new URLSearchParams(""),
  replace: vi.fn<(href: string, options?: { scroll?: boolean }) => void>(),
  pathname: "/me",
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => nav.search,
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), back: vi.fn() }),
  usePathname: () => nav.pathname,
}));
vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ status: "authenticated", user: { id: 1 } }),
  useOptionalUser: () => ({ id: 1 }),
}));

import MyPage from "@/app/me/page";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const fetchMock = vi.fn<typeof fetch>();

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MyPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  nav.search = new URLSearchParams("");
  nav.replace.mockReset();
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => Promise.resolve(json({ message: "no" }, 500)));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("마이페이지 주소", () => {
  it("쿼리가 없으면 레이팅 탭(내 레이팅)이 기본이고 주소를 바꾸지 않는다", () => {
    renderPage();
    expect(screen.getByRole("tab", { name: "레이팅" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "내 레이팅" })).toHaveAttribute("aria-current", "true");
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("옛 주소 ?tab=setlist는 리스트 탭으로 열고 ?tab=list로 replace 한다(기록을 쌓지 않고 스크롤을 유지)", async () => {
    nav.search = new URLSearchParams("tab=setlist");
    renderPage();
    expect(screen.getByRole("tab", { name: "리스트" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/me?tab=list", { scroll: false }));
  });

  it("옛 주소 ?tab=analysis는 레이팅 탭의 분석으로 열고 ?tab=rating&view=analysis로 replace 한다", async () => {
    nav.search = new URLSearchParams("tab=analysis");
    renderPage();
    expect(screen.getByRole("tab", { name: "레이팅" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "분석" })).toHaveAttribute("aria-current", "true");
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/me?tab=rating&view=analysis", { scroll: false }));
  });

  it("새 주소(?tab=rating&view=analysis, ?tab=list)는 그대로 열고 replace 하지 않는다", () => {
    nav.search = new URLSearchParams("tab=rating&view=analysis");
    const { unmount } = renderPage();
    expect(screen.getByRole("button", { name: "분석" })).toHaveAttribute("aria-current", "true");
    unmount();
    nav.search = new URLSearchParams("tab=list");
    renderPage();
    expect(screen.getByRole("tab", { name: "리스트" })).toHaveAttribute("aria-selected", "true");
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("알 수 없는 탭 값은 레이팅 탭으로 열고 주소는 그대로 둔다", () => {
    nav.search = new URLSearchParams("tab=zzz");
    renderPage();
    expect(screen.getByRole("tab", { name: "레이팅" })).toHaveAttribute("aria-selected", "true");
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("탭과 하위 전환을 누르면 replace(스크롤 유지)로 주소를 바꾼다", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "분석" }));
    expect(nav.replace).toHaveBeenLastCalledWith("/me?tab=rating&view=analysis", { scroll: false });
    fireEvent.click(screen.getByRole("tab", { name: "리스트" }));
    expect(nav.replace).toHaveBeenLastCalledWith("/me?tab=list", { scroll: false });
    fireEvent.click(screen.getByRole("tab", { name: "레이팅" }));
    expect(nav.replace).toHaveBeenLastCalledWith("/me", { scroll: false });
  });
});
