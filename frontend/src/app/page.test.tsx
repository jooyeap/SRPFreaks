import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import type { UserResponse } from "@/lib/api-types";

// 로그인 상태만 바꿔 가며 홈의 분기를 확인한다 (AuthProvider의 실제 네트워크 복구는 쓰지 않는다)
const auth: { status: "loading" | "authenticated" | "anonymous"; user: UserResponse | null } = {
  status: "anonymous",
  user: null,
};
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => auth }));
vi.mock("@/components/home/HomeDashboard", () => ({
  HomeDashboard: ({ name }: { name: string }) => <p>대시보드 {name}</p>,
}));

function renderHome() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <Home />
    </QueryClientProvider>,
  );
}

describe("홈", () => {
  beforeEach(() => {
    auth.status = "anonymous";
    auth.user = null;
  });

  it("로그인 전: 서비스 소개와 로그인 링크를 보여 준다", () => {
    renderHome();
    expect(screen.getByRole("heading", { name: "SRPFreaks" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login");
  });

  it("로그인 방식과 기록 입력 방식을 안내하고, 공개 범위는 단정하지 않는다", () => {
    renderHome();
    expect(screen.getByText("로그인은 Google 계정으로만 합니다. 기록은 직접 입력합니다.")).toBeInTheDocument();
    // 프로필을 공개한 사용자의 기록은 다른 사람도 볼 수 있으므로 "본인만 볼 수 있다"고 쓰지 않는다 (D26)
    expect(screen.queryByText(/본인만 볼 수 있습니다/)).not.toBeInTheDocument();
  });

  it("복구 중에는 불러오는 중 문구만 보여 준다", () => {
    auth.status = "loading";
    renderHome();
    expect(screen.getByText("불러오는 중입니다.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "로그인" })).not.toBeInTheDocument();
  });

  it("로그인 후: 닉네임으로 대시보드를 보여 준다 (닉네임이 없으면 `플레이어`)", () => {
    auth.status = "authenticated";
    auth.user = { id: 1, email: "a@b.c", nickname: "홍길동", role: "USER" } as UserResponse;
    const { unmount } = renderHome();
    expect(screen.getByText("대시보드 홍길동")).toBeInTheDocument();
    unmount();
    auth.user = { id: 1, email: "a@b.c", nickname: null, role: "USER" } as UserResponse;
    renderHome();
    expect(screen.getByText("대시보드 플레이어")).toBeInTheDocument();
  });
});
