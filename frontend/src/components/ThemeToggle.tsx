"use client";

import { oppositeTheme, parseTheme, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

/** 지금 화면에 적용된 테마. data-theme이 없으면 브라우저(시스템) 설정을 따른다. */
function currentTheme(): Theme {
  const fromAttribute = parseTheme(document.documentElement.getAttribute("data-theme"));
  if (fromAttribute) {
    return fromAttribute;
  }
  const prefersLight =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: light)").matches;
  return prefersLight ? "light" : "dark";
}

/**
 * 다크/라이트 전환 버튼.
 * 상태(useState)를 쓰지 않고 클릭할 때마다 DOM에서 현재 값을 읽는다.
 * 서버에서는 사용자의 선택을 알 수 없어서, 상태로 글자를 바꾸면 서버/브라우저 화면이 달라져 하이드레이션 오류가 나기 때문이다.
 * 그래서 버튼 글자는 항상 같게 두고, 바뀌는 건 <html data-theme> 하나뿐이다.
 */
export function ThemeToggle() {
  function toggle() {
    const next = oppositeTheme(currentTheme());
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // 저장소를 못 쓰는 환경이어도 이번 화면에서는 바뀐다 (새로고침하면 시스템 설정으로 돌아감)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="다크/라이트 테마 전환"
      className="rounded-full border border-chip-line px-3 py-1 text-sm text-fg-sub hover:text-fg"
    >
      테마
    </button>
  );
}
