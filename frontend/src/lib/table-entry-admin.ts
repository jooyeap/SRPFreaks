import { z } from "zod";
import { apiFetch } from "@/lib/api";
import type { TableEntryResponse } from "@/lib/api-types";

/**
 * 서열표 값 수정(ROOT·ADMIN) 폼의 검사와 API 호출.
 * 서버(TableEntryUpdateRequest의 Validation)에도 같은 규칙이 있다. 화면에서 먼저 막는 건 오류를 바로 알려 주려는 것이다.
 * 추천도·속성은 서버가 쓰는 한글 값 그대로다. 빈 문자열은 "값 없음"이고 서버에는 null로 보낸다.
 */

export const RECOMMEND_CHOICES = ["상", "중", "하"] as const;
/** 수정 화면에서는 필터와 달리 `레이팅 제외`도 고를 수 있다 (D18). */
export const PATTERN_CHOICES = ["단일", "복합", "이중", "삼중", "레이팅 제외"] as const;

/** 정수부 1~2자리 + 선택적 소수 한 자리. 음수, 지수 표기, 공백은 모두 거른다. */
const TIER_FORMAT = /^\d{1,2}(\.\d)?$/;
const TIER_TOO_MANY_DECIMALS = /^\d{1,2}\.\d{2,}$/;

export const tableEntrySchema = z.object({
  /** 비우면 미정. 입력한 문자열 그대로 검사한다(부동소수점 오차를 피하려는 것). */
  tier: z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (value === "") {
        return; // 미정
      }
      if (TIER_TOO_MANY_DECIMALS.test(value)) {
        ctx.addIssue({ code: "custom", message: "레이팅 상수 난이도는 소수 첫째 자리까지만 입력할 수 있습니다." });
        return;
      }
      if (!TIER_FORMAT.test(value)) {
        ctx.addIssue({ code: "custom", message: "레이팅 상수 난이도는 0.0 이상의 숫자로 입력해 주세요." });
      }
    }),
  recommend: z.enum(["", ...RECOMMEND_CHOICES]),
  pattern: z.enum(["", ...PATTERN_CHOICES]),
  /** 레이팅 반영 스위치(D28). 꺼져 있으면 기준 난이도·속성이 있어도 레이팅에서 뺀다. */
  ratingEnabled: z.boolean(),
});

export type TableEntryFormValues = z.infer<typeof tableEntrySchema>;

/** 서버로 보내는 본문. 값이 없으면 null (PUT은 보낸 값으로 통째로 교체한다). */
export interface TableEntryUpdateBody {
  tierLabel: number | null;
  recommend: string | null;
  pattern: string | null;
  ratingEnabled: boolean;
}

export function toTableEntryBody(values: TableEntryFormValues): TableEntryUpdateBody {
  const tier = values.tier.trim();
  return {
    tierLabel: tier === "" ? null : Number(tier),
    recommend: values.recommend === "" ? null : values.recommend,
    pattern: values.pattern === "" ? null : values.pattern,
    ratingEnabled: values.ratingEnabled,
  };
}

/** 지금 서열표 값으로 폼 초기값을 만든다. 표에 없는 채보(entry가 null)는 모두 비운 채로 시작한다. */
export function tableEntryToFormValues(tier: number | null, entry: TableEntryResponse | null): TableEntryFormValues {
  const recommend = RECOMMEND_CHOICES.find((value) => value === entry?.recommend) ?? "";
  const pattern = PATTERN_CHOICES.find((value) => value === entry?.pattern) ?? "";
  // 표에 없던 채보(새 줄)는 꺼짐으로 시작한다. 서버의 새 줄 기본값(D28)과 같다.
  return { tier: tier === null ? "" : tier.toFixed(1), recommend, pattern, ratingEnabled: entry?.ratingEnabled ?? false };
}

export function saveTableEntry(
  tableId: number,
  songDifficultyId: number,
  body: TableEntryUpdateBody,
): Promise<TableEntryResponse> {
  return apiFetch<TableEntryResponse>(`/admin/difficulty-tables/${tableId}/entries/${songDifficultyId}`, {
    method: "PUT",
    body,
  });
}

/** 저장하면 서열표·곡 상세(["difficulty-tables"])와 레이팅(["skill"])이 바뀌므로 함께 새로 받는다. */
export const TABLE_ENTRY_AFFECTED_KEYS = [["difficulty-tables"], ["skill"]] as const;
