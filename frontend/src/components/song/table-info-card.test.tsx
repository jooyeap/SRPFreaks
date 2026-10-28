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
