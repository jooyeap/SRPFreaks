import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TableInfoCard } from "@/components/song/TableContext";
import type { TableEntryResponse, TierGroupResponse } from "@/lib/api-types";

describe("곡 상세 서열표 정보 카드", () => {
  it("카드 제목 `서열표 정보`가 화면에 보이고, 도움말 `?`가 그 옆에 있다", () => {
    const group = { tier: 5.6, total: 58, recorded: 18, exc: 0, fc: 0, ss: 3, s: 15, belowS: 0, averageRecorded: 88.07, averageWithZero: 27.33, entries: [] } as unknown as TierGroupResponse;
    const entry = { recommend: "HIGH", level: 9.9, ratingEnabled: true } as unknown as TableEntryResponse;
    render(<TableInfoCard group={group} entry={entry} />);
    const card = screen.getByRole("region", { name: "서열표 정보" });
    const heading = within(card).getByRole("heading", { name: "서열표 정보" });
    // 예전에는 화면 읽기 전용(sr-only)이라 `?`만 보였다
    expect(heading.className).not.toContain("sr-only");
    expect(heading.parentElement).toContainElement(within(card).getByRole("button", { name: /설명/ }));
  });
});

describe("서열표 변경 알림에서 왔을 때 (D61)", () => {
  const group = { tier: 7.0, total: 1, recorded: 1, exc: 0, fc: 0, ss: 0, s: 1, belowS: 0, averageRecorded: 90, averageWithZero: 90, entries: [] } as unknown as TierGroupResponse;
  const entry = { recommend: "MID", level: 8.2, ratingEnabled: true } as unknown as TableEntryResponse;

  it("이전 값(취소선)과 `변경` 칩을 보이고 카드를 강조한다", () => {
    render(<TableInfoCard group={group} entry={entry} arrival={{ beforeTier: 6.5, afterTier: 7.0, beforeScore: 1, afterScore: 2 }} />);
    const card = screen.getByRole("region", { name: "서열표 정보" });
    expect(card.className).toContain("arrive-glow");
    expect(card).toHaveTextContent("이전 값 6.5");
    expect(within(card).getByText("변경")).toBeInTheDocument();
  });

  it("알림 뒤에 또 바뀌어 지금 값과 다르면 강조하지 않는다", () => {
    render(<TableInfoCard group={group} entry={entry} arrival={{ beforeTier: 6.0, afterTier: 6.5, beforeScore: 1, afterScore: 2 }} />);
    const card = screen.getByRole("region", { name: "서열표 정보" });
    expect(card.className).not.toContain("arrive-glow");
    expect(within(card).queryByText("변경")).toBeNull();
  });
});
