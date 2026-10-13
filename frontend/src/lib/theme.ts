/**
 * 테마(다크/라이트) 관련 순수 함수와 상수.
 * DOM이나 브라우저 저장소를 직접 만지지 않는 함수만 모아 두어서 테스트하기 쉽게 했다.
 */

export type Theme = "light" | "dark";

/** localStorage 키. 저장하는 건 테마 선택 하나뿐이다 (토큰 같은 민감한 값은 저장하지 않는다). */
export const THEME_STORAGE_KEY = "srpfreaks-theme";

/**
 * 문자열이 올바른 테마 값이면 그 값을, 아니면 null을 돌려준다.
 * 저장소에서 읽은 값은 누구나 바꿀 수 있으므로 그대로 믿지 않고 두 값만 통과시킨다.
 */
export function parseTheme(value: string | null | undefined): Theme | null {
  return value === "light" || value === "dark" ? value : null;
}

export function oppositeTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

/**
 * 페이지가 그려지기 전에 실행되는 짧은 스크립트(<head>에 인라인으로 넣는다).
 * 저장된 테마가 있으면 <html data-theme>에 붙인다. 이걸 React가 그린 뒤(useEffect)에 하면
 * 라이트를 고른 사용자도 다크 화면이 먼저 번쩍이기 때문에, 첫 그림 전에 동기적으로 실행해야 한다.
 * 저장소를 못 쓰는 환경(시크릿 창 등)에서 예외가 나도 화면이 깨지지 않게 try/catch로 감싼다.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;
