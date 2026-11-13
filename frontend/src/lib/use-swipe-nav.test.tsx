import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DETAIL_SWIPE_RULES, type SwipeDirection } from "@/lib/folder-nav";
import { useSwipeNav } from "@/lib/use-swipe-nav";

// 방향 잠금·스크롤 취소·끌기 콜백의 규칙을 훅 단위로 확인한다(D68). 규칙은 곡 상세·서열표 폴더가 쓰는 값(80px, 30°, 가장자리 24px)이다.
const onSwipe = vi.fn<(direction: SwipeDirection) => void>();
const onDrag = vi.fn<(dx: number) => void>();
const onDragEnd = vi.fn<(direction: SwipeDirection | null) => void>();

function Harness({ drag = false }: { drag?: boolean }) {
  const swipe = useSwipeNav({ onSwipe, rules: DETAIL_SWIPE_RULES, ...(drag ? { onDrag, onDragEnd } : {}) });
  return (
    <div data-testid="area" {...swipe}>
      <input data-testid="input" />
    </div>
  );
}

const area = () => screen.getByTestId("area");
const start = (el: Element, x = 200, y = 300) => fireEvent.touchStart(el, { touches: [{ clientX: x, clientY: y }] });
const move = (el: Element, dx: number, dy = 0, x = 200) => fireEvent.touchMove(el, { touches: [{ clientX: x + dx, clientY: 300 + dy }] });
const end = (el: Element, dx: number, dy = 0, x = 200) => fireEvent.touchEnd(el, { changedTouches: [{ clientX: x + dx, clientY: 300 + dy }] });

afterEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true, writable: true });
});

describe("useSwipeNav 규칙", () => {
  it("79px는 무시하고 80px는 인정한다 (왼쪽 = higher, 오른쪽 = lower)", () => {
    render(<Harness />);
    start(area());
    end(area(), -79);
    expect(onSwipe).not.toHaveBeenCalled();
    start(area());
    end(area(), -80);
    expect(onSwipe).toHaveBeenLastCalledWith("higher");
    start(area());
    end(area(), 80);
    expect(onSwipe).toHaveBeenLastCalledWith("lower");
  });

  it("가로축에서 30°는 인정하고 31°는 무시한다", () => {
    render(<Harness />);
    start(area());
    end(area(), -100, 57); // 29.7°
    expect(onSwipe).toHaveBeenCalledTimes(1);
    start(area());
    end(area(), -100, 60); // 31.0°
    expect(onSwipe).toHaveBeenCalledTimes(1);
  });

  it("화면 가장자리 24px 안에서 시작한 쓸기는 무시한다 (왼쪽 23px / 오른쪽 23px), 24px부터는 인정", () => {
    render(<Harness />);
    start(area(), 23);
    end(area(), 100, 0, 23);
    start(area(), window.innerWidth - 23);
    end(area(), -100, 0, window.innerWidth - 23);
    expect(onSwipe).not.toHaveBeenCalled();
    start(area(), 24);
    end(area(), 100, 0, 24);
    expect(onSwipe).toHaveBeenCalledTimes(1);
  });

  it("손가락이 둘이면 시작하지 않고, 쓰는 도중 둘이 되면 이번 쓸기는 끝난다", () => {
    render(<Harness />);
    fireEvent.touchStart(area(), { touches: [{ clientX: 200, clientY: 300 }, { clientX: 260, clientY: 300 }] });
    end(area(), -100);
    expect(onSwipe).not.toHaveBeenCalled();
    start(area());
    fireEvent.touchMove(area(), { touches: [{ clientX: 150, clientY: 300 }, { clientX: 260, clientY: 300 }] });
    end(area(), -100);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("입력 칸에서 시작한 쓸기는 무시한다", () => {
    render(<Harness />);
    start(screen.getByTestId("input"));
    end(screen.getByTestId("input"), -100);
    expect(onSwipe).not.toHaveBeenCalled();
  });
});

describe("useSwipeNav 방향 잠금", () => {
  it("세로로 시작한 쓸기는 중간에 가로로 휘어 80px를 넘어도 이동하지 않는다", () => {
    render(<Harness />);
    start(area());
    move(area(), 4, 30); // 첫 10px 넘김: 세로가 더 큼 -> 세로 잠금
    move(area(), -90, 30);
    end(area(), -90, 30);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("세로로 잠긴 쓸기는 마지막 점이 30° 안쪽이어도 이동하지 않는다", () => {
    render(<Harness />);
    start(area());
    move(area(), 2, 40); // 세로 잠금
    end(area(), -200, 0); // 뗄 때 위치만 보면 완전한 가로
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("가로로 시작한 쓸기는 인정한다", () => {
    render(<Harness />);
    start(area());
    move(area(), -20, 3);
    move(area(), -100, 10);
    end(area(), -100, 10);
    expect(onSwipe).toHaveBeenCalledWith("higher");
  });

  it("처음 10px 이내에서는 방향을 정하지 않는다 (작은 흔들림 뒤 가로로 쓸면 인정)", () => {
    render(<Harness />);
    start(area());
    move(area(), 1, 8); // 10px 이내 -> 아직 잠그지 않음
    move(area(), -60, 5);
    end(area(), -100, 5);
    expect(onSwipe).toHaveBeenCalledWith("higher");
  });

  it("쓰는 도중 페이지가 2px 이상 스크롤되면 이동하지 않는다 (1px은 괜찮다)", () => {
    render(<Harness />);
    start(area());
    Object.defineProperty(window, "scrollY", { value: 1, configurable: true, writable: true });
    move(area(), -50, 0);
    end(area(), -100, 0);
    expect(onSwipe).toHaveBeenCalledTimes(1);
    start(area());
    Object.defineProperty(window, "scrollY", { value: 3, configurable: true, writable: true });
    move(area(), -50, 0);
    end(area(), -100, 0);
    expect(onSwipe).toHaveBeenCalledTimes(1);
  });

  it("touchmove 없이 끝에서 스크롤이 바뀌어 있어도 이동하지 않는다", () => {
    render(<Harness />);
    start(area());
    Object.defineProperty(window, "scrollY", { value: 5, configurable: true, writable: true });
    end(area(), -100, 0);
    expect(onSwipe).not.toHaveBeenCalled();
  });
});

describe("useSwipeNav 끌기 콜백 (onDrag / onDragEnd)", () => {
  it("가로로 잠기기 전에는 onDrag가 오지 않고, 잠긴 뒤부터 시작점 기준 이동량이 온다", () => {
    render(<Harness drag />);
    start(area());
    move(area(), -8, 0);
    expect(onDrag).not.toHaveBeenCalled();
    move(area(), -30, 2);
    move(area(), -55, 2);
    expect(onDrag.mock.calls).toEqual([[-30], [-55]]);
  });

  it("세로로 잠긴 쓸기에서는 onDrag가 오지 않는다", () => {
    render(<Harness drag />);
    start(area());
    move(area(), 2, 40);
    move(area(), -80, 40);
    end(area(), -80, 40);
    expect(onDrag).not.toHaveBeenCalled();
    expect(onDragEnd).not.toHaveBeenCalled();
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("끌기를 시작한 쓸기가 인정되면 onDragEnd(방향)만 부르고 onSwipe는 부르지 않는다", () => {
    render(<Harness drag />);
    start(area());
    move(area(), -30, 0);
    move(area(), -100, 0);
    end(area(), -100, 0);
    expect(onDragEnd).toHaveBeenCalledWith("higher");
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("끌기를 시작한 쓸기가 짧으면 onDragEnd(null)", () => {
    render(<Harness drag />);
    start(area());
    move(area(), -30, 0);
    end(area(), -60, 0);
    expect(onDragEnd).toHaveBeenCalledWith(null);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("끌다가 각도가 30°를 넘게 휘면 onDragEnd(null)", () => {
    render(<Harness drag />);
    start(area());
    move(area(), -30, 0);
    move(area(), -100, 90);
    end(area(), -100, 90);
    expect(onDragEnd).toHaveBeenCalledWith(null);
  });

  it("끌던 중 스크롤되면 즉시 onDragEnd(null), 이후 움직임·끝은 무시한다", () => {
    render(<Harness drag />);
    start(area());
    move(area(), -30, 0);
    Object.defineProperty(window, "scrollY", { value: 4, configurable: true, writable: true });
    move(area(), -60, 0);
    expect(onDragEnd).toHaveBeenCalledTimes(1);
    expect(onDragEnd).toHaveBeenCalledWith(null);
    move(area(), -120, 0);
    end(area(), -120, 0);
    expect(onDragEnd).toHaveBeenCalledTimes(1);
    expect(onDrag).toHaveBeenCalledTimes(1);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("touchcancel이면 끌던 쓸기를 onDragEnd(null)로 끝낸다", () => {
    render(<Harness drag />);
    start(area());
    move(area(), -30, 0);
    fireEvent.touchCancel(area());
    expect(onDragEnd).toHaveBeenCalledWith(null);
  });

  it("touchmove 없이 시작→끝만 온 쓸기는 onSwipe를 바로 부른다", () => {
    render(<Harness drag />);
    start(area());
    end(area(), 100, 0);
    expect(onSwipe).toHaveBeenCalledWith("lower");
    expect(onDragEnd).not.toHaveBeenCalled();
  });
});
