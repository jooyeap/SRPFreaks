import { describe, expect, it } from "vitest";
import type { RateBucketKey, RateFolderResponse } from "@/lib/api-types";
import { bucketBadges, bucketListHref, bucketStage, BUCKETS, folderLabel, folderStageCounts } from "@/lib/rate-folders";

function folder(counts: Partial<Record<RateBucketKey, [number, number, number]>>, total: number, recorded: number): RateFolderResponse {
  return {
    key: 9.5,
    total,
    recorded,
    buckets: BUCKETS.map(({ key }) => {
      const [count, exc, fc] = counts[key] ?? [0, 0, 0];
      return { bucket: key, count, exc, fc };
    }),
  };
}

describe("folderStageCounts", () => {
  it("구간이 정하는 단계(SS/S/S 미만)로 세되 MAX·FC는 먼저 떼어 따로 센다", () => {
    const f = folder(
      { R95: [5, 2, 1], R90: [2, 0, 1], R80: [1, 0, 0], R73: [1, 0, 1], BELOW: [2, 0, 0], UNPLAYED: [3, 0, 0] },
      14,
      11,
    );
    // EXC 2, FC 3(95구간 1 + 90구간 1 + 73구간 1), SS 2, S 1(90구간 2-1 + 80구간 1 = 2), S 미만 1(73구간 0 + 하위 2)
    expect(folderStageCounts(f)).toEqual({ exc: 2, fc: 3, ss: 2, s: 2, belowS: 2, total: 14 });
  });

  it("미플레이는 어느 단계에도 세지 않는다", () => {
    expect(folderStageCounts(folder({ UNPLAYED: [4, 0, 0] }, 4, 0))).toEqual({ exc: 0, fc: 0, ss: 0, s: 0, belowS: 0, total: 4 });
  });
});

describe("bucket helpers", () => {
  it("구간은 7개이고 표시 순서가 위에서 아래로 높은 달성률 순이다", () => {
    expect(BUCKETS.map((b) => b.key)).toEqual(["R95", "R90", "R85", "R80", "R73", "BELOW", "UNPLAYED"]);
  });

  it("구간 색에 쓸 단계: 95 이상 SS, 80~94.99 S, 73 A, 73 미만 C, 미플레이는 없음", () => {
    expect(BUCKETS.map((b) => bucketStage(b.key))).toEqual(["SS", "S", "S", "S", "A", "C", null]);
  });

  it("MAX·FC 뱃지 수는 구간의 exc·fc다", () => {
    expect(bucketBadges(folder({ R95: [5, 2, 1] }, 5, 5), "R95")).toEqual({ max: 2, fc: 1 });
  });

  it("폴더 제목과 목록 주소", () => {
    expect(folderLabel("level", 9.5)).toBe("9.50 ~ 9.99");
    expect(folderLabel("tier", 5.8)).toBe("5.8");
    expect(bucketListHref("tier", 5.8, "BELOW")).toBe("/me/folder?axis=tier&key=5.80&bucket=BELOW");
  });
});
