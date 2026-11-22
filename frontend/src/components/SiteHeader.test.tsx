import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/components/AuthProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { clearAccessToken } from "@/lib/auth-token";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname, useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/google", () => ({ loadGoogleIdentity: vi.fn(() => Promise.resolve({ disableAutoSelect: vi.fn() })) }));

describe("SiteHeader", () => {
  beforeEach(() => {
    clearAccessToken();
    pathname = "/";
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 401 })));
  });

  it("언어·테마 스위치는 lg 이상에서만 보인다 (lg 미만에서는 하단 더보기 시트가 맡는다)", () => {
    render(
      <AuthProvider>
        <SiteHeader />
      </AuthProvider>,
    );
    const wrapper = screen.getByRole("button", { name: "다크/라이트 테마 전환" }).parentElement as HTMLElement;
    expect(wrapper).toHaveClass("hidden", "lg:flex");
    expect(wrapper).toContainElement(screen.getByRole("button", { name: "언어를 日本語(으)로 바꾸기" }));
  });

  it("좁은 폭·큰 글꼴에서 헤더가 화면보다 넓어지지 않게 이름이 줄어들 수 있다 (D101)", () => {
    // 접힌 폴더블(280~344px)에서 글꼴을 키우면 이름 + 검색 + 알림이 한 줄에 못 들어가 페이지 전체가 오른쪽으로 밀렸다.
    // jsdom은 배치를 재지 못해서 클래스 규칙으로 지킨다(이름: 줄어들 수 있음, 오른쪽 묶음: 줄어들지 않음).
    render(
      <AuthProvider>
        <SiteHeader />
      </AuthProvider>,
    );
    const brand = screen.getByRole("link", { name: "SRPFreaks" });
    expect(brand).toHaveClass("min-w-0", "truncate");
    expect(screen.getByRole("button", { name: "다크/라이트 테마 전환" }).closest("div.ml-auto")).toHaveClass("shrink-0");
  });

  // 곡 검색은 헤더가 직접 그린다(포털 자리 없음, D107). 로그인 전·홈이 아닌 화면에서도 같은 자리에 있다
  it("홈이 아닌 화면·로그인 전에도 알림 종 왼쪽에 곡 검색 버튼이 있고, 누르면 검색 창이 열린다", async () => {
    pathname = "/table";
    const { container } = render(
      <AuthProvider>
        <QueryClientProvider client={new QueryClient()}>
          <SiteHeader />
        </QueryClientProvider>
      </AuthProvider>,
    );
    const button = screen.getByRole("button", { name: "곡 검색" });
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    // 오른쪽 묶음 안(알림 종 자리 왼쪽)에 있다
    expect(button.closest("div.ml-auto")).toHaveClass("shrink-0");
    expect(container.querySelector("#header-search-slot, #header-home-search-slot")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(button);
    expect(await screen.findByRole("dialog", { name: "곡 검색" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "곡 검색" })).toHaveFocus();
  });
});
