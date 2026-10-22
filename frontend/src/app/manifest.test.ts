import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

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
});
