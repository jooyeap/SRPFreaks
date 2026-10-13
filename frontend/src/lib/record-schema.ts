import { z } from "zod";
import { toHundredths } from "@/lib/format";

/**
 * 기록 입력 검사 (Zod). 서버(RecordRequest의 Validation)와 DB(CHECK)에도 같은 규칙이 있다.
 * 화면에서 먼저 막는 이유는 오류를 바로 알려 주기 위해서이고, 서버 검사를 대신하지는 않는다.
 *
 * 달성률은 입력한 문자열 그대로 검사한다. 숫자로 바꾼 뒤에 "소수 둘째 자리인가"를 따지면
 * 부동소수점 오차(0.1 + 0.2 = 0.30000000000000004) 때문에 어긋날 수 있기 때문이다.
 */

/** 정수부 1~3자리 + 선택적 소수 1~2자리. 음수, 지수 표기(1e2), 공백은 모두 거른다. */
const RATE_FORMAT = /^\d{1,3}(\.\d{1,2})?$/;
/** 소수점은 있는데 셋째 자리 이상이 있는 경우를 따로 찾아 더 알맞은 문구를 준다. */
const TOO_MANY_DECIMALS = /^\d{1,3}\.\d{3,}$/;

export const MEMO_MAX_LENGTH = 255;

/** 오늘(Asia/Seoul)의 날짜 문자열 `YYYY-MM-DD`. 날짜 입력칸의 기본값과 "미래 날짜" 검사에 쓴다. */
export type TodayProvider = () => string;

export function makeRecordSchema(today: TodayProvider) {
  return z.object({
    achievementRate: z
      .string()
      .trim()
      .min(1, "달성률은 필수입니다.")
      .superRefine((value, ctx) => {
        if (value.length === 0) {
          return; // 위의 min이 이미 알린다
        }
        if (TOO_MANY_DECIMALS.test(value)) {
          ctx.addIssue({ code: "custom", message: "달성률은 소수 둘째 자리까지만 입력할 수 있습니다." });
          return;
        }
        if (!RATE_FORMAT.test(value)) {
          ctx.addIssue({ code: "custom", message: "달성률은 숫자로 입력해 주세요." });
          return;
        }
        const hundredths = toHundredths(Number(value));
        if (hundredths === null || hundredths < 0 || hundredths > 10000) {
          ctx.addIssue({ code: "custom", message: "달성률은 0.00 이상 100.00 이하여야 합니다." });
        }
      }),
    fullCombo: z.boolean(),
    playedDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "플레이 날짜를 입력해 주세요.")
      .refine((value) => value <= today(), "플레이 날짜는 오늘 이후일 수 없습니다."), // YYYY-MM-DD는 문자열 비교가 날짜 비교와 같다
    memo: z.string().max(MEMO_MAX_LENGTH, `메모는 ${MEMO_MAX_LENGTH}자 이하여야 합니다.`),
  });
}

export type RecordFormValues = z.infer<ReturnType<typeof makeRecordSchema>>;
