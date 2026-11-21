import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { TierTileGrid, type TierTile } from "@/components/table/TierTileGrid";
import { resetTableTilesForTest } from "@/lib/table-tiles";
import { readTableReturn, rememberTableReturn } from "@/lib/table-view-state";

/** 단계 개수를 생략하면 모두 0(기록 없음·단계 분포 없음)인 타일 */
function tile(tier: number, total: number, recorded: number, stages: Partial<Pick<TierTile, "exc" | "fc" | "ss" | "sPlus" | "s" | "belowS">> = {}): TierTile {
  return { tier, total, recorded, exc: 0, fc: 0, ss: 0, sPlus: 0, s: 0, belowS: 0, ...stages };
}

/** 4.9 ~ 7.0 (0.1 단위) 22칸. 기록은 모두 비워 둔다 */
const all: TierTile[] = Array.from({ length: 22 }, (_, i) => tile((49 + i) / 10, 10, 0));

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

  it("타일에는 난이도 숫자와 기록/전체, 아래 단계 분포 막대가 있고 누르면 그 난이도 폴더로 간다 (3열, 480px 이상 4열)", () => {
    render(<TierTileGrid tiles={[tile(5.8, 10, 4, { s: 1, belowS: 3 })]} average={null} order="hard" label="난이도 목록" />);
    const list = screen.getByRole("list", { name: "난이도 목록" });
    expect(list).toHaveClass("grid-cols-3", "min-[480px]:grid-cols-4");
    const t = screen.getByRole("link");
    expect(t).toHaveAttribute("href", "/table/folder/5.8");
    expect(t.textContent).toBe("5.8 4/10"); // 막대는 글자가 없는 장식(aria-hidden)이다
    // 막대: 높이 3px, 기록 10곡 중 S 1곡(10%)·S 미만 3곡(30%)이 칸 너비로 나온다
    const bar = t.querySelector("[data-stage-bar]") as HTMLElement;
    expect(bar).toHaveClass("h-[3px]");
    expect(bar.parentElement).toHaveAttribute("aria-hidden", "true");
    expect([...bar.children].map((c) => [c.getAttribute("data-stage"), (c as HTMLElement).style.width])).toEqual([
      ["S", "10%"],
      ["A", "30%"],
    ]);
    // 전곡 완료가 아니라서 위쪽 선·`S↑` 글자는 없다
    expect(t.querySelector("[data-full-line]")).toBeNull();
    expect(t.querySelector("[data-full-stage]")).toBeNull();
  });

  it("기록이 없는 타일은 `기록 없음` + 점선 윤곽 + 흐린 글자이고, 막대는 빈 바탕뿐이다", () => {
    render(<TierTileGrid tiles={[tile(6.0, 12, 0)]} average={null} order="hard" label="난이도 목록" />);
    const t = screen.getByRole("link");
    expect(t.textContent).toBe("6.0 기록 없음");
    expect(t).toHaveClass("border-dashed");
    expect(t.querySelector(".text-fg-dim")).not.toBeNull();
    expect(t.querySelector("[data-stage-bar]")?.children).toHaveLength(0);
  });

  describe("전곡 기록(완료) 효과 (D92, 시안 F안)", () => {
    it("전곡 S 이상이면 위쪽 선(가장 낮은 단계 색) + 숫자 단계색 + 옅은 배경 + `S+↑` 글자 + 숨은 글자가 붙는다", () => {
      // 21곡 전부 기록: S+ 5곡, SS 10곡, FC 6곡 → 가장 낮은 단계는 S+
      render(<TierTileGrid tiles={[tile(5.9, 21, 21, { sPlus: 5, ss: 10, fc: 6 })]} average={null} order="hard" label="난이도 목록" />);
      const t = screen.getByRole("link");
      const li = screen.getByRole("listitem");
      expect(li).toHaveAttribute("data-done", "true");
      expect(t).toHaveAttribute("data-stage", "S+");
      expect(t.querySelector("[data-full-line]")).toHaveAttribute("data-stage", "S+");
      expect(t.querySelector("[data-full-line]")).toHaveClass("stage-bar", "h-[3px]", "inset-x-0", "top-0");
      expect(t.querySelector("span.font-num.text-lg")).toHaveClass("stage-text");
      expect(t.className).toContain("var(--done-tint)");
      const mark = t.querySelector("[data-full-stage]") as HTMLElement;
      expect(mark).toHaveAttribute("data-full-stage", "S+");
      expect(mark.querySelector("[aria-hidden='true']")).toHaveTextContent("S+↑");
      expect(within(mark).getByText(/모든 채보가 S\+ 이상입니다/)).toHaveClass("sr-only");
      expect(within(t).getByText("완료")).toHaveClass("sr-only");
      expect(t).toHaveTextContent("21/21");
    });

    it("전곡 EXC는 화살표 없이 `EXC`이고 숫자와 글자가 그라데이션 글자(stage-grad-text)다", () => {
      render(<TierTileGrid tiles={[tile(5.0, 16, 16, { exc: 16 })]} average={null} order="hard" label="난이도 목록" />);
      const t = screen.getByRole("link");
      expect(t).toHaveAttribute("data-stage", "EXC");
      expect(t.querySelector("span.font-num.text-lg")).toHaveClass("stage-grad-text");
      const mark = t.querySelector("[data-full-stage]") as HTMLElement;
      expect(mark).toHaveClass("stage-grad-text");
      expect(mark.querySelector("[aria-hidden='true']")?.textContent).toBe("EXC");
      expect(within(mark).getByText(/모든 채보가 EXC입니다/)).toHaveClass("sr-only");
    });

    it("일부만 기록했으면 선·글자·완료가 없다 (기록 수 한 곡 모자란 경계)", () => {
      render(<TierTileGrid tiles={[tile(5.5, 52, 51, { ss: 51 })]} average={null} order="hard" label="난이도 목록" />);
      const t = screen.getByRole("link");
      expect(screen.getByRole("listitem")).not.toHaveAttribute("data-done");
      expect(t).not.toHaveAttribute("data-stage");
      expect(t.querySelector("[data-full-line]")).toBeNull();
      expect(t.querySelector("[data-full-stage]")).toBeNull();
      expect(within(t).queryByText("완료")).toBeNull();
      expect(t.className).not.toContain("var(--done-tint)");
    });

    it("전체가 0이면 완료가 아니다", () => {
      render(<TierTileGrid tiles={[tile(5.2, 0, 0)]} average={null} order="hard" label="난이도 목록" />);
      expect(screen.getByRole("listitem")).not.toHaveAttribute("data-done");
    });

    it("전곡 기록이지만 S 미만(A/B/C)이 섞이면 단계를 정할 수 없어 선·글자 없이 숫자만 완료 색이다 (홈과 같은 규칙)", () => {
      render(<TierTileGrid tiles={[tile(5.1, 4, 4, { ss: 3, belowS: 1 })]} average={null} order="hard" label="난이도 목록" />);
      const t = screen.getByRole("link");
      expect(screen.getByRole("listitem")).toHaveAttribute("data-done", "true");
      expect(t).not.toHaveAttribute("data-stage");
      expect(t.querySelector("[data-full-line]")).toBeNull();
      expect(t.querySelector("[data-full-stage]")).toBeNull();
      expect(t.querySelector("span.font-num.text-lg")).toHaveClass("text-done-text");
    });

    it("색은 CSS 변수만 쓴다: 컴포넌트 클래스·style에 색 값(#, rgb)이 없다", () => {
      render(<TierTileGrid tiles={[tile(5.9, 3, 3, { s: 3 }), tile(5.8, 3, 1, { s: 1 })]} average={5.8} order="hard" label="난이도 목록" />);
      const html = document.body.innerHTML;
      expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(html).not.toMatch(/rgba?\(/);
    });
  });

  it("평균 타일은 주황 윤곽과 숨은 글자 `내 평균 난이도`가 붙고 하나뿐이다", () => {
    render(<TierTileGrid tiles={all} average={5.8} order="hard" label="난이도 목록" />);
    const marked = document.querySelectorAll("[data-average='true']");
    expect(marked).toHaveLength(1);
    expect(marked[0]).toHaveTextContent("5.8");
    expect(marked[0]).toHaveClass("outline", "outline-2", "outline-weak"); // border가 아니라 outline이라 다른 타일과 높이가 같다
    expect(marked[0]).not.toHaveClass("border-2");
    expect(marked[0].textContent).not.toContain("내 평균 난이도 "); // 눈에 보이는 `내 평균` 글자는 없다(숨은 글자만)
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
      expect(avg).toHaveClass("outline-weak");
    });

    it("움직임 줄이기 설정이면 빛남 없이 윤곽만 있다", () => {
      stubMotion(true);
      render(<TierTileGrid tiles={all} average={5.8} order="hard" label="난이도 목록" />);
      const avg = document.querySelector("[data-average='true']");
      expect(avg).not.toHaveClass("tile-glow");
      expect(avg).toHaveClass("outline-2", "outline-weak");
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
