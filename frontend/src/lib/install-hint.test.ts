import { afterEach, describe, expect, it, vi } from "vitest";
import { dismissInstallHint, isInstallHintDismissed, isIosSafari, resetInstallHintForTest } from "@/lib/install-hint";

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const MAC_SAFARI = IPAD_DESKTOP_UA;

describe("isIosSafari", () => {
  it("iPhone Safari는 맞고, iOS의 다른 브라우저와 앱 안 브라우저는 아니다", () => {
    expect(isIosSafari(IPHONE_SAFARI, "iPhone", 5)).toBe(true);
    expect(isIosSafari(IPHONE_CHROME, "iPhone", 5)).toBe(false);
    expect(isIosSafari(`${IPHONE_SAFARI} Instagram 300.0`, "iPhone", 5)).toBe(false);
  });
  it("iPadOS는 UA가 Mac으로 와서 터치점이 있을 때만 iOS로 본다", () => {
    expect(isIosSafari(IPAD_DESKTOP_UA, "MacIntel", 5)).toBe(true);
    expect(isIosSafari(MAC_SAFARI, "MacIntel", 0)).toBe(false); // 진짜 Mac
  });
  it("Android는 아니다", () => {
    expect(isIosSafari(ANDROID_CHROME, "Linux armv8l", 5)).toBe(false);
  });
});

describe("닫음 저장", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetInstallHintForTest();
  });

  it("처음에는 닫지 않은 상태이고, 닫으면 불리언 하나('1')만 저장한다", () => {
    expect(isInstallHintDismissed()).toBe(false);
    dismissInstallHint();
    expect(isInstallHintDismissed()).toBe(true);
    expect(localStorage.getItem("srp.installHintSeen")).toBe("1");
    expect(localStorage.length).toBe(1); // 다른 값은 저장하지 않는다
  });

  it("localStorage 읽기·쓰기가 막혀도 오류 없이 이번 방문 동안은 닫은 상태로 기억한다", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(isInstallHintDismissed()).toBe(false); // 못 읽으면 닫지 않은 것으로 본다
    expect(() => dismissInstallHint()).not.toThrow();
    expect(isInstallHintDismissed()).toBe(true); // 메모리에는 남는다
  });
});
