import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { PRIVATE_PATHS, PUBLIC_PATHS, siteUrl } from "@/lib/site";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("robots.txt / sitemap", () => {
  it("사이트 주소는 기본값이 있고 환경변수로 바꿀 수 있으며 끝 슬래시를 지운다", () => {
    expect(siteUrl()).toBe("https://srpfreaks.com");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.test/");
    expect(siteUrl()).toBe("https://example.test");
  });

  it("sitemap에는 공개 화면만 들어 있다", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toEqual(["https://srpfreaks.com", "https://srpfreaks.com/guide", "https://srpfreaks.com/privacy", "https://srpfreaks.com/terms"]);
    for (const path of PRIVATE_PATHS) {
      expect(urls.some((url) => url.endsWith(path))).toBe(false);
    }
  });

  it("robots는 로그인 뒤 화면을 막고 sitemap 주소를 알려 준다", () => {
    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rule.disallow).toEqual(expect.arrayContaining(["/admin", "/api", "/me", "/settings"]));
    expect(result.sitemap).toBe("https://srpfreaks.com/sitemap.xml");
  });

  it("공개 화면은 막힌 경로와 겹치지 않는다", () => {
    const privatePaths: readonly string[] = PRIVATE_PATHS;
    for (const pub of PUBLIC_PATHS) {
      expect(privatePaths.some((p) => pub === p || pub.startsWith(`${p}/`))).toBe(false);
    }
  });
});
