import { describe, expect, it } from "vitest";
import { createTranslator } from "use-intl/core";
import ja from "../../messages/ja.json";
import ko from "../../messages/ko.json";
import type { Translator } from "@/i18n/translator";
import { patternLabel } from "@/lib/chart-labels";
import { PATTERN_OPTIONS } from "@/lib/difficulty-table";
import { PATTERN_CHOICES } from "@/lib/table-entry-admin";

const tKo = createTranslator({ locale: "ko", messages: ko } as never) as unknown as Translator;
const tJa = createTranslator({ locale: "ja", messages: ja } as never) as unknown as Translator;

describe("patternLabel 복합(단일) (D62)", () => {
  it("한국어는 복합(단일), 일본어는 기존 複合・単色을 조합한 複合(単色)", () => {
    expect(patternLabel("복합(단일)", tKo)).toBe("복합(단일)");
    expect(patternLabel("복합(단일)", tJa)).toBe("複合(単色)");
  });

  it("기존 속성 라벨은 그대로다", () => {
    expect(patternLabel("복합", tKo)).toBe("복합");
    expect(patternLabel("복합", tJa)).toBe("複合");
    expect(patternLabel("단일", tJa)).toBe("単色");
  });

  it("서열표 필터 칩과 관리자 선택지에 복합(단일)이 있다", () => {
    expect(PATTERN_OPTIONS).toContain("복합(단일)");
    expect(PATTERN_CHOICES).toContain("복합(단일)");
    expect(PATTERN_OPTIONS.filter((v) => v !== "단일")).toContain("복합(단일)");
  });
});
