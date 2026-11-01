import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EntryCard } from "@/components/table/EntryCard";
import type { TableEntryResponse } from "@/lib/api-types";
import { resetShowJacketsForTest, setJacketData } from "@/lib/jackets";

const base: TableEntryResponse = {
  entryId: 1, songDifficultyId: 10, songId: 100, title: "MIND ERUPTION", addedVersion: "V1", part: "BASS", difficulty: "MASTER",
  level: 9.05, tierUncertain: false, recommend: "중", recommendUncertain: false, pattern: "단일", patternUncertain: false,
  ratingEnabled: true, mine: { rate: 100, fullCombo: true, stage: "EXC" },
};

describe("서열표 줄 + 재킷 (D54 A안)", () => {
  beforeEach(() => {
    localStorage.clear();
    resetShowJacketsForTest();
    act(() => setJacketData({ enabled: true, jackets: { "100": "/jackets/100.webp" } }));
  });
  afterEach(() => act(() => setJacketData(null)));

  it("72px 세 줄: 곡명·달성률 / 알약·단계·점수 / 속성·추천", () => {
    render(<ul><EntryCard entry={base} tier={5.0} onRecord={() => {}} /></ul>);
    const row = screen.getByRole("listitem");
    expect(row.className).toContain("h-[72px]");
    expect(within(row).getByRole("img", { name: "MIND ERUPTION" })).toHaveAttribute("src", "/jackets/100.webp");
    expect(row).toHaveTextContent("MAX");
    expect(row).toHaveTextContent("EXC");
    expect(row).toHaveTextContent("단일 · 추천 중");
    expect(within(row).getAllByRole("button", { name: /MIND ERUPTION/ }).length).toBeGreaterThan(0);
  });

  it("추천이 없으면 속성만 쓴다", () => {
    render(<ul><EntryCard entry={{ ...base, recommend: null, mine: null }} tier={5.0} /></ul>);
    expect(screen.getByRole("listitem")).toHaveTextContent("속성 단일");
  });
});
