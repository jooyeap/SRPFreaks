import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// 눌림·도움말 상자·닫힘 모션 (D82, 모션 PR 4). motion.test.ts와 같은 방식으로 globals.css와 소스를 읽어 규칙이 빠지지 않았는지 검사한다.
const css = readFileSync(join(__dirname, "globals.css"), "utf8");
const read = (file: string) => readFileSync(join(__dirname, "..", file), "utf8");
const rule = (selector: string) => {
  const at = css.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThanOrEqual(0);
  return css.slice(at, css.indexOf("}", at));
};
const reducedBlock = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce) {\n  .motion-fade"));

describe("눌림·닫힘 모션 (D82, 모션 PR 4)", () => {
  it("나가는 모션은 forwards로 마지막 모양을 지키고, 나가는 동안 클릭을 받지 않는다", () => {
    for (const selector of [
      'dialog[open][data-closing="true"]',
      'dialog[open][data-closing="true"]::backdrop',
      '.motion-fade[data-closing="true"]',
      '.motion-sheet[data-closing="true"]',
      '.motion-reveal[data-closing="true"]',
    ]) {
      expect(rule(selector), selector).toContain("forwards");
    }
    expect(rule('dialog[open][data-closing="true"]')).toContain("pointer-events: none");
    expect(rule('.motion-fade[data-closing="true"]')).toContain("pointer-events: none");
    expect(rule('.motion-sheet[data-closing="true"]')).toContain("pointer-events: none");
    // 토스트 동작 버튼은 pointer-events-auto라서 안쪽 요소까지 막는다
    expect(rule('.motion-reveal[data-closing="true"], .motion-reveal[data-closing="true"] *')).toContain("pointer-events: none");
  });

  it("나가는 길이는 열릴 때와 같은 토큰이다(창·배경 180ms, 시트 240ms, 말풍선 120ms)", () => {
    expect(rule('dialog[open][data-closing="true"]')).toContain("motion-pop-out var(--motion-base)");
    expect(rule('.motion-fade[data-closing="true"]')).toContain("var(--motion-base)");
    expect(rule('.motion-sheet[data-closing="true"]')).toContain("motion-sheet-out var(--motion-slow)");
    expect(rule('.motion-reveal[data-closing="true"]')).toContain("motion-drop-out var(--motion-fast)");
  });

  it("나가는 keyframes도 위치(transform)·투명도만 움직인다", () => {
    for (const name of ["motion-fade-out", "motion-pop-out", "motion-sheet-out", "motion-drop-out"]) {
      const at = css.indexOf(`@keyframes ${name} {`);
      expect(at, name).toBeGreaterThanOrEqual(0);
      const body = css.slice(at, css.indexOf("\n}", at));
      const props = [...body.matchAll(/([a-z-]+):/g)].map((m) => m[1]);
      expect(props.every((p) => p === "opacity" || p === "transform"), name).toBe(true);
    }
  });

  it("훅의 기다리는 시간이 CSS 토큰(120/180/240ms)과 같다", () => {
    const hook = read("lib/use-exit-presence.ts");
    expect(hook).toContain("export const EXIT_MS = 180;");
    expect(hook).toContain("export const EXIT_FAST_MS = 120;");
    expect(hook).toContain("export const EXIT_SHEET_MS = 240;");
  });

  it("나가는 모션과 눌림은 움직임 줄이기에서 꺼진다", () => {
    expect(reducedBlock).toContain(
      '.motion-fade[data-closing], .motion-sheet[data-closing], .motion-reveal[data-closing], dialog[open][data-closing], dialog[open][data-closing]::backdrop { animation: none; }',
    );
    expect(reducedBlock).toMatch(/\.motion-press \{ transition: none; \}/);
    expect(reducedBlock).toMatch(/\.motion-press:active \{ scale: none; opacity: 1; \}/);
  });

  it("눌림은 scale·opacity 속성만 fast 길이로 전환하고 색·transform을 건드리지 않는다", () => {
    const base = rule(".motion-press");
    expect(base).toContain("scale var(--motion-fast) var(--ease-out)");
    expect(base).toContain("opacity var(--motion-fast) var(--ease-out)");
    const active = rule(".motion-press:active");
    expect(active).toContain("scale: 0.985");
    expect(active).not.toMatch(/transform|color|background/);
  });

  it("창·시트·말풍선·토스트가 닫힘 훅을 쓴다", () => {
    for (const file of [
      "components/ConfirmDialog.tsx",
      "components/admin/RoleChangeDialog.tsx",
      "components/song/SongManageDialog.tsx",
      "components/song/SongEditDialog.tsx",
      "components/song/JacketUploadDialog.tsx",
      "components/song/TableEntryEditDialog.tsx",
      "components/song/ChartAddDialog.tsx",
      "components/songs/SongCreateDialog.tsx",
      "components/rating/RatingCardDialog.tsx",
      "components/record/RecordDialog.tsx",
      "components/mypage/AnalysisHelpSheet.tsx",
      "components/import/ImportHandoff.tsx",
      "components/mylists/ListAddButton.tsx",
      "components/MobileTabBar.tsx",
      "components/NotificationBell.tsx",
      "components/HelpTip.tsx",
      "components/TermHelp.tsx",
    ]) {
      expect(read(file), file).toContain("useExitPresence");
    }
    expect(read("components/Toast.tsx")).toContain("EXIT_FAST_MS");
  });
});
