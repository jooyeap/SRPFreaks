import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FilterCarryNotice } from "@/components/table/FilterCarryNotice";
import { FILTER_NOTICE_IDLE_MS, FILTER_NOTICE_MAX_MS } from "@/lib/folder-filter-carry";
import ko from "../../../messages/ko.json";
import ja from "../../../messages/ja.json";

/** 안내 내용은 영역이 그려진 다음 틱에 들어온다 */
const show = (props: { show: boolean; onReset?: () => void }) => {
  const view = render(<FilterCarryNotice show={props.show} onReset={props.onReset ?? vi.fn()} />);
  act(() => void vi.advanceTimersByTime(0));
  return view;
};
const notice = () => screen.queryByTestId("filter-carry-notice");

describe("FilterCarryNotice (D99)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("show가 아니면 내용이 없고, 영역(role=status, aria-live=polite)만 있다", () => {
    show({ show: false });
    expect(notice()).toBeNull();
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("show면 문구와 `초기화` 버튼(44px 이상)이 뜬다", () => {
    show({ show: true });
    expect(screen.getByText("필터가 적용되어 있습니다. 초기화할까요?")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "필터 초기화" });
    expect(button).toHaveTextContent("초기화");
    expect(button.className).toContain("min-h-11");
    expect(button.className).toContain("min-w-11");
  });

  it("입력이 없으면 5초 뒤 사라진다", () => {
    show({ show: true });
    act(() => void vi.advanceTimersByTime(FILTER_NOTICE_IDLE_MS - 1));
    expect(notice()).not.toBeNull();
    act(() => void vi.advanceTimersByTime(1));
    expect(notice()).toBeNull();
  });

  it("입력(누르기·스크롤·키)이 있으면 그때부터 5초를 다시 센다", () => {
    show({ show: true });
    act(() => void vi.advanceTimersByTime(4000));
    fireEvent.scroll(window);
    act(() => void vi.advanceTimersByTime(4000));
    expect(notice()).not.toBeNull(); // 처음부터 세면 8초라 사라졌어야 한다
    fireEvent.keyDown(document.body, { key: "a" });
    act(() => void vi.advanceTimersByTime(4000));
    expect(notice()).not.toBeNull();
    act(() => void vi.advanceTimersByTime(1000));
    expect(notice()).toBeNull();
  });

  it("입력이 계속 이어져도 최대 시간이 되면 사라진다", () => {
    show({ show: true });
    for (let elapsed = 0; elapsed < FILTER_NOTICE_MAX_MS - 1000; elapsed += 1000) {
      act(() => void vi.advanceTimersByTime(1000));
      fireEvent.pointerDown(document.body);
    }
    expect(notice()).not.toBeNull();
    act(() => void vi.advanceTimersByTime(1000));
    expect(notice()).toBeNull();
  });

  it("안내 위에 손가락(마우스)이 있거나 포커스가 있는 동안은 멈추고, 떠나면 다시 센다", () => {
    show({ show: true });
    fireEvent.pointerEnter(notice()!);
    act(() => void vi.advanceTimersByTime(FILTER_NOTICE_IDLE_MS * 2));
    expect(notice()).not.toBeNull();
    fireEvent.pointerLeave(notice()!);
    act(() => void vi.advanceTimersByTime(FILTER_NOTICE_IDLE_MS));
    expect(notice()).toBeNull();
  });

  it("포커스가 안에 있으면 멈춘다", () => {
    show({ show: true });
    const button = screen.getByRole("button", { name: "필터 초기화" });
    fireEvent.focus(button);
    act(() => void vi.advanceTimersByTime(FILTER_NOTICE_IDLE_MS * 2));
    expect(notice()).not.toBeNull();
    fireEvent.blur(button);
    act(() => void vi.advanceTimersByTime(FILTER_NOTICE_IDLE_MS));
    expect(notice()).toBeNull();
  });

  it("`초기화` 버튼을 누르면 onReset을 한 번 부르고 사라진다", () => {
    const onReset = vi.fn();
    show({ show: true, onReset });
    fireEvent.click(screen.getByRole("button", { name: "필터 초기화" }));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(notice()).toBeNull();
  });

  it("안내 자체를 눌러도 초기화하고 사라진다", () => {
    const onReset = vi.fn();
    show({ show: true, onReset });
    fireEvent.click(screen.getByText("필터가 적용되어 있습니다. 초기화할까요?"));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(notice()).toBeNull();
  });

  it("색만으로 전하지 않는다: 아이콘 글자 i와 문구가 같이 있고, 색은 변수 토큰만 쓴다", () => {
    show({ show: true });
    expect(notice()!.textContent).toContain("i");
    expect(notice()!.className).not.toMatch(/#[0-9a-f]{3,6}/i);
  });

  it("ko·ja 문구가 모두 있다", () => {
    expect(ko.Table.filterCarryNotice).toBe("필터가 적용되어 있습니다. 초기화할까요?");
    expect(ko.Table.filterCarryReset).toBe("초기화");
    expect(ja.Table.filterCarryNotice.length).toBeGreaterThan(0);
    expect(ja.Table.filterCarryReset.length).toBeGreaterThan(0);
  });
});
