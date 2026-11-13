import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstallPrompt } from "@/components/InstallPrompt";
import { resetInstallHintForTest } from "@/lib/install-hint";

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";

/** matchMedia 가짜: 쿼리별로 맞는지 정한다. */
function mockMedia(matches: { coarse?: boolean; standalone?: boolean }) {
  vi.stubGlobal(
    "matchMedia",
    (query: string) => ({
      matches: query.includes("pointer: coarse") ? !!matches.coarse : query.includes("display-mode: standalone") ? !!matches.standalone : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  );
}

// jsdom에는 없는 속성(maxTouchPoints, standalone)도 있어서 spyOn 대신 defineProperty로 덮어쓴다(afterEach에서 되돌린다)
const NAV_KEYS = ["userAgent", "platform", "maxTouchPoints", "standalone"] as const;
function setNavigator(userAgent: string, platform: string, standalone?: boolean) {
  const values = { userAgent, platform, maxTouchPoints: 5, standalone };
  for (const key of NAV_KEYS) Object.defineProperty(window.navigator, key, { value: values[key], configurable: true });
}
function resetNavigator() {
  for (const key of NAV_KEYS) delete (window.navigator as unknown as Record<string, unknown>)[key];
}

/** Android 설치 가능 이벤트를 보낸다. prompt가 불렸는지 확인하려고 함수를 돌려준다. */
function fireBeforeInstallPrompt(outcome: "accepted" | "dismissed" = "accepted") {
  const prompt = vi.fn(() => Promise.resolve());
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome }) });
  act(() => {
    window.dispatchEvent(event);
  });
  return { prompt, event };
}

describe("InstallPrompt", () => {
  beforeEach(() => {
    resetInstallHintForTest();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetNavigator();
  });

  it("터치 기기가 아니면(PC 마우스) iPhone UA여도 아무것도 그리지 않는다", () => {
    mockMedia({ coarse: false });
    setNavigator(IPHONE_SAFARI, "iPhone");
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it("iPhone Safari(터치): 공유 버튼 안내 문구와 `나중에`만 보이고 `추가하기`는 없다", () => {
    mockMedia({ coarse: true });
    setNavigator(IPHONE_SAFARI, "iPhone");
    render(<InstallPrompt />);
    expect(screen.getByText(/Safari 공유 버튼 → 홈 화면에 추가/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "나중에" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "추가하기" })).toBeNull();
  });

  it("Android(터치): 설치 가능 이벤트가 오기 전에는 안 보이고, 오면 `추가하기`가 나온다", () => {
    mockMedia({ coarse: true });
    setNavigator(ANDROID_CHROME, "Linux armv8l");
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
    const { event } = fireBeforeInstallPrompt();
    expect(event.defaultPrevented).toBe(true); // 브라우저 기본 안내를 막아 두었다
    expect(screen.getByRole("button", { name: "추가하기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "나중에" })).toBeInTheDocument();
  });

  it("`추가하기`를 누르면 설치 창을 띄우고, 이후 다시 보이지 않는다(처음 한 번만)", async () => {
    mockMedia({ coarse: true });
    setNavigator(ANDROID_CHROME, "Linux armv8l");
    const { container } = render(<InstallPrompt />);
    const { prompt } = fireBeforeInstallPrompt("accepted");
    fireEvent.click(screen.getByRole("button", { name: "추가하기" }));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("srp.installHintSeen")).toBe("1");
  });

  it("`나중에`로 닫으면 사라지고, 다시 그려도(재방문) 보이지 않는다", () => {
    mockMedia({ coarse: true });
    setNavigator(IPHONE_SAFARI, "iPhone");
    const first = render(<InstallPrompt />);
    fireEvent.click(screen.getByRole("button", { name: "나중에" }));
    expect(first.container).toBeEmptyDOMElement();
    expect(localStorage.getItem("srp.installHintSeen")).toBe("1");
    first.unmount();
    const second = render(<InstallPrompt />);
    expect(second.container).toBeEmptyDOMElement();
  });

  it("이미 홈 화면 앱(display-mode: standalone)으로 열었으면 보이지 않는다", () => {
    mockMedia({ coarse: true, standalone: true });
    setNavigator(IPHONE_SAFARI, "iPhone");
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it("iOS의 navigator.standalone이 true여도 보이지 않는다", () => {
    mockMedia({ coarse: true });
    setNavigator(IPHONE_SAFARI, "iPhone", true);
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it("localStorage가 막혀 있어도 오류 없이 그려지고, 닫으면 이번 방문 동안은 숨는다", () => {
    mockMedia({ coarse: true });
    setNavigator(IPHONE_SAFARI, "iPhone");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const { container } = render(<InstallPrompt />);
    expect(screen.getByRole("button", { name: "나중에" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "나중에" }));
    expect(container).toBeEmptyDOMElement();
  });

  it("누르는 영역은 44px(min-h-11)이다", () => {
    mockMedia({ coarse: true });
    setNavigator(IPHONE_SAFARI, "iPhone");
    render(<InstallPrompt />);
    expect(screen.getByRole("button", { name: "나중에" })).toHaveClass("min-h-11");
  });
});
