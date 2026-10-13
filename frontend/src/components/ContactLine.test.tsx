import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SiteFooter } from "@/components/SiteFooter";
import { getContactEmail } from "@/lib/contact";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("문의 메일", () => {
  it("환경변수가 있으면 푸터에 mailto 링크로 보여 준다", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "contact@example.com");
    render(<SiteFooter />);
    const link = screen.getByRole("link", { name: "contact@example.com" });
    expect(link).toHaveAttribute("href", "mailto:contact@example.com");
  });

  it("환경변수가 비어 있으면 연락처 줄을 그리지 않는다", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "");
    render(<SiteFooter />);
    expect(screen.queryByText(/문의·삭제 요청/)).not.toBeInTheDocument();
  });

  it("앞뒤 공백은 지우고, 공백뿐이면 없는 값으로 본다", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "  a@example.com ");
    expect(getContactEmail()).toBe("a@example.com");
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "   ");
    expect(getContactEmail()).toBeNull();
  });
});
