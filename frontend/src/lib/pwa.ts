/**
 * 웹 앱 매니페스트의 색(app/manifest.ts). 값은 기본 다크 테마의 바탕(globals.css `--page`)과 같아야 하고,
 * 테스트(app/manifest.test.ts)가 globals.css·docs/DESIGN-UI.md 4장과 같은 값인지 비교한다.
 * 한쪽만 바뀌면 홈 화면 앱의 시작 화면 색이 앱 바탕과 달라져 번쩍인다.
 */
export const PWA_BACKGROUND_COLOR = "#0f1218";
export const PWA_THEME_COLOR = PWA_BACKGROUND_COLOR;
