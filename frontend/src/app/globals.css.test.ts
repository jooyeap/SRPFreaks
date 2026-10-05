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
