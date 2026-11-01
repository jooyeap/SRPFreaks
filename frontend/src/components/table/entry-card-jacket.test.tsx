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

describe("서열표 모바일 줄 (B+D 안)", () => {
  beforeEach(() => {
    localStorage.clear();
    resetShowJacketsForTest();
    act(() => setJacketData({ enabled: true, jackets: { "100": "/jackets/100.webp" } }));
  });
  afterEach(() => act(() => setJacketData(null)));

  it("재킷 켬: 48px 재킷, 곡명 위 `단일 | 추천 중`, 모두 줄 가운데, 줄 높이 68px", () => {
    render(<ul><EntryCard entry={base} tier={5.0} onRecord={() => {}} /></ul>);
    const row = screen.getByRole("listitem");
    expect(row.className).toContain("h-[68px]");
    const img = within(row).getByRole("img", { name: "MIND ERUPTION" });
    expect(img).toHaveAttribute("src", "/jackets/100.webp");
    expect(img.parentElement?.className).toContain("size-12");
    expect(img.parentElement?.className).toContain("max-[359px]:size-10");
    expect(row).toHaveTextContent("속성 단일|추천 중");
    expect(within(row).getByLabelText("달성 단계 EXC")).toHaveTextContent("EXC");
    expect(row).toHaveTextContent("MAX");
    expect(within(row).getAllByRole("button", { name: /MIND ERUPTION/ }).length).toBeGreaterThan(0);
  });

  it("기록이 없으면 알약은 [– | –], 줄 높이는 같다", () => {
    render(<ul><EntryCard entry={{ ...base, mine: null }} tier={5.0} /></ul>);
    const row = screen.getByRole("listitem");
    expect(row.className).toContain("h-[68px]");
    expect(within(row).queryByLabelText(/달성 단계/)).toBeNull();
    expect(row).toHaveTextContent("––");
  });

  it("속성·추천이 없으면 곡명 위 줄은 `–`", () => {
    render(<ul><EntryCard entry={{ ...base, pattern: null, recommend: null }} tier={5.0} /></ul>);
    expect(screen.getByRole("listitem")).toHaveTextContent("속성 –");
  });

  it("재킷을 끄면 재킷 칸만 없고 배치는 같다(곡명 위 `단일 | 추천 중`, 68px)", () => {
    act(() => setJacketData({ enabled: false, jackets: {} }));
    render(<ul><EntryCard entry={base} tier={5.0} /></ul>);
    const row = screen.getByRole("listitem");
    expect(within(row).queryByRole("img")).toBeNull();
    expect(row.className).toContain("h-[68px]");
    expect(row.className).toContain("pl-4");
    expect(row).toHaveTextContent("속성 단일|추천 중");
  });
});
