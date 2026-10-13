import { describe, expect, it } from "vitest";
import { makeRecordSchema, type RecordFormValues } from "@/lib/record-schema";
import { isMaxRate, seoulDateToInstant, toRecordRequest } from "@/lib/records";

const TODAY = "2026-10-05";
const schema = makeRecordSchema(() => TODAY);

function values(over: Partial<RecordFormValues> = {}): RecordFormValues {
  return { achievementRate: "96.50", fullCombo: false, playedDate: TODAY, memo: "", ...over };
}

/** 검사에 실패했을 때 achievementRate의 오류 문구를 돌려준다 (성공이면 null) */
function rateError(rate: string): string | null {
  const result = schema.safeParse(values({ achievementRate: rate }));
  if (result.success) return null;
  return result.error.issues.find((i) => i.path[0] === "achievementRate")?.message ?? null;
}

describe("달성률 검사 (경계값)", () => {
  it.each(["0", "0.00", "0.01", "80", "94.99", "95.5", "99.99", "100", "100.00"])("%s 은(는) 통과한다", (rate) => {
    expect(rateError(rate)).toBeNull();
  });

  it("-0.01은 숫자 형식이 아니라서 거른다", () => {
    expect(rateError("-0.01")).toBe("달성률은 숫자로 입력해 주세요.");
  });

  it("100.01과 101은 범위 오류", () => {
    expect(rateError("100.01")).toBe("달성률은 0.00 이상 100.00 이하여야 합니다.");
    expect(rateError("101")).toBe("달성률은 0.00 이상 100.00 이하여야 합니다.");
  });

  it("소수 셋째 자리는 오류", () => {
    expect(rateError("95.123")).toBe("달성률은 소수 둘째 자리까지만 입력할 수 있습니다.");
    expect(rateError("0.001")).toBe("달성률은 소수 둘째 자리까지만 입력할 수 있습니다.");
  });

  it("비어 있으면 필수 오류", () => {
    expect(rateError("")).toBe("달성률은 필수입니다.");
    expect(rateError("   ")).toBe("달성률은 필수입니다.");
  });

  it("숫자가 아닌 입력은 모두 거른다", () => {
    for (const bad of ["abc", "1e2", "9 5", "95,5", ".5", "95.", "+95", "0x10", "９５"]) {
      expect(rateError(bad), bad).toBe("달성률은 숫자로 입력해 주세요.");
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
    const body = toRecordRequest(42, values({ achievementRate: " 96.50 ", memo: "  좋음  " }));
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
    expect(toRecordRequest(1, values({ achievementRate: "100.00", fullCombo: false })).fullCombo).toBe(true);
    expect(toRecordRequest(1, values({ achievementRate: "99.99", fullCombo: false })).fullCombo).toBe(false);
    expect(toRecordRequest(1, values({ achievementRate: "99.99", fullCombo: true })).fullCombo).toBe(true);
  });

  it("isMaxRate는 100.00만 true", () => {
    expect(isMaxRate("100")).toBe(true);
    expect(isMaxRate("100.00")).toBe(true);
    expect(isMaxRate("99.99")).toBe(false);
    expect(isMaxRate("")).toBe(false);
    expect(isMaxRate("abc")).toBe(false);
  });
});
