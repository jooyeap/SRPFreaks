import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SongNavBar } from "@/components/song/SongNavBar";
import type { NavView } from "@/lib/detail-nav";
import { resetDetailNavHintForTest } from "@/lib/detail-nav-hint";

const view = (over: Partial<NavView> = {}): NavView => ({
  position: 3,
  total: 12,
  tier: 5.3,
  prev: { kind: "go", songId: 1, chartId: 1 },
  next: { kind: "go", songId: 2, chartId: 2 },
  ...over,
});

describe("SongNavBar", () => {
  beforeEach(() => resetDetailNavHintForTest());
  afterEach(() => vi.restoreAllMocks());

  it("‹ 이전 · 3/12 · 서열표 5.3 · 다음 › 를 보이고 누르면 방향을 알린다", () => {
    const onStep = vi.fn();
    render(<SongNavBar view={view()} onStep={onStep} />);
    const nav = screen.getByRole("navigation", { name: "이전·다음 곡" });
    expect(nav).toHaveTextContent("3/12");
    expect(nav).toHaveTextContent("서열표 5.3");
    fireEvent.click(screen.getByRole("button", { name: /이전/ }));
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    expect(onStep.mock.calls).toEqual([["prev"], ["next"]]);
  });
  it("처음/끝은 눌리지 않는 막힌 칸이다", () => {
    render(<SongNavBar view={view({ prev: null, next: null })} onStep={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /이전|다음/ })).not.toBeInTheDocument();
    expect(within(screen.getByRole("navigation")).getAllByText(/^(이전|다음)$/).every((el) => el.closest("[aria-disabled='true']") !== null)).toBe(true);
  });
  it("묶음 경계에서는 `다음 묶음 5.4`로 이름이 바뀐다", () => {
    render(<SongNavBar view={view({ next: { kind: "go", songId: 4, chartId: 4, tier: 5.4 }, prev: { kind: "go", songId: 5, chartId: 5, tier: 5.2 } })} onStep={vi.fn()} />);
    expect(screen.getByRole("button", { name: /다음 묶음 5\.4/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /이전 묶음 5\.2/ })).toBeInTheDocument();
  });
  it("곡 목록에서 들어왔으면 가운데는 `곡 목록`이다", () => {
    render(<SongNavBar view={view({ tier: null })} onStep={vi.fn()} />);
    expect(screen.getByRole("navigation")).toHaveTextContent("곡 목록");
  });
  it("안내 말풍선은 처음 한 번만: ×로 닫으면 다시 그려도 뜨지 않는다", () => {
    const first = render(<SongNavBar view={view()} onStep={vi.fn()} />);
    expect(screen.getByText(/좌우로 밀어도/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "안내 닫기" }));
    expect(screen.queryByText(/좌우로 밀어도/)).not.toBeInTheDocument();
    expect(localStorage.getItem("srp.detailNavHintSeen")).toBe("1");
    first.unmount();
    render(<SongNavBar view={view()} onStep={vi.fn()} />);
    expect(screen.queryByText(/좌우로 밀어도/)).not.toBeInTheDocument();
  });
  it("저장소를 읽고 쓸 수 없어도 화면은 정상이고, 닫으면 이번 방문 동안은 다시 뜨지 않는다", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const first = render(<SongNavBar view={view()} onStep={vi.fn()} />);
    expect(screen.getByText(/좌우로 밀어도/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "안내 닫기" }));
    first.unmount();
    render(<SongNavBar view={view()} onStep={vi.fn()} />);
    expect(screen.queryByText(/좌우로 밀어도/)).not.toBeInTheDocument();
  });
});
