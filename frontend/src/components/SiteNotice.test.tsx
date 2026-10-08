import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

describe("고지 문구", () => {
  it("상단에는 고지를 두지 않고, 고지는 하단에서 보여 준다", () => {
    render(
      <AuthProvider>
        <SiteHeader />
      </AuthProvider>,
    );
    expect(screen.queryByText("비공식 팬 프로젝트")).not.toBeInTheDocument();
  });

  it("하단에 '비공식 팬 프로젝트' 고지를 보여 준다", () => {
    render(<SiteFooter />);
    expect(screen.getByText("비공식 팬 프로젝트")).toBeInTheDocument();
  });

  it("하단에 KONAMI와 무관하다는 문구와 권리 문구를 보여 준다", () => {
    render(<SiteFooter />);
    expect(screen.getByText(/KONAMI와 무관/)).toBeInTheDocument();
    expect(screen.getByText(/모든 저작권과 상표 등 권리는 KONAMI에 있습니다/)).toBeInTheDocument();
  });

  it("하단에 서열표 정보 제공자(イズニャン)와 X 링크를 보여 준다", () => {
    render(<SiteFooter />);
    const link = screen.getByRole("link", { name: /イズニャン/ });
    expect(link).toHaveAttribute("href", "https://x.com/trist_is");
    expect(link).toHaveTextContent("@trist_is");
    // 외부 링크: 새 탭 + opener 차단
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });
});
