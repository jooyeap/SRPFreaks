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

import { ChartLine } from "@/components/table/ChartLine";
import { EntryCard } from "@/components/table/EntryCard";
import { StageRatePill } from "@/components/table/StageRatePill";
import type { TableEntryResponse } from "@/lib/api-types";
import type { InstrumentPart } from "@/lib/types";

const LONG_TITLE = "아주 아주 긴 곡 이름 아주 아주 긴 곡 이름 아주 아주 긴 곡 이름 아주 아주 긴 곡 이름";

function line(over: { part?: InstrumentPart; pattern?: string | null; tier?: number | null; title?: string; jacket?: boolean; stage?: "SS" | null } = {}) {
  return (
    <ul>
      <ChartLine
        jacket={over.jacket === false ? null : { url: null }}
        pattern={over.pattern === undefined ? "복합(단일)" : over.pattern}
        tier={over.tier === undefined ? 5.4 : over.tier}
        title={over.title ?? "KAISER PHOENIX"}
        href="/songs/1"
        part={over.part ?? "GUITAR"}
        difficulty="MASTER"
        level={9.65}
        stage={over.stage ?? null}
        aside={<StageRatePill stage={over.stage ?? null} rate={over.stage ? 95.7 : null} />}
      />
    </ul>
  );
}

describe("공통 줄 ChartLine (D64 줄 통일)", () => {
  beforeEach(() => {
    localStorage.clear();
    resetShowJacketsForTest();
    act(() => setJacketData({ enabled: true, jackets: {} }));
  });
  afterEach(() => {
    state.locale = "ko";
    act(() => setJacketData(null));
  });

  it("윗줄은 `속성 | 서열 난이도 숫자`(라벨 없음), 아랫줄은 난이도 알약 하나 + 파트 글자(알약 안에 파트 없음)", () => {
    render(line());
    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("속성 복합(단일)|기준 5.4"); // `기준`은 읽기 프로그램용 숨김 글자
    const pill = within(row).getByText("MAS 9.65");
    expect(pill).toHaveAttribute("data-difficulty", "MASTER");
    expect(pill.className).toContain("leading-[18px]");
    expect(pill).not.toHaveTextContent("Guitar");
    const part = within(row).getByText("Guitar");
    expect(part).toHaveClass("text-part-text-guitar");
    expect(part.className).not.toMatch(/#[0-9a-f]{3,6}|rgb\(/i);
    expect(pill.nextElementSibling).toBe(part); // 파트 글자는 알약 바로 옆
  });

  it("Bass는 청록 글자 토큰이고 글자 `Bass`를 그대로 적는다", () => {
    render(line({ part: "BASS" }));
    expect(screen.getByText("Bass")).toHaveClass("text-part-text-bass");
  });

  it("줄 높이는 68px 하나이고 곡명·속성 길이, 재킷 켬/끔, 기록 유무와 상관없다", () => {
    for (const over of [{}, { pattern: "삼중" }, { pattern: null, tier: null }, { title: LONG_TITLE }, { jacket: false }, { stage: "SS" as const }]) {
      const { unmount } = render(line(over));
      expect(screen.getByRole("listitem")).toHaveClass("h-[68px]");
      unmount();
    }
  });

  it("곡명은 한 줄 말줄임이고 속성 윗줄도 한 줄 말줄임이다(가장 긴 `복합(단일)`도 줄바꿈하지 않는다)", () => {
    render(line({ title: LONG_TITLE }));
    const row = screen.getByRole("listitem");
    expect(within(row).getByRole("link")).toHaveClass("truncate");
    expect(within(row).getByText("MAS 9.65").parentElement).toHaveClass("overflow-hidden");
    expect(row.querySelector("p > span")).toHaveClass("truncate");
  });

  it("재킷 켬: 48px(360px 미만 40px) 칸 + pl-3, 끔: 칸이 없고 pl-4 (배치는 같다)", () => {
    const { unmount } = render(line());
    const on = screen.getByRole("listitem");
    expect(on).toHaveClass("pl-3");
    expect(on.querySelector(".size-12")).toHaveClass("max-[359px]:size-10");
    unmount();
    render(line({ jacket: false }));
    const off = screen.getByRole("listitem");
    expect(off).toHaveClass("pl-4");
    expect(off.querySelector(".size-12")).toBeNull();
    expect(off).toHaveTextContent("속성 복합(단일)|기준 5.4");
  });

  it("기록이 없으면 오른쪽은 `[– | –]` 알약이고 `기록 없음` 글자는 없다", () => {
    render(line());
    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("––");
    expect(row).not.toHaveTextContent("기록 없음");
  });

  it("서열 난이도가 없으면 `미정`, 속성이 없으면 `–`", () => {
    render(line({ pattern: null, tier: null }));
    expect(screen.getByRole("listitem")).toHaveTextContent("속성 –|기준 미정");
  });

  it("일본어: 가장 긴 속성 `複合(単色)`와 `基準 5.4`가 윗줄에 그대로 들어간다", () => {
    state.locale = "ja";
    render(line());
    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("属性 複合(単色)|基準 5.4");
    expect(within(row).getByText("MAS 9.65")).toBeInTheDocument();
  });

  it("lead 칸(라이벌 비교의 순번)은 재킷 왼쪽에 놓인다", () => {
    render(
      <ul>
        <ChartLine lead={<span data-testid="lead">3</span>} jacket={{ url: null }} pattern="단일" title="t" href="/s" part="GUITAR" difficulty="BASIC" level={1} />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect(row.firstElementChild).toBe(screen.getByTestId("lead"));
  });
});

describe("서열표 모바일 줄은 공통 줄을 쓴다", () => {
  const entry: TableEntryResponse = {
    entryId: 1, songDifficultyId: 10, songId: 100, title: "MIND ERUPTION", addedVersion: "V1", part: "BASS", difficulty: "EXTREME",
    level: 9.05, tierUncertain: false, recommend: "상", recommendUncertain: false, pattern: "단일", patternUncertain: false,
    ratingEnabled: true, mine: { rate: 92.93, fullCombo: false, stage: "S" },
  };
  beforeEach(() => {
    localStorage.clear();
    resetShowJacketsForTest();
    act(() => setJacketData({ enabled: false, jackets: {} }));
  });
  afterEach(() => {
    state.locale = "ko";
    act(() => setJacketData(null));
  });

  it("`속성 | 추천 상` 윗줄은 그대로(서열 난이도 숫자는 두지 않는다), 파트는 알약 밖 글자", () => {
    render(<ul><EntryCard entry={entry} tier={5.0} /></ul>);
    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("속성 단일|추천 상");
    expect(row).not.toHaveTextContent("기준");
    expect(within(row).getByText("EXT 9.05")).not.toHaveTextContent("Bass");
    expect(within(row).getByText("Bass")).toHaveClass("text-part-text-bass");
  });

  it("레이팅 점수의 소수 부분은 작게 보이고 전체 점수는 읽기 이름에 있다", () => {
    render(<ul><EntryCard entry={entry} tier={5.0} /></ul>);
    const chip = screen.getByLabelText(/레이팅 점수/);
    const small = chip.querySelector("span");
    expect(small?.textContent?.startsWith(".")).toBe(true);
    expect(small).toHaveClass("text-[9px]");
    expect(chip.textContent).toMatch(/^\d+\.\d\d$/);
  });
});
