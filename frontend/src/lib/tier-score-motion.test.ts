import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 점수 글자(.tier-score)의 반짝임(D108): Gold 이상 8티어만 움직이고, 움직임 줄이기에서는 멈춘다.
 * CSS 파일 내용을 읽어 규칙이 있는지 확인한다(브라우저 애니메이션 자체는 시안·스크린샷으로 본다).
 */
const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");
const MOVING = ["GOLD", "RAINBOW", "RAINBOW_GRADIENT", "IRIDESCENT", "SIX_FINGERS", "MUTANT", "ALIEN", "HSB"];
const STATIC = ["BRONZE", "SILVER", "WHITE", "RED_GRADIENT"];

/** `tier-shimmer 3.5s` 애니메이션 선언이 들어 있는 규칙 블록의 선택자 부분 */
function motionSelector(): string {
  const m = css.match(/([^{}]*)\{[^}]*animation: tier-shimmer 3\.5s ease-in-out infinite alternate;[^}]*\}/);
  expect(m, "tier-shimmer 애니메이션 규칙").not.toBeNull();
  return m![1];
}

describe("티어 점수 글자 반짝임 (D108)", () => {
  it("keyframes가 배경 위치를 0%에서 100%로 옮긴다", () => {
    expect(css).toMatch(/@keyframes tier-shimmer \{\s*from \{ background-position: 0% 0; \}\s*to \{ background-position: 100% 0; \}\s*\}/);
  });

  it("Gold 이상 8티어에만 움직임이 걸리고 Bronze·Silver 등은 정지다", () => {
    const sel = motionSelector();
    for (const k of MOVING) expect(sel, k).toContain(`[data-tier="${k}"]`);
    for (const k of STATIC) expect(sel, k).not.toContain(`[data-tier="${k}"]`);
    // 점수 글자(.tier-score)에만 걸린다: 칩·막대·카드·서열표 칸 선택자가 아니다
    expect(sel).toContain(".tier-score");
    expect(sel).not.toMatch(/tier-bar|tier-card|chart-cell|chart-swatch|chart-dot/);
  });

  it("배경을 200%로 늘리고 글자 빛(drop-shadow)을 쓴다", () => {
    expect(css).toMatch(/background-size: 200% 100%;\s*filter: drop-shadow\(var\(--tier-glow\)\);\s*animation: tier-shimmer/);
  });

  it("움직임 줄이기에서는 애니메이션을 끄고 배경 크기를 되돌린다", () => {
    const m = css.match(/@media \(prefers-reduced-motion: reduce\) \{\s*:is\(\[data-tier="GOLD"\][^{}]*\{\s*animation: none;\s*background-size: auto;/);
    expect(m, "reduced-motion 규칙").not.toBeNull();
  });

  it("라이트 테마는 빛(filter)을 끈다: 8티어 모두 --tier-fill-light + filter: none 규칙 안에 있다", () => {
    const light = css.match(/:root\[data-theme="light"\] :is\(([^)]*)\)\.tier-score,[^{]*\{[^}]*filter: none;/);
    expect(light, "라이트 규칙").not.toBeNull();
    for (const k of MOVING) expect(light![1], k).toContain(`"${k}"`);
  });

  it("색 값은 건드리지 않는다: 점수 글자는 여전히 --tier-fill을 쓴다", () => {
    expect(css).toMatch(/\.tier-score \{[^}]*background: var\(--tier-fill\)/);
  });
});

/** `tier-shimmer-v` 애니메이션 선언이 들어 있는 규칙 블록의 선택자 부분 */
function barMotionSelector(): string {
  const m = css.match(/([^{}]*)\{[^}]*animation: tier-shimmer-v 3\.5s ease-in-out infinite alternate;[^}]*\}/);
  expect(m, "tier-shimmer-v 애니메이션 규칙").not.toBeNull();
  return m![1];
}

describe("레이팅 카드 세로 띠 반짝임 (D109)", () => {
  it("keyframes가 배경 위치를 세로로 0%에서 100%로 옮긴다", () => {
    expect(css).toMatch(/@keyframes tier-shimmer-v \{\s*from \{ background-position: 0% 0%; \}\s*to \{ background-position: 0% 100%; \}\s*\}/);
  });

  it("Gold 이상 8티어의 .tier-bar-v에만 걸리고 Bronze·Silver·진행 막대(.tier-bar 단독)는 정지다", () => {
    const sel = barMotionSelector();
    for (const k of MOVING) expect(sel, k).toContain(`[data-tier="${k}"]`);
    for (const k of STATIC) expect(sel, k).not.toContain(`[data-tier="${k}"]`);
    expect(sel).toContain(".tier-bar-v");
    expect(sel).not.toMatch(/tier-score|tier-card|chart-cell|chart-swatch|chart-dot/);
    // 세로 띠가 아닌 .tier-bar(진행 막대)만 고르는 선택자는 없다
    expect(sel.replace(/\.tier-bar-v/g, "")).not.toMatch(/\.tier-bar/);
  });

  it("배경을 세로로 200% 늘리고 글자 빛 같은 drop-shadow는 쓰지 않는다", () => {
    expect(css).toMatch(/background-size: 100% 200%;\s*animation: tier-shimmer-v/);
    const block = css.match(/[^{}]*\{[^}]*animation: tier-shimmer-v[^}]*\}/)![0];
    expect(block).not.toContain("drop-shadow");
  });

  it("움직임 줄이기에서는 애니메이션을 끄고 배경 크기를 되돌린다", () => {
    const m = css.match(/@media \(prefers-reduced-motion: reduce\) \{\s*:is\(\[data-tier="GOLD"\][^{}]*\.tier-bar-v[^{}]*\{\s*animation: none;\s*background-size: auto;/);
    expect(m, "reduced-motion 규칙").not.toBeNull();
  });

  it("색과 방향은 그대로다: .tier-bar는 --tier-fill, 세로 띠는 180deg", () => {
    expect(css).toMatch(/\.tier-bar \{ background: var\(--tier-fill\); \}/);
    expect(css).toMatch(/\.tier-bar-v \{ --tier-dir: 180deg; \}/);
  });
});
