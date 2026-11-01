import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import ko from "../../../messages/ko.json";
import { EntryRow, TableHeadRow } from "@/components/table/EntryRow";
import type { TableEntryResponse } from "@/lib/api-types";

const base: TableEntryResponse = {
  entryId: 1, songDifficultyId: 10, songId: 100, title: "MIND ERUPTION", addedVersion: "V1", part: "BASS", difficulty: "MASTER",
  level: 9.05, tierUncertain: false, recommend: "중", recommendUncertain: false, pattern: "단일", patternUncertain: false,
  ratingEnabled: true, mine: { rate: 100, fullCombo: true, stage: "EXC" },
};

function renderRow(entry: TableEntryResponse, onRecord?: () => void) {
  return render(
    <NextIntlClientProvider locale="ko" messages={ko}>
      <TableHeadRow />
      <ul><EntryRow entry={entry} tier={5.0} onRecord={onRecord} /></ul>
    </NextIntlClientProvider>,
  );
}

describe("데스크톱 서열표 줄 (2026-11-01)", () => {
  it("머리 행은 곡명 · 채보 · 속성 · 추천 · 랭크·달성률 · 점수 순서", () => {
    const { container } = renderRow(base);
    const head = container.firstElementChild;
    expect(head?.children).toHaveLength(7);
    expect(head).toHaveTextContent("곡명채보속성추천랭크 · 달성률점수");
  });

  it("기록이 있으면 막대·[EXC | MAX] 알약·점수, 기록 버튼은 +", () => {
    renderRow(base, () => {});
    const row = screen.getByRole("listitem");
    expect(row.className).toContain("h-14");
    expect(row.querySelector(".stage-bar")).not.toBeNull();
    expect(within(row).getByLabelText("달성 단계 EXC")).toHaveTextContent("EXC");
    expect(row).toHaveTextContent("MAX");
    expect(within(row).getByRole("button", { name: "MIND ERUPTION 기록 입력" })).toHaveTextContent("+");
  });

  it("기록이 없으면 막대 없이 [– | –]", () => {
    renderRow({ ...base, mine: null });
    const row = screen.getByRole("listitem");
    expect(row.querySelector(".stage-bar")).toBeNull();
    expect(row).toHaveTextContent("––");
  });
});
