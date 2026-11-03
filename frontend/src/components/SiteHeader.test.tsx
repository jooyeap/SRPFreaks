import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { clearAccessToken } from "@/lib/auth-token";

vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/google", () => ({ loadGoogleIdentity: vi.fn(() => Promise.resolve({ disableAutoSelect: vi.fn() })) }));

describe("SiteHeader", () => {
  beforeEach(() => {
    clearAccessToken();
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
});
