import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("홈", () => {
  it("서비스 소개와 서열표/레이팅으로 가는 링크를 보여 준다", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "SRPFreaks" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /서열표/ })).toHaveAttribute("href", "/table");
    expect(screen.getByRole("link", { name: /레이팅/ })).toHaveAttribute("href", "/rating");
  });

  it("로그인 방식과 기록 공개 범위를 안내한다", () => {
    render(<Home />);
    expect(screen.getByText(/Google 계정으로만/)).toBeInTheDocument();
    expect(screen.getByText(/본인만 볼 수 있습니다/)).toBeInTheDocument();
  });
});
