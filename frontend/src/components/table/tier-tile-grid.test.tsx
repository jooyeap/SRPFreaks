import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { TierTileGrid, type TierTile } from "@/components/table/TierTileGrid";
import { resetTableTilesForTest } from "@/lib/table-tiles";
import { readTableReturn, rememberTableReturn } from "@/lib/table-view-state";

/** 4.9 ~ 7.0 (0.1 단위) 22칸. 기록은 모두 비워 둔다 */
const all: TierTile[] = Array.from({ length: 22 }, (_, i) => ({ tier: (49 + i) / 10, total: 10, recorded: 0 }));

function stubMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

function link(tier: string) {
  return screen.getByRole("link", { name: new RegExp(`^${tier.replace(".", "\\.")} `) });
}

describe("TierTileGrid", () => {
  beforeEach(() => {
    resetTableTilesForTest();
    stubMotion(false);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("타일에는 난이도 숫자와 기록/전체만 있고, 누르면 그 난이도 폴더로 간다 (4열, 360px 미만 3열)", () => {
    render(<TierTileGrid tiles={[{ tier: 5.8, total: 10, recorded: 4 }]} average={null} order="hard" label="난이도 목록" />);
    const list = screen.getByRole("list", { name: "난이도 목록" });
    expect(list).toHaveClass("grid-cols-3", "min-[360px]:grid-cols-4");
    const tile = screen.getByRole("link");
    expect(tile).toHaveAttribute("href", "/table/folder/5.8");
    expect(tile).toHaveTextContent("5.8");
    expect(tile).toHaveTextContent("4/10");
    expect(tile.textContent).toBe("5.8 4/10"); // 막대·약함·평균 글자 등은 없다
    expect(tile.className).toContain("min-h-14"); // 터치 영역 24px 이상
  });

  it("다 채운 타일(n/n)만 완료 색과 숨은 글자 `완료`가 붙고, 체크 글자는 없다", () => {
    render(
      <TierTileGrid
        tiles={[
          { tier: 5.0, total: 3, recorded: 3 },
          { tier: 5.1, total: 3, recorded: 2 },
          { tier: 5.2, total: 0, recorded: 0 },
        ]}
        average={null}
        order="easy"
        label="난이도 목록"
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveAttribute("data-done", "true");
    expect(within(items[0]).getByText("완료")).toHaveClass("sr-only");
    expect(items[0]).toHaveTextContent("3/3");
    expect(items[0].querySelector(".text-done-text")).not.toBeNull();
    expect(items[0].textContent).not.toContain("✓");
    expect(items[1]).not.toHaveAttribute("data-done");
    expect(within(items[1]).queryByText("완료")).toBeNull();
    expect(items[2]).not.toHaveAttribute("data-done"); // 전체가 0이면 완료가 아니다
  });

  it("기록이 0인 타일은 점선 윤곽 + 흐린 글자, 기록이 있으면 실선이고 기록 비율대로 진해진다 (tileTint 규칙)", () => {
    render(
      <TierTileGrid
        tiles={[
          { tier: 5.0, total: 10, recorded: 0 },
          { tier: 5.1, total: 10, recorded: 10 - 5 },
          { tier: 5.2, total: 10, recorded: 9 },
        ]}
        average={null}
        order="easy"
        label="난이도 목록"
      />,
    );
    const empty = link("5.0");
    expect(empty).toHaveClass("border-dashed");
    expect(empty.querySelector(".text-fg-dim")).not.toBeNull();
    const half = link("5.1");
    expect(half).not.toHaveClass("border-dashed");
    expect(half.getAttribute("style")).toContain("--tile-bg: color-mix(in srgb, var(--stage-ss-bar) 14%, transparent)"); // 4 + 0.5*20
    expect(empty.getAttribute("style")).toContain("var(--stage-ss-bar) 4%");
  });

  it("평균 타일은 주황 윤곽과 숨은 글자 `내 평균 난이도`가 붙고 하나뿐이다", () => {
    render(<TierTileGrid tiles={all} average={5.8} order="hard" label="난이도 목록" />);
    const marked = document.querySelectorAll("[data-average='true']");
    expect(marked).toHaveLength(1);
    expect(marked[0]).toHaveTextContent("5.8");
    expect(marked[0]).toHaveClass("border-2", "border-weak");
    expect(within(marked[0] as HTMLElement).getByText("내 평균 난이도")).toHaveClass("sr-only");
  });

  describe("접힘", () => {
    it("어려운 순: 평균 위 3칸(5.9·6.0·6.1)까지 보이고 그 위는 한 줄로 접힌다. 누르면 그 자리에서 펼쳐진다", () => {
      render(<TierTileGrid tiles={all} average={5.8} order="hard" label="난이도 목록" />);
      const fold = screen.getByRole("button", { name: /더 높은 난이도 9개 6\.2~7\.0/ });
      expect(fold).toHaveAttribute("aria-expanded", "false");
      expect(screen.getAllByRole("link").map((a) => a.textContent?.slice(0, 3))).toEqual([
        "6.1", "6.0", "5.9", "5.8", "5.7", "5.6", "5.5", "5.4", "5.3", "5.2", "5.1", "5.0", "4.9",
      ]);
      // 접힌 줄은 목록의 첫 칸(전체 폭)에 있다
      expect(screen.getAllByRole("listitem")[0]).toContainElement(fold);

      fireEvent.click(fold);
      expect(fold).toHaveAttribute("aria-expanded", "true");
      expect(fold).toHaveTextContent("접기");
      const tiers = screen.getAllByRole("link").map((a) => a.textContent?.slice(0, 3));
      expect(tiers).toHaveLength(22);
      expect(tiers[0]).toBe("7.0");

      fireEvent.click(fold);
      expect(screen.getAllByRole("link")).toHaveLength(13);
    });

    it("쉬운 순: 평균 아래 3칸(5.5·5.6·5.7)까지 보이고 더 낮은 난이도는 접힌다", () => {
      render(<TierTileGrid tiles={all} average={5.8} order="easy" label="난이도 목록" />);
      expect(screen.getByRole("button", { name: /더 낮은 난이도 6개 4\.9~5\.4/ })).toBeInTheDocument();
      expect(screen.getAllByRole("link")[0]).toHaveTextContent("5.5");
    });

    it("경계: 평균이 맨 위(7.0)일 때 어려운 순이면 접힘 줄이 없다", () => {
      render(<TierTileGrid tiles={all} average={7.0} order="hard" label="난이도 목록" />);
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.getAllByRole("link")).toHaveLength(22);
    });

    it("경계: 평균이 맨 아래(4.9)일 때 쉬운 순이면 접힘 줄이 없고, 어려운 순이면 위쪽이 접힌다", () => {
      const { unmount } = render(<TierTileGrid tiles={all} average={4.9} order="easy" label="난이도 목록" />);
      expect(screen.queryByRole("button")).toBeNull();
      unmount();
      render(<TierTileGrid tiles={all} average={4.9} order="hard" label="난이도 목록" />);
      expect(screen.getByRole("button", { name: /더 높은 난이도 18개 5\.3~7\.0/ })).toBeInTheDocument();
    });

    it("평균이 없으면(기록 없음·비로그인) 접지 않는다", () => {
      render(<TierTileGrid tiles={all} average={null} order="easy" label="난이도 목록" />);
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.getAllByRole("link")[0]).toHaveTextContent("4.9");
    });
  });

  describe("첫 진입 연출 (빛남 · 스크롤)", () => {
    it("처음 들어올 때 평균 타일에 빛남(tile-glow)이 붙고, 폴더에서 돌아와 다시 그려도 붙지 않는다 (윤곽은 남는다)", () => {
      const first = render(<TierTileGrid tiles={all} average={5.8} order="hard" label="난이도 목록" />);
      expect(document.querySelector("[data-average='true']")).toHaveClass("tile-glow");
      first.unmount(); // 폴더로 이동
      render(<TierTileGrid tiles={all} average={5.8} order="hard" label="난이도 목록" />); // 돌아옴
      const avg = document.querySelector("[data-average='true']");
      expect(avg).not.toHaveClass("tile-glow");
      expect(avg).toHaveClass("border-weak");
    });

    it("움직임 줄이기 설정이면 빛남 없이 윤곽만 있다", () => {
      stubMotion(true);
      render(<TierTileGrid tiles={all} average={5.8} order="hard" label="난이도 목록" />);
      const avg = document.querySelector("[data-average='true']");
      expect(avg).not.toHaveClass("tile-glow");
      expect(avg).toHaveClass("border-2", "border-weak");
    });

    it("평균이 없으면 연출을 하지 않고 기억도 남기지 않는다 (나중에 평균이 생기면 그때 한다)", () => {
      const first = render(<TierTileGrid tiles={all} average={null} order="easy" label="난이도 목록" />);
      expect(document.querySelector(".tile-glow")).toBeNull();
      first.unmount();
      render(<TierTileGrid tiles={all} average={5.8} order="hard" label="난이도 목록" />);
      expect(document.querySelector("[data-average='true']")).toHaveClass("tile-glow");
    });

    it("평균 타일이 화면 밖이면 그 위치로 스크롤하고, 화면 안이면 스크롤하지 않는다", () => {
      const scroll = vi.fn();
      Element.prototype.scrollIntoView = scroll;
      vi.stubGlobal("innerHeight", 700);
      const rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");

      rect.mockReturnValue({ top: 900, bottom: 960 } as DOMRect); // 화면 아래
      const first = render(<TierTileGrid tiles={all} average={5.8} order="hard" label="난이도 목록" />);
      expect(scroll).toHaveBeenCalledTimes(1);
      expect(scroll).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
      first.unmount();

      resetTableTilesForTest();
      sessionStorage.clear();
      scroll.mockClear();
      rect.mockReturnValue({ top: 100, bottom: 160 } as DOMRect); // 화면 안
      render(<TierTileGrid tiles={all} average={5.8} order="hard" label="난이도 목록" />);
      expect(scroll).not.toHaveBeenCalled();
    });

    it("돌아왔을 때는 화면 밖이어도 다시 스크롤하지 않고, 움직임 줄이기면 부드러운 스크롤을 쓰지 않는다", () => {
      const scroll = vi.fn();
      Element.prototype.scrollIntoView = scroll;
      vi.stubGlobal("innerHeight", 700);
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: -80, bottom: -20 } as DOMRect);
      stubMotion(true);
      const first = render(<TierTileGrid tiles={all} average={5.8} order="hard" label="난이도 목록" />);
      expect(scroll).toHaveBeenCalledWith({ block: "center", behavior: "auto" });
      first.unmount();
      scroll.mockClear();
      render(<TierTileGrid tiles={all} average={5.8} order="hard" label="난이도 목록" />);
      expect(scroll).not.toHaveBeenCalled();
    });
  });
  describe("폴더 왕복 복원 (PR 2)", () => {
    const tiles = all; // 평균 5.8 근처에서 먼 쪽이 접힌다

    it("타일을 누르면 보기 상태 쿼리·스크롤 위치·접힘 상태를 기억한다", () => {
      Object.defineProperty(window, "scrollY", { value: 321, configurable: true });
      render(<TierTileGrid tiles={tiles} average={5.8} order="hard" label="난이도 목록" returnQuery="rec=all" />);
      fireEvent.click(screen.getByRole("button", { name: /더 높은 난이도/ })); // 접힘을 펼친다
      fireEvent.click(link("5.8"));
      expect(readTableReturn()).toEqual({ query: "rec=all", scrollY: 321, unfolded: true });
    });

    it("기억이 있으면 접힘 상태와 스크롤 위치를 되살리고, 첫 진입 연출(빛남·자동 스크롤)은 하지 않는다", () => {
      const scrollTo = vi.fn();
      vi.stubGlobal("scrollTo", scrollTo);
      const scrollIntoView = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoView;
      onTestFinished(() => void Reflect.deleteProperty(Element.prototype, "scrollIntoView")); // jsdom에는 원래 없다
      rememberTableReturn({ query: "", scrollY: 480, unfolded: true });
      render(<TierTileGrid tiles={tiles} average={5.8} order="hard" label="난이도 목록" />);
      expect(screen.getByRole("button", { name: /접기/ })).toHaveAttribute("aria-expanded", "true"); // 펼쳐 둔 채로 돌아온다
      expect(scrollTo).toHaveBeenCalledWith({ top: 480, behavior: "instant" });
      expect(scrollIntoView).not.toHaveBeenCalled();
      expect(link("5.8")).not.toHaveClass("tile-glow");
      expect(readTableReturn()).toBeNull(); // 한 번 되살린 뒤에는 지운다
    });

    it("기억이 없으면 스크롤을 건드리지 않는다", () => {
      const scrollTo = vi.fn();
      vi.stubGlobal("scrollTo", scrollTo);
      render(<TierTileGrid tiles={tiles} average={null} order="hard" label="난이도 목록" />);
      expect(scrollTo).not.toHaveBeenCalled();
    });
  });
});
