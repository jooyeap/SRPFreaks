import { describe, expect, it } from "vitest";
import { koT as t } from "@/i18n/ko-translator";
import { rateFromInput, rateToInput } from "@/lib/format";
import { makeRecordSchema, type RecordFormValues } from "@/lib/record-schema";
import { distinctRecentCharts, isEdited, isMaxRate, ratingChangeText, recordOriginText, seoulDateToInstant, toRecordRequest } from "@/lib/records";

const TODAY = "2026-10-05";
const schema = makeRecordSchema(t, () => TODAY);

function values(over: Partial<RecordFormValues> = {}): RecordFormValues {
  return { achievementRate: "9650", fullCombo: false, playedDate: TODAY, memo: "", ...over };
}

/** 검사에 실패했을 때 achievementRate의 오류 문구를 돌려준다 (성공이면 null) */
function rateError(rate: string): string | null {
  const result = schema.safeParse(values({ achievementRate: rate }));
  if (result.success) return null;
  return result.error.issues.find((i) => i.path[0] === "achievementRate")?.message ?? null;
}

describe("달성률 검사 (경계값, 소수점 없는 정수 0~10000)", () => {
  it.each(["0", "1", "8000", "9499", "9500", "9999", "10000", "00050"])("%s 은(는) 통과한다", (rate) => {
    expect(rateError(rate)).toBeNull();
  });

  it("-1은 숫자 형식이 아니라서 거른다", () => {
    expect(rateError("-1")).toBe("달성률은 소수점 없는 정수로 입력해 주세요.");
  });

  it("10001과 99999는 범위 오류", () => {
    expect(rateError("10001")).toBe("달성률은 0 이상 10000 이하여야 합니다.");
    expect(rateError("99999")).toBe("달성률은 0 이상 10000 이하여야 합니다.");
  });

  it("비어 있으면 필수 오류", () => {
    expect(rateError("")).toBe("달성률은 필수입니다.");
    expect(rateError("   ")).toBe("달성률은 필수입니다.");
  });

  it("소수점이 있거나 숫자가 아닌 입력은 모두 거른다", () => {
    for (const bad of ["95.5", "99.71", "0.5", "abc", "1e2", "9 5", "95,5", ".5", "95.", "+95", "0x10", "９５", "100000"]) {
      expect(rateError(bad), bad).toBe("달성률은 소수점 없는 정수로 입력해 주세요.");
    }
  });
});

describe("날짜와 메모 검사", () => {
  it("오늘은 통과하고 내일은 거른다", () => {
    expect(schema.safeParse(values({ playedDate: TODAY })).success).toBe(true);
    const result = schema.safeParse(values({ playedDate: "2026-10-06" }));
    expect(result.success).toBe(false);
  });

  it("날짜 형식이 아니면 거른다", () => {
    expect(schema.safeParse(values({ playedDate: "" })).success).toBe(false);
    expect(schema.safeParse(values({ playedDate: "2026/10/05" })).success).toBe(false);
  });

  it("메모는 255자까지 통과하고 256자는 거른다", () => {
    expect(schema.safeParse(values({ memo: "가".repeat(255) })).success).toBe(true);
    expect(schema.safeParse(values({ memo: "가".repeat(256) })).success).toBe(false);
  });
});

describe("요청 변환", () => {
  it("서울 날짜를 서울 0시의 UTC 시각으로 바꾼다", () => {
    expect(seoulDateToInstant("2026-10-05")).toBe("2026-10-04T15:00:00.000Z");
  });

  it("노트 옵션은 항상 SRN+, 메모는 앞뒤 공백을 떼고 비면 null", () => {
    const body = toRecordRequest(42, values({ achievementRate: " 9650 ", memo: "  좋음  " }));
    expect(body).toEqual({
      songDifficultyId: 42,
      noteOption: "SUPER_RANDOM_PLUS",
      achievementRate: 96.5,
      fullCombo: false,
      playedAt: "2026-10-04T15:00:00.000Z",
      memo: "좋음",
    });
    expect(toRecordRequest(42, values({ memo: "   " })).memo).toBeNull();
  });

  it("달성률 100.00이면 체크하지 않아도 풀콤보로 보낸다", () => {
    expect(toRecordRequest(1, values({ achievementRate: "10000", fullCombo: false })).fullCombo).toBe(true);
    expect(toRecordRequest(1, values({ achievementRate: "9999", fullCombo: false })).fullCombo).toBe(false);
    expect(toRecordRequest(1, values({ achievementRate: "9999", fullCombo: true })).fullCombo).toBe(true);
  });

  it("정수 입력은 ÷100으로 달성률이 된다 (9971 → 99.71, 1 → 0.01, 0 → 0)", () => {
    expect(toRecordRequest(1, values({ achievementRate: "9971" })).achievementRate).toBe(99.71);
    expect(toRecordRequest(1, values({ achievementRate: "1" })).achievementRate).toBe(0.01);
    expect(toRecordRequest(1, values({ achievementRate: "0" })).achievementRate).toBe(0);
    expect(toRecordRequest(1, values({ achievementRate: "10000" })).achievementRate).toBe(100);
  });

  it("수정 창의 초기값은 기존 달성률의 정수 글자다 (91.25 → 9125, 100 → 10000)", () => {
    expect(rateToInput(91.25)).toBe("9125");
    expect(rateToInput(100)).toBe("10000");
    expect(rateToInput(0.07)).toBe("7"); // 0.07*100 = 7.000000000000001 도 반올림으로 바로잡는다
    expect(rateFromInput("9125")).toBe(91.25);
    expect(rateFromInput("10001")).toBeNull();
    expect(rateFromInput("95.5")).toBeNull();
  });

  it("세 자리는 끝에 0을 붙여 읽는다 (965 → 96.50), 단 100은 100.00", () => {
    expect(rateFromInput("965")).toBe(96.5);
    expect(rateFromInput("999")).toBe(99.9);
    expect(rateFromInput("101")).toBe(10.1); // 100 바로 위부터는 10.x%로 읽는다
    expect(rateFromInput("100")).toBe(100); // 10.00%가 아니라 100%
    expect(toRecordRequest(1, values({ achievementRate: "965" })).achievementRate).toBe(96.5);
    expect(toRecordRequest(1, values({ achievementRate: "100" })).achievementRate).toBe(100);
  });

  it("세 자리 규칙은 정확히 세 자리에만 적용된다 (1~2자리, 4~5자리, 앞자리 0은 그대로)", () => {
    expect(rateFromInput("96")).toBe(0.96); // 두 자리는 그대로 100분의 1
    expect(rateFromInput("9")).toBe(0.09);
    expect(rateFromInput("0")).toBe(0);
    expect(rateFromInput("9650")).toBe(96.5);
    expect(rateFromInput("0965")).toBe(9.65); // 9.65%를 치고 싶으면 앞에 0을 붙인다
    expect(rateFromInput("050")).toBe(0.5); // 앞자리 0인 세 자리는 글자 그대로
    expect(rateFromInput("000")).toBe(0);
    expect(rateFromInput("1000")).toBe(10); // 네 자리 1000은 10.00%
  });

  it("수정 창이 돌려주는 글자를 다시 읽어도 값이 바뀌지 않는다 (1.00~9.99%는 네 자리로 채운다)", () => {
    expect(rateToInput(5)).toBe("0500");
    expect(rateToInput(1)).toBe("0100"); // "100"이면 100.00으로 읽혀 버린다
    expect(rateToInput(9.99)).toBe("0999");
    expect(rateToInput(0.5)).toBe("50");
    for (const rate of [0, 0.01, 0.5, 1, 5, 9.99, 10, 50, 96.5, 99.71, 100]) {
      expect(rateFromInput(rateToInput(rate))).toBe(rate);
    }
  });

  it("isMaxRate는 100.00으로 읽히는 입력만 true", () => {
    expect(isMaxRate("10000")).toBe(true);
    expect(isMaxRate("100")).toBe(true); // 세 자리 100은 100%
    expect(isMaxRate("0100")).toBe(false); // 1.00
    expect(isMaxRate("9999")).toBe(false);
    expect(isMaxRate("")).toBe(false);
    expect(isMaxRate("abc")).toBe(false);
  });
});

describe("등록·수정 표시", () => {
  const created = "2026-10-05T01:00:00Z";

  it("등록 직후(1분 이내)는 수정으로 보지 않고, 1분을 넘게 뒤면 수정으로 본다", () => {
    expect(isEdited({ createdAt: created, updatedAt: created })).toBe(false);
    expect(isEdited({ createdAt: created, updatedAt: "2026-10-05T01:00:59Z" })).toBe(false);
    expect(isEdited({ createdAt: created, updatedAt: "2026-10-05T01:01:01Z" })).toBe(true);
  });

  it("날짜가 올바르지 않으면 수정으로 보지 않는다", () => {
    expect(isEdited({ createdAt: "x", updatedAt: created })).toBe(false);
  });

  it("글자는 서울 날짜로 `등록`만, 고쳤으면 `수정`까지 보여 준다", () => {
    expect(recordOriginText({ createdAt: created, updatedAt: created }, t)).toBe("등록 2026-10-05");
    expect(recordOriginText({ createdAt: created, updatedAt: "2026-10-07T20:00:00Z" }, t)).toBe(
      "등록 2026-10-05 · 수정 2026-10-08",
    ); // UTC 20시는 서울 다음 날 05시
  });
});

describe("ratingChangeText", () => {
  const base = { totalBefore: 10638.13, totalAfter: 10641.53, change: 3.4, entered: false, inList: true };

  it("서버가 변화를 주지 않으면 아무것도 붙이지 않는다", () => {
    expect(ratingChangeText(null, t)).toBeNull();
    expect(ratingChangeText(undefined, t)).toBeNull();
  });

  it("오르면 + 부호와 전후 합계를 쓴다", () => {
    expect(ratingChangeText(base, t)).toBe("레이팅 +3.40 (10638.13 → 10641.53)");
  });

  it("내려가면 - 부호를 쓴다 (기록을 낮춰 고친 경우)", () => {
    expect(ratingChangeText({ ...base, totalAfter: 10636.93, change: -1.2 }, t)).toBe("레이팅 -1.20 (10638.13 → 10636.93)");
  });

  it("목록에 새로 들어가면 NEW 문구를 덧붙인다", () => {
    expect(ratingChangeText({ ...base, entered: true }, t)).toBe(
      "레이팅 +3.40 (10638.13 → 10641.53) · NEW 레이팅 목록에 새로 들어갔습니다.",
    );
  });

  it("목록 밖이면 이유를 알려 주고, 목록 안인데 점수가 같으면 그대로라고 한다", () => {
    expect(ratingChangeText({ ...base, change: 0, totalAfter: 10638.13, inList: false }, t)).toBe("아직 레이팅 목록에는 들지 못했습니다.");
    expect(ratingChangeText({ ...base, change: 0, totalAfter: 10638.13 }, t)).toBe("레이팅은 그대로입니다.");
  });
});

describe("distinctRecentCharts", () => {
  const rec = (id: number, chartId: number) => ({ id, songDifficultyId: chartId }) as Parameters<typeof distinctRecentCharts>[0][number];

  it("같은 채보는 가장 최근 것만 남기고 순서를 지킨다", () => {
    const result = distinctRecentCharts([rec(1, 10), rec(2, 20), rec(3, 10), rec(4, 30)]);
    expect(result.map((r) => r.id)).toEqual([1, 2, 4]);
  });

  it("최대 개수에서 멈춘다 (기본 5곡)", () => {
    const many = Array.from({ length: 9 }, (_, i) => rec(i + 1, i + 100));
    expect(distinctRecentCharts(many)).toHaveLength(5);
    expect(distinctRecentCharts(many, 2).map((r) => r.id)).toEqual([1, 2]);
  });

  it("기록이 없으면 빈 목록이다", () => {
    expect(distinctRecentCharts([])).toEqual([]);
  });
});
