import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "@/components/AuthProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ImportSettingsPage from "./page";

describe("가져오기 설정 화면", () => {
  it("기능을 꺼 둔 동안에는 준비 중 안내만 보여 주고 토큰 화면은 보여 주지 않는다", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <ImportSettingsPage />
        </AuthProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByText("이 기능은 아직 준비 중입니다.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "토큰 발급" })).toBeNull();
  });
});
