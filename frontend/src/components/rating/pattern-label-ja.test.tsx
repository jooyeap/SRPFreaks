import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createTranslator } from "use-intl/core";
import ja from "../../../messages/ja.json";

// 공용 setup은 한국어 번역을 끼우므로, 이 파일에서만 일본어로 바꿔서 "서버 값(단일)이 화면에서 단색으로 바뀌는지" 확인한다.
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => createTranslator({ locale: "ja", messages: ja, namespace } as never),
  useLocale: () => "ja",
  NextIntlClientProvider: ({ children }: { children: unknown }) => children,
}));

import { RatingEntryCard } from "@/components/rating/RatingEntryCard";
import { EntryRow } from "@/components/table/EntryRow";
import type { SkillEntryResponse, TableEntryResponse } from "@/lib/api-types";

const skillEntry: SkillEntryResponse = {
  rank: 1, songDifficultyId: 10, songId: 100, title: "テスト曲", part: "GUITAR", difficulty: "MASTER", level: 9.8, tier: 5.8,
  pattern: "단일", achievementRate: 95.17, fullCombo: false, stage: "SS", ratingConstant: 13, value: 13.6, score: 272,
};

describe("속성 표시 (일본어)", () => {
  it("레이팅 카드는 서버 값 `단일`을 `単色`으로 보여 준다", () => {
    render(<RatingEntryCard entry={skillEntry} />);
    expect(screen.getByText(/単色/)).toBeInTheDocument();
    expect(screen.queryByText(/단일/)).not.toBeInTheDocument();
  });

  it("서열표 행도 속성을 `単色`으로 보여 준다", () => {
    const entry = {
      entryId: 1, songDifficultyId: 1, songId: 1, title: "テスト曲", addedVersion: "V5", part: "GUITAR", difficulty: "MASTER", level: 9.5,
      tierUncertain: false, recommend: "상", recommendUncertain: false, pattern: "단일", patternUncertain: false, ratingEnabled: true, mine: null,
    } as unknown as TableEntryResponse;
    render(<EntryRow entry={entry} />);
    expect(screen.getByText("単色")).toBeInTheDocument();
    expect(screen.queryByText("단일")).not.toBeInTheDocument();
  });
});
