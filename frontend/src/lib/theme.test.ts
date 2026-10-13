import { describe, expect, it } from "vitest";
import { oppositeTheme, parseTheme, THEME_STORAGE_KEY, themeInitScript } from "@/lib/theme";

describe("parseTheme", () => {
  it("light와 dark만 통과시킨다", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
  });

  it("그 밖의 값, 빈 값, 대소문자 다른 값은 null이다", () => {
    expect(parseTheme(null)).toBeNull();
    expect(parseTheme(undefined)).toBeNull();
    expect(parseTheme("")).toBeNull();
    expect(parseTheme("Dark")).toBeNull();
    expect(parseTheme("<script>")).toBeNull();
  });
});

describe("oppositeTheme", () => {
  it("다크와 라이트를 서로 바꾼다", () => {
    expect(oppositeTheme("dark")).toBe("light");
    expect(oppositeTheme("light")).toBe("dark");
  });
});

describe("themeInitScript (첫 화면 전에 실행되는 스크립트)", () => {
  const run = () => new Function(themeInitScript)();

  it("저장된 테마가 있으면 <html data-theme>에 붙인다", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    run();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("저장된 값이 올바르지 않으면 아무것도 붙이지 않는다", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "hacked");
    run();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("저장된 값이 없으면 아무것도 붙이지 않는다 (시스템 설정을 따른다)", () => {
    run();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("저장소를 읽을 때 예외가 나도 화면이 깨지지 않는다", () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    try {
      expect(run).not.toThrow();
    } finally {
      Storage.prototype.getItem = original;
    }
  });
});
