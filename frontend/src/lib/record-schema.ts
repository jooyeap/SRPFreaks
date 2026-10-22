import { z } from "zod";
import { RATE_INPUT_MAX } from "@/lib/format";
import type { Translator } from "@/i18n/translator";

/**
 * 기록 입력 검사 (Zod). 서버(RecordRequest의 Validation)와 DB(CHECK)에도 같은 규칙이 있다.
 * 화면에서 먼저 막는 이유는 오류를 바로 알려 주기 위해서이고, 서버 검사를 대신하지는 않는다.
 *
 * 달성률 입력칸은 소수점 없는 정수(0~10000)만 받는다. 소수점은 저장할 때 ÷100으로 자동으로 찍는다(9971 → 99.71).
 * 정수로 받으면 "소수 둘째 자리까지" 검사와 부동소수점 오차(0.1 + 0.2 = 0.30000000000000004)가 아예 필요 없다.
 */

/** 숫자만 1~5자리. 소수점, 음수, 지수 표기(1e2), 공백, 전각 숫자는 모두 거른다. */
const RATE_FORMAT = /^\d{1,5}$/;

export const MEMO_MAX_LENGTH = 255;

/** 오늘(Asia/Seoul)의 날짜 문자열 `YYYY-MM-DD`. 날짜 입력칸의 기본값과 "미래 날짜" 검사에 쓴다. */
export type TodayProvider = () => string;

export function makeRecordSchema(t: Translator, today: TodayProvider) {
  return z.object({
    achievementRate: z
      .string()
      .trim()
      .min(1, t("Validation.rateRequired"))
      .superRefine((value, ctx) => {
        if (value.length === 0) {
          return; // 위의 min이 이미 알린다
        }
        if (!RATE_FORMAT.test(value)) {
          ctx.addIssue({ code: "custom", message: t("Validation.rateNumber") });
          return;
        }
        if (Number(value) > RATE_INPUT_MAX) {
          ctx.addIssue({ code: "custom", message: t("Validation.rateRange") });
        }
      }),
    fullCombo: z.boolean(),
    playedDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, t("Validation.playedDateRequired"))
      .refine((value) => value <= today(), t("Validation.playedDateFuture")), // YYYY-MM-DD는 문자열 비교가 날짜 비교와 같다
    memo: z.string().max(MEMO_MAX_LENGTH, t("Validation.memoMax", { max: MEMO_MAX_LENGTH })),
  });
}

export type RecordFormValues = z.infer<ReturnType<typeof makeRecordSchema>>;
