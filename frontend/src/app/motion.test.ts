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
    for (const name of [".motion-fade", ".motion-sheet", ".motion-reveal", ".tile-glow::after", "dialog[open]", "dialog[open]::backdrop", ".motion-switch-track", ".motion-switch-thumb"]) {
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

// 시간 통일 (D82, 모션 PR 1): 블록 밖에 있던 모션도 같은 길이 토큰을 쓰고, 설정 스위치는 움직임 줄이기에서 꺼진다.
describe("시간 통일 (D82)", () => {
  const rule = (selector: string) => {
    const at = css.indexOf(`${selector} {`);
    expect(at).toBeGreaterThanOrEqual(0);
    return css.slice(at, css.indexOf("}", at));
  };

  it("edge-bounce는 240ms(slow), 테마 손잡이는 120ms(fast) 토큰을 쓴다", () => {
    expect(rule(".edge-bounce-higher")).toContain("var(--motion-slow) var(--ease-out)");
    expect(rule(".edge-bounce-lower")).toContain("var(--motion-slow) var(--ease-out)");
    expect(rule(".theme-thumb")).toContain("transform var(--motion-fast) var(--ease-out)");
    expect(css).not.toMatch(/260ms|0\.15s/);
  });

  it("arrive-glow는 1.8초다", () => {
    expect(rule(".arrive-glow")).toContain("1.8s");
  });

  it("쓰는 곳이 없던 .drawer-* 와 drawer 키프레임은 없다", () => {
    expect(css).not.toMatch(/drawer-(panel|overlay|in|fade)/);
  });

  it("설정 스위치는 left 대신 translate로 움직이고 fast 토큰을 쓴다", () => {
    expect(rule(".motion-switch-track")).toContain("var(--motion-fast) var(--ease-out)");
    const thumb = rule(".motion-switch-thumb");
    expect(thumb).toContain("translate var(--motion-fast) var(--ease-out)");
    expect(thumb).not.toMatch(/\bleft\b/);
  });

  it("스위치 5곳은 새 클래스를 쓰고 left·transition-all을 더 쓰지 않는다", () => {
    const root = join(__dirname, "..", "components");
    for (const file of [
      "song/TableEntryEditDialog.tsx",
      "settings/ProfileVisibilityForm.tsx",
      "settings/JacketDisplayForm.tsx",
      "settings/RivalNotifyForm.tsx",
      "settings/TierNotifyForm.tsx",
    ]) {
      const src = readFileSync(join(root, file), "utf8");
      expect(src, file).toContain("motion-switch-track");
      expect(src, file).toContain("motion-switch-thumb");
      expect(src, file).toContain("translate-x-5");
      expect(src, file).not.toMatch(/left-5\.5|transition-all|transition-colors/);
    }
  });

  it("폴더 스와이프는 LEAVE_MS 180 · RETURN_MS 120이다", () => {
    const src = readFileSync(join(__dirname, "..", "components", "table", "TierFolderView.tsx"), "utf8");
    expect(src).toContain("const LEAVE_MS = 180;");
    expect(src).toContain("const RETURN_MS = 120;");
  });
});

// 화면·탭 전환과 선택 지시선 (D82, 모션 PR 2)
describe("화면·탭 전환과 지시선 (D82, 모션 PR 2)", () => {
  const rule = (selector: string) => {
    const at = css.indexOf(`${selector} {`);
    expect(at).toBeGreaterThanOrEqual(0);
    return css.slice(at, css.indexOf("}", at));
  };
  const reducedBlock = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce) {\n  .motion-fade"));

  it("motion-page·motion-swap은 투명도만 180ms 토큰으로 나타나고 움직임 줄이기에서 꺼진다", () => {
    const at = css.indexOf(".motion-page, .motion-swap {");
    expect(at).toBeGreaterThanOrEqual(0);
    const body = css.slice(at, css.indexOf("}", at));
    expect(body).toContain("motion-fade-in var(--motion-base) var(--ease-out)");
    expect(reducedBlock).toMatch(/\.motion-page, \.motion-swap/);
  });

  it("motion-indicator는 transform·opacity만 120/180/240 토큰 길이로 전환하고 움직임 줄이기에서 꺼진다", () => {
    const body = rule(".motion-indicator");
    expect(body).toContain("transform var(--motion-base) var(--ease-out)");
    expect(body).toContain("opacity var(--motion-base) var(--ease-out)");
    expect(body).not.toMatch(/left|width|margin/);
    expect(reducedBlock).toMatch(/\.motion-indicator \{ transition: none; \}/);
  });

  it("template.tsx가 화면마다 motion-page로 감싸고, 탭 내용·지시선이 새 클래스를 쓴다", () => {
    const read = (file: string) => readFileSync(join(__dirname, "..", file), "utf8");
    expect(read("app/template.tsx")).toContain('className="motion-page"');
    expect(read("components/mypage/MyPageView.tsx")).toMatch(/key=\{`\$\{tab\}:[^`]*`\}[^>]*className="motion-swap"/);
    expect(read("components/mypage/MyPageView.tsx")).toContain("motion-indicator");
    expect(read("components/guide/GuideTabs.tsx")).toContain('className="motion-swap"');
    expect(read("components/MobileTabBar.tsx")).toContain("motion-indicator");
  });
});
