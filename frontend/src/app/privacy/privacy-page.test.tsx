import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PrivacyPage from "@/app/privacy/page";
import LoginPage from "@/app/login/page";
import { AuthProvider } from "@/components/AuthProvider";
import { SiteFooter } from "@/components/SiteFooter";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("개인정보 처리방침", () => {
  it("수집 항목, 보관·삭제, 쿠키 안내가 들어 있다", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { level: 1, name: "개인정보 처리방침" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /수집하는 정보/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /보관 기간과 삭제/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /쿠키/ })).toBeInTheDocument();
    expect(screen.getByText(/비밀번호는 받지도 저장하지도 않습니다/)).toBeInTheDocument();
  });

  it("문의 메일이 설정돼 있으면 문의처에 보여 준다", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "contact@example.com");
    render(<PrivacyPage />);
    expect(screen.getByRole("link", { name: "contact@example.com" })).toHaveAttribute("href", "mailto:contact@example.com");
  });

  it("푸터에서 처리방침으로 갈 수 있다", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "개인정보 처리방침" })).toHaveAttribute("href", "/privacy");
  });

  it("로그인 화면에 처리방침 링크와 동의 안내가 있다", () => {
    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>,
    );
    expect(screen.getByRole("link", { name: "개인정보 처리방침" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByText(/동의한 것으로 봅니다/)).toBeInTheDocument();
  });
});
