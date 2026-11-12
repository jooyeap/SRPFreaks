import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const fetchMock = vi.fn<typeof fetch>();
const emptyPage = { content: [], page: 0, size: 5, totalElements: 0, totalPages: 0 };

describe("홈", () => {
  beforeEach(() => {
    auth.status = "anonymous";
    auth.user = null;
    // 로그인 전 홈의 공개 목록(유저·공지) 요청은 기본으로 빈 목록을 준다 (카드는 숨는다)
    fetchMock.mockReset();
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(emptyPage), { status: 200, headers: { "Content-Type": "application/json" } })),
    );
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("로그인 전: 서비스 소개와 로그인 링크를 보여 준다", () => {
    renderHome();
    expect(screen.getByRole("heading", { name: "SRPFreaks" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login");
  });

  it("로그인 방식과 기록 입력 방식을 안내하고, 공개 범위는 단정하지 않는다", () => {
    renderHome();
    expect(screen.getByText("기록은 최근 20곡 불러오기 혹은 직접 입력합니다.")).toBeInTheDocument();
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

  it("로그인 전: 서열표 바로가기 5개를 보여 주고, 공개 목록이 비어 있으면 유저·공지 카드는 숨긴다", async () => {
    renderHome();
    expect(screen.getByRole("region", { name: "서열표 바로가기" })).toBeInTheDocument();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("region", { name: "유저 목록 미리보기" })).toBeNull();
    expect(screen.queryByRole("region", { name: "공지사항" })).toBeNull();
    // 로그인 전 홈이 부르는 것은 공개 읽기 목록 둘뿐이다
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("/api/v1/players"))).toBe(true);
    expect(urls.some((u) => u.includes("/api/v1/notices"))).toBe(true);
    expect(urls).toHaveLength(2);
  });

  it("로그인 후 홈에는 로그인 전 보강 카드(바로가기)도 없고 공개 목록 요청도 이 화면에서 보내지 않는다", () => {
    auth.status = "authenticated";
    auth.user = { id: 1, email: "a@b.c", nickname: "홍길동", role: "USER" } as UserResponse;
    renderHome();
    expect(screen.getByText("대시보드 홍길동")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "서열표 바로가기" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
