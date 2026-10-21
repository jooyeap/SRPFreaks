import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TermsPage from "@/app/terms/page";
import LoginPage from "@/app/login/page";
import { AuthProvider } from "@/components/AuthProvider";
import { SiteFooter } from "@/components/SiteFooter";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("이용약관", () => {
  it("서비스 성격, 기록과 레이팅, 탈퇴 항목이 들어 있다", () => {
    render(<TermsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "이용약관" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /서비스의 성격/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /기록과 레이팅/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /탈퇴/ })).toBeInTheDocument();
    expect(screen.getByText(/참고용이며 공식 사이트의 값과 다를 수 있습니다/)).toBeInTheDocument();
  });

  it("문의 메일이 설정돼 있으면 문의처에 보여 준다", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "contact@example.com");
    render(<TermsPage />);
    expect(screen.getByRole("link", { name: "contact@example.com" })).toHaveAttribute("href", "mailto:contact@example.com");
  });

  it("푸터에서 약관으로 갈 수 있다", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "이용약관" })).toHaveAttribute("href", "/terms");
  });

  it("로그인 화면에 약관·처리방침 링크가 함께 있다", () => {
    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>,
    );
    expect(screen.getByRole("link", { name: "이용약관" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "개인정보 처리방침" })).toHaveAttribute("href", "/privacy");
  });
});
