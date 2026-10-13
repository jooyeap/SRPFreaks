import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { buildContentSecurityPolicy } from "@/lib/csp";

describe("Content-Security-Policy", () => {
  const prod = buildContentSecurityPolicy(false);

  it("기본은 같은 출처만 허용하고 frame/object/base 삽입을 막는다", () => {
    expect(prod).toContain("default-src 'self'");
    expect(prod).toContain("frame-ancestors 'none'");
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("base-uri 'self'");
    expect(prod).toContain("form-action 'self'");
  });

  it("Google 로그인에 필요한 출처만 열어 둔다", () => {
    expect(prod).toContain("script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client");
    expect(prod).toContain("frame-src https://accounts.google.com/gsi/");
    expect(prod).toContain("connect-src 'self' https://accounts.google.com/gsi/");
    expect(prod).not.toMatch(/\*/);
  });

  it("운영 정책에는 eval과 웹소켓이 없고, 개발 정책에만 있다", () => {
    expect(prod).not.toContain("unsafe-eval");
    expect(prod).not.toContain("ws:");
    const dev = buildContentSecurityPolicy(true);
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toContain("ws:");
  });

  it("next.config가 모든 경로에 CSP 헤더를 붙인다", async () => {
    const rules = await nextConfig.headers?.();
    const rule = rules?.find((r) => r.source === "/:path*");
    expect(rule?.headers).toContainEqual({ key: "Content-Security-Policy", value: expect.stringContaining("default-src 'self'") });
  });
});
