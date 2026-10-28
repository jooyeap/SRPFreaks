import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { queryRetryDelay, shouldRetryQuery } from "@/lib/query-retry";

const err = (status: number) => new ApiError(status, "X", "x");

describe("조회 자동 재시도 규칙", () => {
  it("4xx는 다시 시도하지 않는다", () => {
    expect(shouldRetryQuery(0, err(404))).toBe(false);
    expect(shouldRetryQuery(0, err(403))).toBe(false);
  });

  it("502·503·504(서버가 다시 뜨는 중)는 4번까지, 3·6·9·12초 간격으로 다시 시도한다(합계 30초)", () => {
    for (const status of [502, 503, 504]) {
      expect([0, 1, 2, 3].map((n) => shouldRetryQuery(n, err(status)))).toEqual([true, true, true, true]);
      expect(shouldRetryQuery(4, err(status))).toBe(false);
    }
    const delays = [0, 1, 2, 3].map((n) => queryRetryDelay(n, err(503)));
    expect(delays).toEqual([3000, 6000, 9000, 12000]);
    expect(delays.reduce((a, b) => a + b, 0)).toBe(30_000);
  });

  it("그 밖의 오류(500, 네트워크)는 지금처럼 두 번까지, 기본 간격으로", () => {
    expect(shouldRetryQuery(1, err(500))).toBe(true);
    expect(shouldRetryQuery(2, err(500))).toBe(false);
    expect(shouldRetryQuery(1, err(0))).toBe(true);
    expect(shouldRetryQuery(1, new Error("x"))).toBe(true);
    expect(queryRetryDelay(0, err(500))).toBe(1000);
    expect(queryRetryDelay(1, err(0))).toBe(2000);
  });
});
