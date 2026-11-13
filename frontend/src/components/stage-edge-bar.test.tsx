import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import ko from "../../messages/ko.json";
import { STAGE_EDGE_CLIP, StageEdgeBar } from "@/components/StageEdgeBar";
import { ChartRow } from "@/components/songs/ChartRow";
import { ChartLine } from "@/components/table/ChartLine";
import { EntryRow } from "@/components/table/EntryRow";
import type { ChartRowResponse, TableEntryResponse } from "@/lib/api-types";

/**
 * 달성 단계 막대(stage-bar)와 줄 모서리 (2026-11-13).
 * 막대는 네모라서 둥근 카드(rounded-2xl border)에서 모서리 밖으로 곧게 튀어나왔다. 막대를 쓰는 세 줄(ChartRow, ChartLine, EntryRow)은
 * 막대가 있든 없든 같은 클래스(overflow-hidden 포함)를 가져서 줄의 바깥 크기와 왼쪽 끝이 같고, 막대는 줄의 둥근 모서리에서 잘린다.
 */

function withIntl(ui: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="ko" messages={ko}>
      <ul>{ui}</ul>
    </NextIntlClientProvider>
  );
}

/** 막대·단계 틴트에 해당하는 클래스를 빼고 남는 클래스(= 막대 유무와 관계없이 같아야 하는 줄 바깥 모양) */
function frameClasses(el: HTMLElement): string[] {
  return el.className
    .split(/\s+/)
    .filter((c) => c && c !== "stage-tint")
    .sort();
}

describe("StageEdgeBar", () => {
  it("막대 한 개: 줄 안쪽 왼쪽 끝 4px, 색은 stage-bar 변수 클래스, 읽기 프로그램에는 숨김", () => {
    const { container } = render(<StageEdgeBar />);
    const bar = container.firstElementChild as HTMLElement;
    expect(bar.className).toBe("stage-bar absolute inset-y-0 left-0 w-1");
    expect(bar).toHaveAttribute("aria-hidden", "true");
    expect(STAGE_EDGE_CLIP).toBe("overflow-hidden");
  });
});

describe("막대 유무와 관계없이 줄의 바깥 모양이 같다", () => {
  it("ChartLine(모바일 한 줄, 둥근 카드): 막대가 있어도 없어도 같은 클래스, overflow-hidden으로 모서리에서 잘린다", () => {
    const props = { jacket: null, pattern: "단일", title: "A", href: "/songs/1", part: "GUITAR" as const, difficulty: "MASTER" as const, level: 9.5, className: "rounded-2xl border border-line bg-card" };
    const { unmount } = render(withIntl(<ChartLine {...props} stage="SS" />));
    const withBar = screen.getByRole("listitem");
    expect(withBar.querySelector(".stage-bar")).not.toBeNull();
    expect(withBar).toHaveClass("overflow-hidden", "rounded-2xl");
    const withClasses = frameClasses(withBar);
    unmount();
    render(withIntl(<ChartLine {...props} stage={null} />));
    const without = screen.getByRole("listitem");
    expect(without.querySelector(".stage-bar")).toBeNull();
    expect(frameClasses(without)).toEqual(withClasses);
  });

  it("ChartRow(곡 목록 줄): 막대가 있어도 없어도 같은 클래스(overflow-hidden 포함)", () => {
    const base: ChartRowResponse = { songDifficultyId: 1, songId: 1, title: "A", addedVersion: null, part: "GUITAR", difficulty: "MASTER", level: 9.5, mine: null };
    const mine = { rate: 95.7, fullCombo: false, stage: "SS" as const };
    const { unmount } = render(withIntl(<ChartRow row={{ ...base, mine }} />));
    const withBar = screen.getByRole("listitem");
    expect(withBar.querySelector(".stage-bar")).not.toBeNull();
    expect(withBar).toHaveClass("overflow-hidden");
    const withClasses = frameClasses(withBar);
    unmount();
    render(withIntl(<ChartRow row={base} />));
    const without = screen.getByRole("listitem");
    expect(without.querySelector(".stage-bar")).toBeNull();
    expect(frameClasses(without)).toEqual(withClasses);
  });

  it("EntryRow(데스크톱 서열표 줄): 막대가 있어도 없어도 같은 클래스(overflow-hidden 포함)", () => {
    const base: TableEntryResponse = {
      entryId: 1, songDifficultyId: 10, songId: 100, title: "MIND ERUPTION", addedVersion: "V1", part: "BASS", difficulty: "MASTER",
      level: 9.05, tierUncertain: false, recommend: "중", recommendUncertain: false, pattern: "단일", patternUncertain: false,
      ratingEnabled: true, mine: { rate: 95.7, fullCombo: false, stage: "SS" },
    };
    const { unmount } = render(withIntl(<EntryRow entry={base} tier={5.0} />));
    const withBar = screen.getByRole("listitem");
    expect(withBar.querySelector(".stage-bar")).not.toBeNull();
    expect(withBar).toHaveClass("overflow-hidden");
    const withClasses = frameClasses(withBar);
    unmount();
    render(withIntl(<EntryRow entry={{ ...base, mine: null }} tier={5.0} />));
    const without = screen.getByRole("listitem");
    expect(without.querySelector(".stage-bar")).toBeNull();
    expect(frameClasses(without)).toEqual(withClasses);
  });
});
