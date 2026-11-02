import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// 라이트 값은 "버튼으로 고른 라이트"와 "설정 없음 + 시스템이 라이트" 두 곳에 같은 값을 둔다 (globals.css 머리 주석).
// 한쪽에만 고치면 같은 라이트인데 색이 달라지므로, 두 블록의 변수와 값이 같은지 검사한다.
// (실제로 --danger가 한쪽에만 있어서 라이트에서 삭제 글자 대비가 2.19까지 떨어진 적이 있다.)
const css = readFileSync(join(__dirname, "globals.css"), "utf8");

/** 선택자 뒤 `{ ... }` 안의 `--변수: 값` 목록. 블록 안에 중괄호가 더 없다는 전제(이 파일은 그렇다). */
function varsOf(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`선택자를 찾지 못했습니다: ${selector}`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  const body = css.slice(open + 1, close).replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim().replace(/\s+/g, " ");
  return out;
}

/** WCAG 상대 휘도 기반 대비비. `#rrggbb`만 받는다. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("globals.css 컨트롤 테두리(--ctl-line)", () => {
  const themes = {
    다크: varsOf(":root {"),
    "라이트(직접 선택)": varsOf(':root[data-theme="light"] {'),
    "라이트(시스템)": varsOf(":root:not([data-theme]) {"),
  };

  for (const [name, vars] of Object.entries(themes)) {
    it(`${name}: 카드 배경 위에서 대비 3:1 이상이다 (버튼·칩·입력칸 윤곽, 비텍스트 대비 기준)`, () => {
      expect(vars["--ctl-line"], "--ctl-line이 없음").toBeDefined();
      expect(vars["--card"], "--card가 없음").toBeDefined();
      expect(contrast(vars["--ctl-line"], vars["--card"])).toBeGreaterThanOrEqual(3);
    });
  }

  it("Tailwind 유틸리티(border-ctl)로 쓸 수 있게 @theme에 등록돼 있다", () => {
    expect(css).toMatch(/--color-ctl:\s*var\(--ctl-line\)/);
  });
});

describe("globals.css 포커스 링", () => {
  it(":focus-visible 전역 규칙이 @layer base 안에 있다 (Tailwind 유틸리티의 outline-none이 이길 수 있게)", () => {
    const layerStart = css.indexOf("@layer base {");
    expect(layerStart).toBeGreaterThanOrEqual(0);
    const layerEnd = css.indexOf("\n}", layerStart);
    const layerBody = css.slice(layerStart, layerEnd);
    expect(layerBody).toMatch(/:focus-visible\s*\{\s*outline:\s*2px solid var\(--check-line\)/);
  });

  it("포커스 링 색(--check-line)은 다크와 라이트 모두에 정의돼 있다", () => {
    expect(varsOf(":root {")["--check-line"]).toBeDefined();
    expect(varsOf(':root[data-theme="light"] {')["--check-line"]).toBeDefined();
  });
});

describe("globals.css 테마 변수", () => {
  const dark = varsOf(":root {");
  const lightPicked = varsOf(':root[data-theme="light"] {');
  const lightSystem = varsOf(":root:not([data-theme]) {");

  it("라이트 두 블록(직접 선택 / 시스템)의 변수와 값이 같다", () => {
    expect(lightSystem).toEqual(lightPicked);
  });

  it("다크에서 글자로 쓰는 색 변수는 라이트에서 다시 정의한다 (연한 다크 색이 흰 배경에 남지 않게)", () => {
    for (const name of ["--fg", "--fg-sub", "--fg-dim", "--fg-faint", "--danger", "--part-guitar", "--part-bass", "--rec-high-text"]) {
      expect(dark[name], `${name}: 다크에 없음`).toBeDefined();
      expect(lightPicked[name], `${name}: 라이트에 없음`).toBeDefined();
      expect(lightPicked[name], `${name}: 라이트가 다크와 같은 값`).not.toBe(dark[name]);
    }
  });
});
