import { render, screen } from "@testing-library/react";
import { createTranslator } from "use-intl/core";
import { describe, expect, it, vi } from "vitest";
import { FolderNeighborBar } from "@/components/table/FolderNeighborBar";
import type { TierGroupResponse } from "@/lib/api-types";
import ja from "../../../messages/ja.json";
import ko from "../../../messages/ko.json";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

const g = (tier: number): TierGroupResponse =>
  ({ tier, total: 18, recorded: 5, exc: 0, fc: 0, ss: 0, s: 0, belowS: 0, averageRecorded: null, averageWithZero: 0, entries: [] });

describe("FolderNeighborBar", () => {
  it("진행 막대 폭은 기록 수 ÷ 전체 × 100 이다 (5/18 = 27.778%)", () => {
    render(<FolderNeighborBar neighbors={{ lower: g(5.7), higher: g(5.9) }} tier={5.8} recorded={5} total={18} />);
    expect(screen.getByTestId("folder-pill-fill")).toHaveStyle({ width: "27.778%" });
    expect(screen.getByText("5/18")).toBeInTheDocument();
  });

  it("전체/전체는 가득 찬 막대(100%)", () => {
    render(<FolderNeighborBar neighbors={{ lower: null, higher: null }} tier={5.8} recorded={18} total={18} />);
    expect(screen.getByTestId("folder-pill-fill")).toHaveStyle({ width: "100%" });
  });

  it("바 높이를 --bottom-bar-h 로 알리고 사라지면 지운다 (토스트가 바 위로 올라간다)", () => {
    const { unmount } = render(<FolderNeighborBar neighbors={{ lower: null, higher: null }} tier={5.8} recorded={0} total={3} />);
    expect(document.documentElement.style.getPropertyValue("--bottom-bar-h")).toBe("67px");
    unmount();
    expect(document.documentElement.style.getPropertyValue("--bottom-bar-h")).toBe("");
  });

  it("접근성 이름: 한국어 `이전 난이도 5.7` / `다음 난이도 5.9`, 일본어는 기존 `前へ`/`次へ` + `難易度`", () => {
    const tko = createTranslator({ locale: "ko", messages: ko, namespace: "Table" } as never);
    const tja = createTranslator({ locale: "ja", messages: ja, namespace: "Table" } as never);
    expect(tko("neighborPrevTier", { tier: "5.7" })).toBe("이전 난이도 5.7");
    expect(tko("neighborNextTier", { tier: "5.9" })).toBe("다음 난이도 5.9");
    expect(tja("neighborPrevTier", { tier: "5.7" })).toBe("前へ 難易度 5.7");
    expect(tja("neighborNextTier", { tier: "5.9" })).toBe("次へ 難易度 5.9");
  });
});
