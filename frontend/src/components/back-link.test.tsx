import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackLink } from "@/components/BackLink";
import { AppNavigationTracker } from "@/components/AppNavigationTracker";
import { canGoBackInApp, noteAppNavigation, resetAppHistoryForTest } from "@/lib/app-history";

// 뒤로 버튼(D67 개정): 같은 사이트 안에서 들어왔으면 history 한 칸 뒤로, 직접 진입이면 폴백 주소로 간다.
// next/navigation은 pathname만 가짜로 끼운다(Tracker). BackLink는 라우터 컨텍스트 없이 동작해야 한다.
const nav = vi.hoisted(() => ({ pathname: "/players/7/compare" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

function setNavigationApi(value: unknown) {
  Object.defineProperty(window, "navigation", { value, configurable: true, writable: true });
}

function renderBack() {
  return render(
    <BackLink fallbackHref="/players/7" ariaLabel="뒤로">
      <span>←</span>
    </BackLink>,
  );
}

describe("BackLink / app-history", () => {
  let back: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    resetAppHistoryForTest();
    nav.pathname = "/players/7/compare";
    // jsdom은 history.back()을 비동기로 처리해서 호출 여부만 본다
    back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
  });
  afterEach(() => {
    back.mockRestore();
    Reflect.deleteProperty(window, "navigation");
  });

  it("Navigation API가 되돌아갈 칸이 있다고 하면 가로채서 history 한 칸 뒤로 간다", () => {
    setNavigationApi({ canGoBack: true });
    renderBack();
    const link = screen.getByRole("link", { name: "뒤로" });
    const notPrevented = fireEvent.click(link);
    expect(back).toHaveBeenCalledTimes(1);
    expect(notPrevented).toBe(false); // preventDefault로 폴백 주소로 가지 않는다
  });

  it("되돌아갈 칸이 없으면(직접 진입) 가로채지 않고 폴백 주소(`/players/{id}`)로 간다", () => {
    setNavigationApi({ canGoBack: false });
    renderBack();
    const link = screen.getByRole("link", { name: "뒤로" });
    expect(link).toHaveAttribute("href", "/players/7");
    const notPrevented = fireEvent.click(link);
    expect(back).not.toHaveBeenCalled();
    expect(notPrevented).toBe(true); // 기본 동작(링크 이동)이 그대로 일어난다
  });

  it("Navigation API가 없는 브라우저: 앱 안에서 이동한 적이 없으면 폴백, 있으면 뒤로", () => {
    renderBack();
    const link = screen.getByRole("link", { name: "뒤로" });
    expect(canGoBackInApp()).toBe(false);
    expect(fireEvent.click(link)).toBe(true);
    expect(back).not.toHaveBeenCalled();

    noteAppNavigation();
    expect(canGoBackInApp()).toBe(true);
    expect(fireEvent.click(link)).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("Navigation API 접근이 실패해도(getter가 던짐) 폴백으로 동작한다", () => {
    Object.defineProperty(window, "navigation", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    renderBack();
    const link = screen.getByRole("link", { name: "뒤로" });
    expect(canGoBackInApp()).toBe(false);
    expect(fireEvent.click(link)).toBe(true);
    expect(back).not.toHaveBeenCalled();
  });

  it("history.back() 자체가 던지면 가로채지 않고 폴백 주소로 간다", () => {
    setNavigationApi({ canGoBack: true });
    back.mockImplementation(() => {
      throw new Error("denied");
    });
    renderBack();
    expect(fireEvent.click(screen.getByRole("link", { name: "뒤로" }))).toBe(true);
  });

  it("수정키·가운데 버튼 클릭(새 탭 열기)은 건드리지 않는다", () => {
    setNavigationApi({ canGoBack: true });
    renderBack();
    const link = screen.getByRole("link", { name: "뒤로" });
    expect(fireEvent.click(link, { ctrlKey: true })).toBe(true);
    expect(fireEvent.click(link, { metaKey: true })).toBe(true);
    expect(fireEvent.click(link, { shiftKey: true })).toBe(true);
    expect(fireEvent.click(link, { button: 1 })).toBe(true);
    expect(back).not.toHaveBeenCalled();
  });

  it("AppNavigationTracker: 처음 그린 주소는 세지 않고, pathname이 바뀔 때만 센다(쿼리만 바뀌는 replace는 세지 않는다)", () => {
    nav.pathname = "/players/7/compare";
    const { rerender } = render(<AppNavigationTracker />);
    expect(canGoBackInApp()).toBe(false); // 처음 진입
    rerender(<AppNavigationTracker />); // 같은 주소(탭·차트 전환은 pathname이 같다)
    expect(canGoBackInApp()).toBe(false);
    nav.pathname = "/songs/3";
    rerender(<AppNavigationTracker />);
    expect(canGoBackInApp()).toBe(true);
  });
});
