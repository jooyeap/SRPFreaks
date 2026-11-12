import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { PWA_BACKGROUND_COLOR, PWA_THEME_COLOR } from "@/lib/pwa";

describe("manifest", () => {
  const m = manifest();

  it("홈 화면에 추가하면 주소창 없는 전체 화면(standalone)으로 열린다", () => {
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    expect(m.name).toBe("SRPFreaks");
  });

  it("바탕·테마 색은 기본 다크 테마의 바탕색(#0f1218)과 같다", () => {
    expect(m.background_color).toBe("#0f1218");
    expect(m.theme_color).toBe("#0f1218");
  });

  it("192·512 아이콘과 마스크 가능한 아이콘이 있고 모두 같은 도메인의 파일이다", () => {
    const icons = m.icons ?? [];
    expect(icons.map((i) => i.sizes)).toEqual(["192x192", "512x512", "512x512"]);
    expect(icons.filter((i) => i.purpose === "maskable")).toHaveLength(1);
    for (const icon of icons) {
      expect(icon.src.startsWith("/icons/")).toBe(true);
      expect(existsSync(join(process.cwd(), "public", icon.src))).toBe(true); // 실제 파일이 있다
    }
  });

  it("색 상수(lib/pwa.ts)는 globals.css의 다크 --page와 docs/DESIGN-UI.md 4장의 다크 페이지 배경과 같은 값이다", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    // 첫 `--page:`가 기본(다크) 테마다. 라이트 값은 그 뒤에 나온다.
    const darkPage = /--page:\s*(#[0-9a-fA-F]{6});/.exec(css)?.[1];
    expect(darkPage?.toLowerCase()).toBe(PWA_BACKGROUND_COLOR.toLowerCase());
    expect(PWA_THEME_COLOR).toBe(PWA_BACKGROUND_COLOR);
    const doc = readFileSync(join(process.cwd(), "..", "docs", "DESIGN-UI.md"), "utf8");
    const row = /\| 페이지 배경 \| `(#[0-9A-Fa-f]{6})` \|/.exec(doc)?.[1];
    expect(row?.toLowerCase()).toBe(PWA_BACKGROUND_COLOR.toLowerCase());
  });

  it("서비스 워커·푸시는 없다: 매니페스트에 관련 항목이 없고 서비스 워커 파일도 없다", () => {
    expect(Object.keys(m)).not.toContain("serviceworker");
    expect(existsSync(join(process.cwd(), "public", "sw.js"))).toBe(false);
  });
});
