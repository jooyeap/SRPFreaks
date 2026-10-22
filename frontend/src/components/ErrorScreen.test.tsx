import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ErrorPage from "@/app/error";
import GlobalError from "@/app/global-error";
import NotFound from "@/app/not-found";

describe("404·오류 화면", () => {
  it("없는 화면 안내와 홈 링크를 보여 준다", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { name: "화면을 찾을 수 없습니다" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "홈으로" })).toHaveAttribute("href", "/");
  });

  it("오류 화면은 오류 내용을 보이지 않고, 다시 시도 버튼이 retry를 부른다", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();
    render(<ErrorPage error={new Error("SELECT * FROM users secret@example.com")} retry={retry} />);
    expect(screen.getByRole("heading", { name: "문제가 생겼습니다" })).toBeInTheDocument();
    expect(screen.queryByText(/SELECT|secret@example\.com/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("전역 오류 화면도 오류 내용을 보이지 않는다", () => {
    const retry = vi.fn();
    render(<GlobalError error={new Error("secret-token-123")} retry={retry} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/secret-token-123/)).not.toBeInTheDocument();
  });
});
