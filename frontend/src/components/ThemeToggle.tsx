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
 * 다크/라이트 전환 스위치: 해(라이트) · 달(다크) 아이콘이 있는 둥근 스위치.
 * 상태(useState)를 쓰지 않고 클릭할 때마다 DOM에서 현재 값을 읽는다.
 * 서버에서는 사용자의 선택을 알 수 없어서, 상태로 모양을 바꾸면 서버/브라우저 화면이 달라져 하이드레이션 오류가 나기 때문이다.
 * 그래서 마크업은 항상 같게 두고, 손잡이 위치와 아이콘 색은 <html data-theme>을 보는 CSS(.theme-switch, globals.css)가 정한다.
 * 색만으로 의미를 전달하지 않도록 해/달 모양을 같이 둔다.
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
      title="다크/라이트 테마 전환"
      className="theme-switch relative grid h-7 w-14 shrink-0 grid-cols-2 items-center rounded-full border border-chip-line bg-table-head"
    >
      <span className="theme-thumb absolute left-0.5 top-0.5 h-5 w-6 rounded-full bg-chip-on-bg" aria-hidden="true" />
      <svg className="theme-sun relative mx-auto h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <svg className="theme-moon relative mx-auto h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    </button>
  );
}
