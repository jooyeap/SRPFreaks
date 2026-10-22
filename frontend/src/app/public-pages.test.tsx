import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NoticesPage from "@/app/notices/page";
import PlayersPage from "@/app/players/page";
import SongsPage from "@/app/songs/page";
import TablePage from "@/app/table/page";

// 로그인하지 않은 방문자(D43)
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ status: "anonymous", user: null }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
// 화면 본체는 따로 시험하므로 여기서는 어떤 값으로 그려지는지만 본다
vi.mock("@/components/notices/NoticesView", () => ({
  NoticesView: (p: { viewerId: number; canWrite: boolean }) => <div data-testid="notices" data-viewer={p.viewerId} data-write={String(p.canWrite)} />,
}));
vi.mock("@/components/players/PlayerListView", () => ({
  PlayerListView: (p: { viewerId: number }) => <div data-testid="players" data-viewer={p.viewerId} />,
}));
vi.mock("@/components/songs/SongListView", () => ({
  SongListView: (p: { userId: number; canRegister: boolean }) => <div data-testid="songs" data-viewer={p.userId} data-register={String(p.canRegister)} />,
}));
vi.mock("@/components/table/DifficultyTableView", () => ({
  DifficultyTableView: (p: { userId: number; canRegister: boolean }) => <div data-testid="table" data-viewer={p.userId} data-register={String(p.canRegister)} />,
}));

describe("비로그인 방문자도 보는 화면", () => {
  it("공지: 로그인 안내 대신 목록을 그리고 쓰기 권한은 없다", () => {
    render(<NoticesPage />);
    const view = screen.getByTestId("notices");
    expect(view).toHaveAttribute("data-viewer", "0");
    expect(view).toHaveAttribute("data-write", "false");
    expect(screen.queryByRole("link", { name: "로그인" })).toBeNull();
  });

  it("유저 목록: 로그인 안내 대신 목록을 그린다", () => {
    render(<PlayersPage />);
    expect(screen.getByTestId("players")).toHaveAttribute("data-viewer", "0");
  });

  it("곡 목록: 목록을 그리고 등록 권한은 없으며, 로그인 안내 배너가 따로 있다", () => {
    render(<SongsPage />);
    const view = screen.getByTestId("songs");
    expect(view).toHaveAttribute("data-viewer", "0");
    expect(view).toHaveAttribute("data-register", "false");
    expect(screen.getByText("로그인하면 내 기록과 레이팅을 함께 볼 수 있습니다.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login");
  });

  it("서열표: 표를 그리고 등록 권한은 없으며, 로그인 안내 배너가 있다", () => {
    render(<TablePage />);
    const view = screen.getByTestId("table");
    expect(view).toHaveAttribute("data-viewer", "0");
    expect(view).toHaveAttribute("data-register", "false");
    expect(screen.getByText("로그인하면 내 기록과 레이팅을 함께 볼 수 있습니다.")).toBeInTheDocument();
  });
});
