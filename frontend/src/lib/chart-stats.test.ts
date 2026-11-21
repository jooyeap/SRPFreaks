import { describe, expect, it } from "vitest";
import ko from "../../messages/ko.json";
import {
  averageText,
  bestRateText,
  chartKindText,
  chartStatsHref,
  deviationBarPercent,
  ratioPercent,
  recentRangeText,
  signedText,
  tierText,
} from "@/lib/chart-stats";

describe("편차·평균 표시", () => {
  it("편차는 부호가 글자로 같이 있다(색에 기대지 않는다)", () => {
    expect(signedText(15)).toBe("+15.00%p");
    expect(signedText(-18.333333)).toBe("−18.33%p");
    expect(signedText(8.3333)).toBe("+8.33%p");
    expect(signedText(0)).toBe("0.00%p");
    // 반올림하면 0이 되는 값은 부호 없이 0
    expect(signedText(0.004)).toBe("0.00%p");
    expect(signedText(-0.004)).toBe("0.00%p");
    expect(signedText(null)).toBeNull();
  });

  it("평균은 둘째 자리까지, 값이 없으면 null(화면이 표본 부족을 쓴다)", () => {
    expect(averageText(87.12)).toBe("87.12%");
    expect(averageText(100)).toBe("100.00%");
    expect(averageText(null)).toBeNull();
  });

  it("유저 한 명의 최고 달성률은 100.00이면 MAX", () => {
    expect(bestRateText(100)).toBe("MAX");
    expect(bestRateText(93.456)).toBe("93.46%");
  });

  it("기준 난이도는 소수 첫째 자리, 없으면 null(미정)", () => {
    expect(tierText(6)).toBe("6.0");
    expect(tierText(5.8)).toBe("5.8");
    expect(tierText(null)).toBeNull();
  });

  it("파트와 난이도가 한 덩어리인 글자", () => {
    expect(chartKindText({ part: "GUITAR", difficulty: "MASTER", level: 9.5 })).toBe("Guitar | MAS 9.50");
    expect(chartKindText({ part: "BASS", difficulty: "EXTREME", level: 8.25 })).toBe("Bass | EXT 8.25");
  });

  it("상세 화면 주소", () => {
    expect(chartStatsHref(12)).toBe("/admin/chart-stats/12");
  });
});

describe("막대 길이(장식)", () => {
  it("편차 막대는 ±10%p에서 한쪽이 가득 차고 그 밖은 끝에 모은다", () => {
    expect(deviationBarPercent(0)).toBe(0);
    expect(deviationBarPercent(5)).toBe(50);
    expect(deviationBarPercent(-5)).toBe(50);
    expect(deviationBarPercent(10)).toBe(100);
    expect(deviationBarPercent(-25)).toBe(100);
    expect(deviationBarPercent(null)).toBe(0);
    expect(deviationBarPercent(Number.NaN)).toBe(0);
  });

  it("비율 막대는 최댓값 대비 0~100", () => {
    expect(ratioPercent(5, 10)).toBe(50);
    expect(ratioPercent(10, 10)).toBe(100);
    expect(ratioPercent(3, 0)).toBe(0);
    expect(ratioPercent(-1, 10)).toBe(0);
  });
});

describe("최근 N일 날짜 범위 (D98)", () => {
  it("서울 기준 오늘을 포함한 N일을 월-일로 쓴다", () => {
    // 2026-11-21 정오(서울) = 03:00Z
    expect(recentRangeText(7, new Date("2026-11-21T03:00:00Z"))).toBe("11-15~11-21");
    expect(recentRangeText(1, new Date("2026-11-21T03:00:00Z"))).toBe("11-21~11-21");
  });

  it("UTC로는 아직 전날이어도 서울 날짜로 센다(UTC 15:00 = 서울 다음 날 0시)", () => {
    expect(recentRangeText(7, new Date("2026-11-20T15:00:00Z"))).toBe("11-15~11-21");
    expect(recentRangeText(7, new Date("2026-11-20T14:59:00Z"))).toBe("11-14~11-20");
  });

  it("달·해가 바뀌어도 이어서 센다", () => {
    expect(recentRangeText(7, new Date("2027-01-03T03:00:00Z"))).toBe("12-28~01-03");
  });

  it("일 수가 올바르지 않으면 null", () => {
    expect(recentRangeText(0, new Date("2026-11-21T03:00:00Z"))).toBeNull();
  });
});

describe("번역 문구에는 판정이 없다", () => {
  // 쉬움/어려움 후보, 역전, 적정, 경고 같은 판정·라벨을 만들지 않는다. 안내문이 "판정하지 않는다"고 말하는 문장만 예외다.
  const JUDGMENT = /(후보|역전|적정|경고|쉬운|쉬움|어려운|어려움|너무)/;
  const stats = ko.ChartStats as Record<string, string>;

  it("서열표 분석 문구 어디에도 판정 단어가 없다(집계 기준 안내의 부정문만 예외)", () => {
    for (const [key, text] of Object.entries(stats)) {
      if (key === "helpBody") {
        // 이 안내문은 "쉬움·어려움 같은 판정은 하지 않습니다"라고 부정문으로만 말한다
        expect(text).toContain("판정은 하지 않습니다");
        continue;
      }
      expect(text, key).not.toMatch(JUDGMENT);
    }
  });
});
