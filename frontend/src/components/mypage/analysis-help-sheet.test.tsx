import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTranslator } from "use-intl/core";
import ja from "../../../messages/ja.json";
import ko from "../../../messages/ko.json";
import { resetHistoryLayersForTest } from "@/lib/history-layers";

const state = vi.hoisted(() => ({ locale: "ko" as "ko" | "ja" }));
vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) =>
    createTranslator({ locale: state.locale, messages: state.locale === "ja" ? ja : ko, namespace } as never),
  useLocale: () => state.locale,
  NextIntlClientProvider: ({ children }: { children: unknown }) => children,
}));

import { AnalysisHelpSheet } from "@/components/mypage/AnalysisHelpSheet";

const layerKey = () => (typeof window.history.state === "object" && window.history.state !== null ? ((window.history.state as Record<string, unknown>).__srpLayer ?? null) : null);

function openSheet() {
  fireEvent.click(screen.getByRole("button", { name: "계산 방법 설명 보기" }));
}
function item(n: number) {
  return screen.getAllByRole("button", { expanded: false }).concat(screen.getAllByRole("button", { expanded: true })).find((b) => b.textContent?.startsWith(String(n)))!;
}

describe("분석 탭 계산 설명 시트", () => {
  beforeEach(() => {
    state.locale = "ko";
    resetHistoryLayersForTest();
    window.history.replaceState(null, "", "/a");
    window.history.pushState(null, "", "/b");
  });

  it("? 버튼을 누르면 시트가 열리고 닫기로 닫힌다", () => {
    render(<AnalysisHelpSheet minCharts={3} minBandUsers={5} />);
    expect(screen.queryByText("어떻게 계산되나요?")).toBeNull();
    openSheet();
    expect(screen.getByText("어떻게 계산되나요?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByText("어떻게 계산되나요?")).toBeNull();
  });

  it("항목 8개가 제목만 접힌 채 보인다", () => {
    render(<AnalysisHelpSheet minCharts={3} minBandUsers={5} />);
    openSheet();
    const titles = ["무엇과 비교하나요?", "막대와 오른쪽 숫자", "속성별", "난이도대별", "「약점」 표시", "올리기 쉬운 곡 3개", "「비교 대상이 적어요」", "알아 둘 점"];
    titles.forEach((title) => expect(screen.getByText(title), title).toBeTruthy());
    expect(screen.getAllByRole("button", { expanded: false })).toHaveLength(8);
  });

  it("누른 항목만 펼쳐지고 다시 누르면 접힌다", () => {
    render(<AnalysisHelpSheet minCharts={3} minBandUsers={5} />);
    openSheet();
    expect(screen.queryByText(/같은 조건으로 비교합니다/)).toBeNull();
    fireEvent.click(item(1));
    expect(screen.getByText(/같은 조건으로 비교합니다/)).toBeTruthy();
    fireEvent.click(item(3));
    expect(screen.getByText(/복합\(단일\)은 복합에 함께 묶습니다/)).toBeTruthy();
    expect(screen.getByText(/같은 조건으로 비교합니다/)).toBeTruthy();
    fireEvent.click(item(1));
    expect(screen.queryByText(/같은 조건으로 비교합니다/)).toBeNull();
  });

  it("{max}·{min}·{n}이 값으로 채워진다", () => {
    render(<AnalysisHelpSheet minCharts={3} minBandUsers={7} />);
    openSheet();
    fireEvent.click(item(1));
    fireEvent.click(item(5));
    fireEvent.click(item(7));
    expect(screen.getByText(/최대 40곡/)).toBeTruthy();
    expect(screen.getByText(/그 난이도대 곡이 3곡 이상/)).toBeTruthy();
    expect(screen.getByText(/\(기준 7명\)/)).toBeTruthy();
    expect(screen.queryByText(/\{(max|min|n)\}/)).toBeNull();
  });

  it("minBandUsers가 없으면 항목 7에서 (기준 n명)만 빠진다", () => {
    render(<AnalysisHelpSheet minCharts={3} />);
    openSheet();
    fireEvent.click(item(7));
    const p = screen.getByText(/같은 티어 공개 유저가 너무 적으면/);
    expect(p.textContent).toBe(ko.AnalysisHelp.i7BodyNoN);
    expect(p.textContent).not.toContain("기준");
  });

  it("문구의 줄바꿈이 번역 파일 그대로 보이고 pre-line·keep-all로 그려진다", () => {
    render(<AnalysisHelpSheet minCharts={3} minBandUsers={5} />);
    openSheet();
    fireEvent.click(item(8));
    const p = screen.getByText(/실시간 값이 아니고/);
    expect(p.textContent).toBe(ko.AnalysisHelp.i8Body);
    expect(p.textContent).toContain("\n\n");
    expect(p.className).toContain("whitespace-pre-line");
    expect(p.className).toContain("break-keep");
    expect(p.className).toContain("leading-[1.75]");
  });

  it("항목 5의 조건은 · 로 한 줄씩 나온다", () => {
    render(<AnalysisHelpSheet minCharts={3} minBandUsers={5} />);
    openSheet();
    fireEvent.click(item(5));
    const lines = screen.getByText(/아래 조건을 모두 만족하는/).textContent!.split("\n");
    expect(lines.filter((l) => l.startsWith("· "))).toHaveLength(3);
  });

  it("항목 2 본문은 확정 문구 그대로(줄바꿈 포함)이고 옛 흰 선·마이너스/플러스 설명은 없다", () => {
    render(<AnalysisHelpSheet minCharts={3} minBandUsers={5} />);
    openSheet();
    fireEvent.click(item(2));
    const p = screen.getByText(/초록 막대는 내 평균 달성률/);
    expect(p.textContent).toBe(
      "초록 막대는 내 평균 달성률, 회색 막대는 같은 티어 평균 달성률입니다.\n막대가 길수록 평균 달성률이 높고, 두 막대의 차이가 오른쪽 위 차이값입니다.",
    );
    expect(p.textContent).toBe(ko.AnalysisHelp.i2Body);
    expect(p.className).toContain("whitespace-pre-line");
    expect(screen.queryByText(/흰 선|마이너스|플러스/)).toBeNull();
  });

  it("항목 2 그림은 분석 탭과 같은 두 줄 막대(나 초록 / 같은 티어 회색)이고 흰 선·예시 계산은 없다", () => {
    render(<AnalysisHelpSheet minCharts={3} minBandUsers={5} />);
    openSheet();
    fireEvent.click(item(2));
    const me = document.querySelector('[data-fig-bar="me"]') as HTMLElement;
    const peer = document.querySelector('[data-fig-bar="peer"]') as HTMLElement;
    expect(me).toHaveTextContent("나");
    expect(peer).toHaveTextContent("같은 티어");
    expect((me.querySelector('[aria-hidden="true"] > div') as HTMLElement).className).toContain("bg-done");
    expect((peer.querySelector('[aria-hidden="true"] > div') as HTMLElement).className).toContain("bg-ctl");
    expect(document.querySelector(".bg-fg")).toBeNull();
    expect(screen.queryByText(/−2\.35%|막대 끝/)).toBeNull();
  });

  it("뒤로 가기를 누르면 시트만 닫힌다", async () => {
    render(<AnalysisHelpSheet minCharts={3} minBandUsers={5} />);
    openSheet();
    expect(layerKey()).not.toBeNull();
    window.history.back();
    await waitFor(() => expect(screen.queryByText("어떻게 계산되나요?")).toBeNull());
    expect(window.location.pathname).toBe("/b");
  });

  it("일본어도 8개 항목이 같은 구조로 나오고 {n}이 채워진다", () => {
    state.locale = "ja";
    render(<AnalysisHelpSheet minCharts={3} minBandUsers={5} />);
    fireEvent.click(screen.getByRole("button", { name: "計算方法の説明を見る" }));
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(8);
    fireEvent.click(within(dialog).getByText("「比較対象が少ないです」"));
    expect(within(dialog).getByText(/基準5人/)).toBeTruthy();
  });
});
