import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ja from "../../messages/ja.json";
import ko from "../../messages/ko.json";
import { AverageLevelHelp, HelpTip } from "@/components/HelpTip";

const BODY =
  "내 레이팅 목록에 들어 있는 곡들의 서열표 기준 난이도를 평균낸 값입니다. 이 값 근처의 폴더가 지금 내 실력에 가장 가까운 구간입니다. 기록이 아직 적으면 표시되지 않습니다.";

describe("내 평균 난이도 ? 설명 (AverageLevelHelp)", () => {
  it("처음에는 ? 버튼만 있고, 누르면 제목·본문·닫기가 든 설명 상자가 열린다(확정 문구 그대로)", () => {
    render(<AverageLevelHelp />);
    const button = screen.getByRole("button", { name: "내 평균 난이도 설명 보기" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).not.toHaveAttribute("aria-controls");
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(button);
    const panel = screen.getByRole("dialog", { name: "내 평균 난이도" });
    expect(panel).toHaveTextContent("내 평균 난이도");
    expect(panel).toHaveTextContent(BODY);
    expect(screen.getByRole("button", { name: "닫기" })).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAttribute("aria-controls", panel.id);
  });

  it("호버로는 열리지 않는다", () => {
    render(<AverageLevelHelp />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "내 평균 난이도 설명 보기" }));
    fireEvent.mouseOver(screen.getByRole("button", { name: "내 평균 난이도 설명 보기" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("버튼을 다시 누르면 닫힌다", () => {
    render(<AverageLevelHelp />);
    const button = screen.getByRole("button", { name: "내 평균 난이도 설명 보기" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("바깥을 누르면 닫히지만 상자 안을 누르면 닫히지 않는다", () => {
    render(
      <div>
        <AverageLevelHelp />
        <p>바깥</p>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "내 평균 난이도 설명 보기" }));
    fireEvent.pointerDown(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByText("바깥"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Esc와 `닫기`는 상자를 닫고 포커스를 ? 버튼으로 돌린다", () => {
    render(<AverageLevelHelp />);
    const button = screen.getByRole("button", { name: "내 평균 난이도 설명 보기" });
    fireEvent.click(button);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(button).toHaveFocus();

    fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(button).toHaveFocus();
  });

  it("눈에 보이는 ?는 장식(aria-hidden)이고, 누르는 영역은 44px, 보이는 원은 20px이며 음수 마진으로 줄 높이를 키우지 않는다", () => {
    render(<AverageLevelHelp />);
    const button = screen.getByRole("button", { name: "내 평균 난이도 설명 보기" });
    expect(button).toHaveClass("h-11", "w-11", "-m-3");
    const mark = button.querySelector("[aria-hidden='true']");
    expect(mark).toHaveTextContent("?");
    expect(mark).toHaveClass("h-5", "w-5");
  });

  it("색은 토큰만 쓴다(색 값을 직접 쓰지 않는다)", () => {
    render(<AverageLevelHelp />);
    fireEvent.click(screen.getByRole("button", { name: "내 평균 난이도 설명 보기" }));
    const html = document.body.innerHTML;
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}\b|rgb\(/);
  });

  it("글자는 부모의 줄바꿈 금지를 물려받지 않는다", () => {
    render(
      <p className="whitespace-nowrap">
        <AverageLevelHelp />
      </p>,
    );
    fireEvent.click(screen.getByRole("button", { name: "내 평균 난이도 설명 보기" }));
    expect(screen.getByRole("dialog")).toHaveClass("whitespace-normal");
  });
});

describe("HelpTip 위치 (360px)", () => {
  const widthBefore = window.innerWidth;
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 360 });
  });
  afterEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: widthBefore });
    vi.restoreAllMocks();
  });

  function mockRect(left: number) {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      left, right: left + 20, top: 0, bottom: 20, width: 20, height: 20, x: left, y: 0, toJSON: () => ({}),
    });
  }

  it("? 가 화면 가운데쯤에 있으면 상자를 ? 가운데 기준으로 놓되 화면 안(좌우 16px)으로 민다, 화살표는 ? 가운데를 가리킨다", () => {
    mockRect(170); // ? 가운데 = 180
    render(<HelpTip title="제목" body="본문" ariaLabel="설명 보기" />);
    fireEvent.click(screen.getByRole("button", { name: "설명 보기" }));
    const panel = screen.getByRole("dialog");
    // 폭 = min(320, 360 − 32) = 320. 가운데 맞춤 왼쪽 = 20(16~24 안) → 루트 기준 −150
    expect(panel).toHaveStyle({ width: "320px", left: "-150px" });
    const arrow = panel.querySelector("span[aria-hidden='true']") as HTMLElement;
    expect(arrow.style.left).toBe("154px"); // 화살표 가운데 160 − 6
    // 상자는 화면 안: 왼쪽 20 ≥ 16, 오른쪽 340 ≤ 344
    expect(170 - 150).toBeGreaterThanOrEqual(16);
    expect(170 - 150 + 320).toBeLessThanOrEqual(360 - 16);
  });

  it("? 가 왼쪽 끝 가까이(4px)에 있어도 왼쪽 16px 안으로 들어오고, 오른쪽 끝(330px)에 있어도 오른쪽 16px 안으로 들어온다", () => {
    mockRect(4);
    const { unmount } = render(<HelpTip title="제목" body="본문" ariaLabel="설명 보기" />);
    fireEvent.click(screen.getByRole("button", { name: "설명 보기" }));
    expect(screen.getByRole("dialog")).toHaveStyle({ left: "12px" }); // 화면 왼쪽 16 = 루트 4 + 12
    unmount();

    mockRect(330);
    render(<HelpTip title="제목" body="본문" ariaLabel="설명 보기" />);
    fireEvent.click(screen.getByRole("button", { name: "설명 보기" }));
    expect(screen.getByRole("dialog")).toHaveStyle({ left: "-306px" }); // 화면 왼쪽 24 = 루트 330 − 306 (24+320=344 = 360−16)
  });

  it("320px처럼 더 좁으면 상자 폭이 화면 폭 − 32px로 줄어든다", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 320 });
    mockRect(150);
    render(<HelpTip title="제목" body="본문" ariaLabel="설명 보기" />);
    fireEvent.click(screen.getByRole("button", { name: "설명 보기" }));
    expect(screen.getByRole("dialog")).toHaveStyle({ width: "288px" });
  });
});

describe("메시지", () => {
  type Dict = Record<string, unknown>;
  const placeholders = (s: unknown) => String(s).match(/\{\w+\}/g)?.sort() ?? [];

  it("ko/ja 모두 AverageHelp 문구가 있고 키와 자리표시자가 같다", () => {
    const koHelp = (ko as unknown as Dict).AverageHelp as Record<string, string>;
    const jaHelp = (ja as unknown as Dict).AverageHelp as Record<string, string>;
    expect(Object.keys(jaHelp).sort()).toEqual(Object.keys(koHelp).sort());
    for (const key of Object.keys(koHelp)) {
      expect(jaHelp[key]).toBeTruthy();
      expect(placeholders(jaHelp[key])).toEqual(placeholders(koHelp[key]));
    }
    expect(koHelp.body).toBe(BODY);
    expect(koHelp.title).toBe("내 평균 난이도");
  });

  it("ja 문구는 앱의 일본어 용어(難易度表·基準難易度·フォルダ)를 쓰고 `序列表`는 쓰지 않는다", () => {
    const jaHelp = (ja as unknown as Dict).AverageHelp as Record<string, string>;
    expect(jaHelp.body).toContain("難易度表");
    expect(jaHelp.body).toContain("基準難易度");
    expect(jaHelp.body).toContain("フォルダ");
    expect(jaHelp.body).not.toContain("序列表");
    expect(jaHelp.title).toBe("自分の平均難易度");
  });
});
