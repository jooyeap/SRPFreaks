import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTranslator } from "use-intl/core";
import ja from "../../../messages/ja.json";
import ko from "../../../messages/ko.json";
import { resetShowJacketsForTest, setJacketData } from "@/lib/jackets";

// 공용 setup은 한국어 번역만 끼우므로, 이 파일에서는 locale을 바꿔 가며 ko/ja를 모두 확인한다.
const state = vi.hoisted(() => ({ locale: "ko" as "ko" | "ja" }));
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) =>
    createTranslator({ locale: state.locale, messages: state.locale === "ja" ? ja : ko, namespace } as never),
  useLocale: () => state.locale,
  NextIntlClientProvider: ({ children }: { children: unknown }) => children,
}));

import { RatingEntryCard } from "@/components/rating/RatingEntryCard";
import type { SkillEntryResponse } from "@/lib/api-types";

const entry: SkillEntryResponse = {
  rank: 1, songDifficultyId: 10, songId: 100, title: "KAISER PHOENIX", part: "GUITAR", difficulty: "MASTER", level: 9.9, tier: 5.6,
  pattern: "복합(단일)", achievementRate: 95.75, fullCombo: false, stage: "SS", ratingConstant: 11, value: 12, score: 240,
};

/** 정보 줄: `기준 … · 상수 …`가 들어 있는 줄 */
function infoLine(card: HTMLElement): HTMLElement {
  const line = Array.from(card.querySelectorAll("p")).find((p) => /기준|基準/.test(p.textContent ?? ""));
  if (!line) throw new Error("정보 줄이 없음");
  return line;
}

describe("레이팅 줄의 속성 표기 (2026-11-08, 모서리 칩)", () => {
  beforeEach(() => {
    localStorage.clear();
    resetShowJacketsForTest();
  });
  afterEach(() => {
    state.locale = "ko";
    act(() => setJacketData(null));
  });

  describe("재킷이 보일 때", () => {
    beforeEach(() => act(() => setJacketData({ enabled: true, jackets: {} }))); // 이미지 없는 곡의 단색 칸도 같다

    it("속성은 재킷 모서리 칩에만 나오고 정보 줄에는 없다 (ko)", () => {
      render(<ul><RatingEntryCard entry={entry} /></ul>);
      const card = screen.getByRole("listitem");
      const chip = within(card).getByTestId("pattern-chip");
      expect(chip).toHaveTextContent("복합(단일)");
      expect(chip).toHaveAttribute("title", "복합(단일)");
      expect(infoLine(card)).not.toHaveTextContent("복합(단일)");
      expect(infoLine(card)).toHaveTextContent("기준 5.6 · 상수 11.00");
      // 칩은 누르는 요소가 아니다
      expect(chip.closest("a,button")).toBeNull();
    });

    it("일본어도 같다 (複合(単色))", () => {
      state.locale = "ja";
      render(<ul><RatingEntryCard entry={entry} /></ul>);
      const card = screen.getByRole("listitem");
      expect(within(card).getByTestId("pattern-chip")).toHaveTextContent("複合(単色)");
      expect(within(card).getByTestId("pattern-chip")).toHaveAttribute("title", "複合(単色)");
      expect(infoLine(card)).not.toHaveTextContent("複合(単色)");
      expect(infoLine(card)).toHaveTextContent("基準 5.6 · 定数 11.00");
    });

    it("칩 규격: 모서리에 걸치고(-6px/-5px) 한 줄·말줄임·최대 84px, 색은 토큰만", () => {
      render(<ul><RatingEntryCard entry={entry} /></ul>);
      const chip = screen.getByTestId("pattern-chip");
      expect(chip).toHaveClass("-left-1.5", "-top-[5px]", "max-w-[84px]", "truncate", "whitespace-nowrap", "text-[10px]", "font-semibold", "leading-[15px]", "px-[5px]", "rounded-[7px]");
      expect(chip).toHaveClass("bg-page", "text-fg", "border-ctl", "shadow-sm");
      expect(chip.className).not.toMatch(/#[0-9a-f]{3,6}|rgb\(/i);
    });

    it("재킷 바깥 상자는 overflow visible이고, 자르기(overflow-hidden)는 안쪽 상자에만 있다", () => {
      render(<ul><RatingEntryCard entry={entry} /></ul>);
      const chip = screen.getByTestId("pattern-chip");
      const outer = chip.parentElement as HTMLElement;
      expect(outer.className).not.toContain("overflow-hidden");
      expect(outer).toHaveClass("size-[52px]");
      const inner = outer.firstElementChild as HTMLElement;
      expect(inner).toHaveClass("overflow-hidden", "rounded-[inherit]");
    });

    it("칩 글자는 읽기 프로그램에 읽힌다 (aria-hidden 안에 있지 않다)", () => {
      render(<ul><RatingEntryCard entry={entry} /></ul>);
      expect(screen.getByTestId("pattern-chip").closest('[aria-hidden="true"]')).toBeNull();
    });

    it("정보 줄의 글자 수가 속성 종류와 무관하다 → 줄 수(카드 높이)가 같다 (ko 복합(단일) / ja 複合(単色) / 단일)", () => {
      const texts: string[] = [];
      for (const [locale, pattern] of [["ko", "복합(단일)"], ["ja", "복합(단일)"], ["ko", "단일"], ["ja", "단일"]] as const) {
        state.locale = locale;
        const { unmount } = render(<ul><RatingEntryCard entry={{ ...entry, pattern }} /></ul>);
        texts.push(`${locale}:${infoLine(screen.getByRole("listitem")).textContent}`);
        unmount();
      }
      // 같은 언어면 속성이 달라도 정보 줄 글자가 완전히 같다
      expect(texts[0].slice(3)).toBe(texts[2].slice(3));
      expect(texts[1].slice(3)).toBe(texts[3].slice(3));
    });
  });

  describe("재킷이 없을 때", () => {
    it("속성은 정보 줄 맨 뒤에 그대로 나오고 칩은 없다 (ko)", () => {
      render(<ul><RatingEntryCard entry={entry} /></ul>);
      const card = screen.getByRole("listitem");
      expect(screen.queryByTestId("pattern-chip")).toBeNull();
      expect(infoLine(card)).toHaveTextContent("기준 5.6 · 상수 11.00 · 복합(단일)");
    });

    it("일본어도 같다", () => {
      state.locale = "ja";
      render(<ul><RatingEntryCard entry={entry} /></ul>);
      expect(infoLine(screen.getByRole("listitem"))).toHaveTextContent("基準 5.6 · 定数 11.00 · 複合(単色)");
    });
  });
});
