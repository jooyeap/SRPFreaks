import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// 스켈레톤→본문 페이드와 재킷 등장 (D82, 모션 PR 6). globals.css 규칙이 빠지지 않았는지 검사한다(애니메이션 타이밍에는 의존하지 않는다).
const css = readFileSync(join(__dirname, "globals.css"), "utf8");
const rule = (selector: string) => {
  const at = css.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThanOrEqual(0);
  return css.slice(at, css.indexOf("}", at));
};
const reducedBlock = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce) {\n  .motion-fade"));

describe("스켈레톤 전환·재킷 등장 CSS (D82, 모션 PR 6)", () => {
  it("본문 페이드는 투명도만 쓰고 길이 토큰을 쓴다", () => {
    const r = rule(".motion-content-in");
    expect(r).toContain("motion-fade-in var(--motion-base)");
    expect(r).not.toMatch(/\d(ms|s)\b/);
    expect(r).not.toContain("transform");
  });

  it("재킷은 불러오기 전 투명이고 불러오면 불투명해지며 투명도만 전환한다", () => {
    expect(rule(".motion-jacket")).toContain("opacity: 0");
    expect(rule(".motion-jacket")).toContain("transition: opacity var(--motion-base)");
    expect(rule('.motion-jacket[data-loaded="true"]')).toContain("opacity: 1");
  });

  it("움직임 줄이기에서는 둘 다 끈다", () => {
    expect(reducedBlock).toContain(".motion-content-in { animation: none; }");
    expect(reducedBlock).toContain(".motion-jacket { transition: none; }");
  });

  it("Skeleton의 맥박은 그대로다", () => {
    const src = readFileSync(join(__dirname, "..", "components", "Skeleton.tsx"), "utf8");
    expect(src).toContain("animate-pulse");
    expect(src).toContain("motion-reduce:animate-none");
  });
});
