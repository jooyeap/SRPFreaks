import { describe, expect, it } from "vitest";
import { koT } from "@/i18n/ko-translator";
import type { RateBucketKey, RateFolderResponse } from "@/lib/api-types";
import {
  bucketBadges,
  bucketListHref,
  bucketStage,
  BUCKETS,
  entryToChartRow,
  folderAverage,
  folderLabel,
  folderStageCounts,
  folderViewFromParams,
  folderViewToQuery,
  formatFolderAverage,
} from "@/lib/rate-folders";

function folder(counts: Partial<Record<RateBucketKey, [number, number, number]>>, total: number, recorded: number): RateFolderResponse {
  return {
    key: 9.5,
    total,
    recorded,
    averageRecorded: recorded === 0 ? null : 90.5,
    averageWithZero: 45.25,
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

describe("folderAverage", () => {
  it("0% 포함이면 미플레이를 0으로 넣은 평균, 아니면 기록 있는 채보만의 평균이다", () => {
    const f = folder({}, 10, 4);
    expect(folderAverage(f, false)).toBe(90.5);
    expect(folderAverage(f, true)).toBe(45.25);
  });

  it("기록이 하나도 없으면 미포함 평균은 null이고 `–`로 보인다", () => {
    expect(folderAverage(folder({}, 3, 0), false)).toBeNull();
    expect(formatFolderAverage(null)).toBe("–");
    expect(formatFolderAverage(91.5)).toBe("91.50%");
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
    expect(folderLabel("level", 9.5, koT)).toBe("9.50 ~ 9.99");
    expect(folderLabel("tier", 5.8, koT)).toBe("5.8");
    expect(bucketListHref("tier", 5.8, "BELOW")).toBe("/me/folder?axis=tier&key=5.80&bucket=BELOW");
  });
});

describe("folderViewFromParams / folderViewToQuery", () => {
  it("주소에서 읽고 다시 주소로 만든다 (기본값은 쓰지 않는다)", () => {
    const state = folderViewFromParams(new URLSearchParams("axis=tier&key=5.80&bucket=R95&part=B&sort=RATE_DESC"));
    expect(state).toEqual({ axis: "tier", key: 5.8, bucket: "R95", part: "BASS", sort: "RATE_DESC" });
    expect(folderViewToQuery(state!)).toBe("axis=tier&key=5.80&bucket=R95&part=B&sort=RATE_DESC");
    expect(folderViewToQuery({ axis: "level", key: 9.5, bucket: "UNPLAYED", part: null, sort: "LEVEL" })).toBe(
      "axis=level&key=9.50&bucket=UNPLAYED",
    );
  });

  it("알 수 없는 파트·정렬은 기본값으로 본다", () => {
    expect(folderViewFromParams(new URLSearchParams("axis=level&key=9.50&bucket=R90&part=X&sort=zzz"))).toEqual({
      axis: "level", key: 9.5, bucket: "R90", part: null, sort: "LEVEL",
    });
  });

  it("폴더나 구간이 올바르지 않으면 null이다", () => {
    for (const q of ["", "axis=level&key=9.50", "axis=x&key=9.50&bucket=R95", "axis=level&key=abc&bucket=R95", "axis=level&key=9.50&bucket=R99", "axis=level&key=9.5&bucket=R95"]) {
      expect(folderViewFromParams(new URLSearchParams(q))).toBeNull();
    }
  });
});

describe("entryToChartRow", () => {
  it("서열표 줄에서 곡 목록 줄에 필요한 값만 옮긴다", () => {
    const row = entryToChartRow({
      entryId: 1, songDifficultyId: 10, songId: 100, title: "곡", addedVersion: "v1", part: "BASS", difficulty: "MASTER", level: 9.5,
      tierUncertain: false, recommend: "상", recommendUncertain: false, pattern: "단일", patternUncertain: false, ratingEnabled: true,
      mine: { rate: 96, fullCombo: false, stage: "SS" },
    });
    expect(row).toEqual({
      songDifficultyId: 10, songId: 100, title: "곡", addedVersion: "v1", part: "BASS", difficulty: "MASTER", level: 9.5,
      mine: { rate: 96, fullCombo: false, stage: "SS" },
    });
  });
});
