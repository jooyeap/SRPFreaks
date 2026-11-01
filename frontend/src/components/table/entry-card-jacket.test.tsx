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

describe("서열표 줄 + 재킷 썸네일 (D54)", () => {
  beforeEach(() => {
    localStorage.clear();
    resetShowJacketsForTest();
    act(() => setJacketData({ enabled: true, jackets: { "100": "/jackets/100.webp" } }));
  });
  afterEach(() => act(() => setJacketData(null)));

  it("44px 둥근 썸네일 + 재킷 전 배치(속성·달성률·추천·점수)", () => {
    render(<ul><EntryCard entry={base} tier={5.0} onRecord={() => {}} /></ul>);
    const row = screen.getByRole("listitem");
    expect(row.className).not.toContain("h-[72px]");
    const img = within(row).getByRole("img", { name: "MIND ERUPTION" });
    expect(img).toHaveAttribute("src", "/jackets/100.webp");
    expect(img.parentElement?.className).toContain("size-11");
    expect(img.parentElement?.className).toContain("max-[359px]:size-9"); // 360px 미만은 알약 자리를 위해 36px
    expect(row).toHaveTextContent("MAX");
    expect(row).toHaveTextContent("EXC");
    expect(row).toHaveTextContent("속성 단일");
    expect(row).not.toHaveTextContent("추천 중");
    expect(within(row).getAllByRole("button", { name: /MIND ERUPTION/ }).length).toBeGreaterThan(0);
  });

  it("재킷을 끄면 썸네일이 없다", () => {
    act(() => setJacketData({ enabled: false, jackets: {} }));
    render(<ul><EntryCard entry={base} tier={5.0} /></ul>);
    expect(within(screen.getByRole("listitem")).queryByRole("img")).toBeNull();
  });
});
