import { describe, expect, it } from "vitest";
import { GET } from "@/app/version/route";
import { BUILD_SHA } from "@/lib/build-info";

describe("GET /version", () => {
  it("빌드한 커밋을 JSON으로 돌려주고 캐시하지 않게 한다", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ sha: BUILD_SHA });
  });

  it("빌드 값이 없는 로컬·테스트에서는 dev이다", () => {
    expect(BUILD_SHA).toBe("dev");
  });
});
