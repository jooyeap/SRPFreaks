import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// 움직임(D57): 새 움직임 클래스를 더할 때 "움직임 줄이기" 설정에서 끄는 것을 빠뜨리지 않게 검사한다.
const css = readFileSync(join(__dirname, "globals.css"), "utf8");
const start = css.indexOf("움직임 (D57");
const block = css.slice(start, css.indexOf("데스크톱 컨트롤 높이", start));

describe("움직임 규칙 (D57)", () => {
  it("움직임 클래스는 모두 움직임 줄이기 설정에서 꺼진다", () => {
    const reduced = block.slice(block.indexOf("@media (prefers-reduced-motion: reduce)"));
    for (const name of [".motion-fade", ".motion-sheet", ".motion-reveal", "dialog[open]", "dialog[open]::backdrop"]) {
      expect(block).toContain(`${name} {`);
      expect(reduced).toContain(name);
    }
    expect(reduced).toMatch(/button:not\(:disabled\):active \{ scale: none; \}/);
  });

  it("길이는 120ms · 180ms · 240ms 세 가지뿐이고 위치·투명도만 움직인다", () => {
    expect(block).toContain("--motion-fast: 120ms;");
    expect(block).toContain("--motion-base: 180ms;");
    expect(block).toContain("--motion-slow: 240ms;");
    const keyframes = block.match(/@keyframes[\s\S]*?\n\}/g) ?? [];
    expect(keyframes.length).toBeGreaterThan(0);
    for (const k of keyframes) {
      const props = [...k.matchAll(/([a-z-]+):/g)].map((m) => m[1]);
      expect(props.every((p) => p === "opacity" || p === "transform")).toBe(true);
    }
  });
});
