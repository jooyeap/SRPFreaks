import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

describe("next.config", () => {
  it("배포(Docker)용으로 standalone 출력을 쓴다", () => {
    expect(nextConfig.output).toBe("standalone");
  });

  it("/api 요청을 백엔드로 넘기는 rewrite가 있다", async () => {
    const rewrites = await nextConfig.rewrites?.();
    expect(rewrites).toEqual([{ source: "/api/:path*", destination: expect.stringMatching(/\/api\/:path\*$/) }]);
  });
});
