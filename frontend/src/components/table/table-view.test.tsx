import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ROW_GRID } from "@/components/table/EntryRow";
import { StageBadge } from "@/components/table/StageBadge";
import { TierGroupSection, groupStage } from "@/components/table/TierGroupSection";
import type { TableEntryResponse, TierGroupResponse } from "@/lib/api-types";

function entry(over: Partial<TableEntryResponse> = {}): TableEntryResponse {
  return {
    entryId: 1,
    songDifficultyId: 10,
    songId: 100,
    title: "테스트곡",
    addedVersion: "V1",
    part: "GUITAR",
    difficulty: "MASTER",
    level: 9.5,
    tierUncertain: false,
    recommend: "상",
    recommendUncertain: false,
    pattern: "단일",
    patternUncertain: false,
    ratingEnabled: true,
    mine: { rate: 96.5, fullCombo: false, stage: "SS" },
    ...over,
  };
}

function group(over: Partial<TierGroupResponse> = {}): TierGroupResponse {
  return {
    tier: 5.8,
    total: 4,
    recorded: 3,
    exc: 1,
    fc: 0,
    ss: 1,
    s: 0,
    belowS: 1,
    averageRecorded: 90,
    averageWithZero: 67.5,
    entries: [entry()],
    ...over,
  };
}

describe("StageBadge", () => {
  it("단계 글자를 항상 표시한다 (색만으로 구분하지 않는다)", () => {
    render(<StageBadge stage="EXC" />);
    expect(screen.getByLabelText("달성 단계 EXC")).toHaveTextContent("EXC");
  });
});

describe("groupStage (묶음 전체 달성 단계)", () => {
  const all = (over: Partial<TierGroupResponse>) => group({ total: 4, recorded: 4, exc: 0, fc: 0, ss: 0, s: 0, belowS: 0, ...over });

  it("모든 곡이 EXC면 EXC", () => {
    expect(groupStage(all({ exc: 4 }))).toBe("EXC");
  });
  it("모든 곡이 같은 단계 '이상'이면 가장 낮은 그 단계 (EXC 1 + FC 1 + SS 2 → SS)", () => {
    expect(groupStage(all({ exc: 1, fc: 1, ss: 2 }))).toBe("SS");
    expect(groupStage(all({ exc: 1, fc: 3 }))).toBe("FC");
    expect(groupStage(all({ ss: 1, s: 3 }))).toBe("S");
  });
  it("한 곡이라도 S 미만이거나 기록이 없으면 없음", () => {
    expect(groupStage(all({ exc: 3, belowS: 1 }))).toBeNull();
    expect(groupStage(all({ exc: 3, recorded: 3 }))).toBeNull(); // 미플레이 1곡
  });
  it("곡이 0개인 묶음은 없음", () => {
    expect(groupStage(all({ total: 0, recorded: 0 }))).toBeNull();
  });
});

describe("TierGroupSection", () => {
  it("최근 변경이 있으면 머리에 `최근 변경 n` 칩이 서열표 변경 탭으로 연결되고, 없으면 칩이 없다", () => {
    const { rerender } = render(<TierGroupSection group={group()} includeZero={false} recentChanges={2} />);
    expect(screen.getByRole("link", { name: "최근 서열표 변경 2건, 서열표 변경 보기" })).toHaveAttribute("href", "/notices#tier-changes");
    expect(screen.getByText("최근 변경 2")).toBeInTheDocument();
    rerender(<TierGroupSection group={group()} includeZero={false} />);
    expect(screen.queryByText(/최근 변경/)).toBeNull();
  });

  it("묶음 전체가 한 단계 이상이면 머리에 단계 효과(막대)가 붙고, 아니면 붙지 않는다", () => {
    const { container, rerender } = render(
      <TierGroupSection group={group({ total: 4, recorded: 4, exc: 1, fc: 0, ss: 3, s: 0, belowS: 0 })} includeZero={false} />,
    );
    expect(container.querySelector("header[data-group-stage='SS']")).not.toBeNull();
    expect(container.querySelector("header .stage-bar")).not.toBeNull();
    rerender(<TierGroupSection group={group()} includeZero={false} />);
    expect(container.querySelector("header[data-group-stage]")).toBeNull();
    expect(container.querySelector("header .stage-bar")).toBeNull();
  });

  it("제목, 0이 아닌 단계 칩(순서 그대로), 기록 n/전체, 미포함 평균을 보여 준다", () => {
    render(<TierGroupSection group={group()} includeZero={false} />);
    expect(screen.getByRole("heading", { name: /5\.8\s*4개/ })).toBeInTheDocument();
    const chips = within(screen.getByRole("list", { name: "내 달성 현황" })).getAllByRole("listitem");
    // 0인 칩(FC 0, S 0)은 숨긴다(2026-10-27)
    expect(chips.map((c) => c.textContent)).toEqual(["EXC 1", "SS 1", "S 미만 1"]);
    expect(screen.getByText("기록 3/4")).toBeInTheDocument();
    expect(screen.getByText("90.00%")).toBeInTheDocument();
  });

  it("'0% 포함'이면 서버가 준 0% 포함 평균을 보여 준다", () => {
    render(<TierGroupSection group={group()} includeZero />);
    expect(screen.getByText("67.50%")).toBeInTheDocument();
  });

  it("기록이 하나도 없는 묶음은 미포함 평균을 `–`로 보여 준다", () => {
    render(
      <TierGroupSection
        group={group({ recorded: 0, exc: 0, ss: 0, belowS: 0, averageRecorded: null, averageWithZero: 0, entries: [entry({ mine: null })] })}
        includeZero={false}
      />,
    );
    expect(screen.getByText("기록 0/4")).toBeInTheDocument();
    // 기록이 없으면 단계 칩이 하나도 없다(0 칩 숨김)
    expect(within(screen.getByRole("list", { name: "내 달성 현황" })).queryAllByRole("listitem")).toHaveLength(0);
    // `–`는 줄마다 달성률 자리에도 나오므로 평균 문구 안에서만 확인한다
    expect(screen.getByText(/^평균/)).toHaveTextContent("평균 –");
  });

  it("레이팅 상수 난이도가 없는 묶음은 `미정`이라고 쓴다", () => {
    render(<TierGroupSection group={group({ tier: null })} includeZero={false} />);
    expect(screen.getByRole("heading", { name: /미정/ })).toBeInTheDocument();
  });

  it("기록이 있는 줄은 단계 표시와 달성률을, 없는 줄은 단계 없이 `–`를 보여 준다", () => {
    render(
      <TierGroupSection
        group={group({
          entries: [
            entry({ entryId: 1, title: "기록있음", mine: { rate: 100, fullCombo: true, stage: "EXC" } }),
            entry({ entryId: 2, title: "기록없음", mine: null }),
          ],
        })}
        includeZero={false}
      />,
    );
    // 모바일 카드와 데스크톱 줄이 둘 다 DOM에 있어 곡명이 두 번씩 나온다 (보이는 쪽은 CSS가 정한다)
    expect(screen.getAllByText("기록있음")).toHaveLength(2);
    expect(screen.getAllByLabelText("달성 단계 EXC").length).toBeGreaterThan(0);
    expect(screen.getAllByText("MAX").length).toBeGreaterThan(0);
    expect(screen.queryAllByLabelText(/달성 단계/)).toHaveLength(2); // 기록 있는 곡의 카드 + 줄 하나씩, 기록 없는 곡은 없음
  });

  it("기록이 있는 줄은 레이팅에 찍히는 점수를 티어 색으로 보인다 (5.8, 96.5% -> 272.00)", () => {
    render(<TierGroupSection group={group({ entries: [entry({ entryId: 1 }), entry({ entryId: 2, title: "기록없음", mine: null })] })} includeZero={false} />);
    // 기록 있는 곡만 카드 + 줄 하나씩. 점수 = (13×0.8 + 3.2) × 20, 272는 Alien 구간(250 이상 275 미만)이다
    const scores = screen.getAllByLabelText("레이팅 점수 272.00");
    expect(scores).toHaveLength(2);
    expect(scores[0]).toHaveTextContent("272.00");
    expect(scores[0]).toHaveAttribute("data-tier", "ALIEN");
    expect(scores[0]).toHaveClass("chart-cell");
    expect(screen.queryAllByLabelText(/레이팅 점수/)).toHaveLength(2);
  });

  it("점수 칩을 누르면 그 채보의 기록 창을 열도록 알린다 (기록이 있는 줄만)", () => {
    const onRecord = vi.fn();
    render(
      <TierGroupSection
        group={group({ entries: [entry({ entryId: 1, title: "기록있음" }), entry({ entryId: 2, title: "기록없음", mine: null })] })}
        includeZero={false}
        onRecord={onRecord}
      />,
    );
    // 기록이 없는 곡에는 점수가 없으니 칩 버튼도 없다. 있는 곡은 카드 + 줄 하나씩
    expect(screen.queryAllByRole("button", { name: "기록없음 기록 수정" })).toHaveLength(0);
    const chips = screen.getAllByRole("button", { name: "기록있음 기록 수정" });
    expect(chips).toHaveLength(2);
    fireEvent.click(chips[0]);
    expect(onRecord).toHaveBeenCalledWith(expect.objectContaining({ title: "기록있음" }), 5.8);
  });

  it("레이팅 대상이 아니거나(속성 `레이팅 제외`) 난이도가 미정이면 점수 대신 `–`를 보인다", () => {
    const { rerender } = render(
      <TierGroupSection group={group({ entries: [entry({ pattern: "레이팅 제외" })] })} includeZero={false} />,
    );
    expect(screen.queryAllByLabelText(/레이팅 점수 \d/)).toHaveLength(0);
    expect(screen.getAllByLabelText("레이팅 점수 없음").length).toBeGreaterThan(0);
    rerender(<TierGroupSection group={group({ tier: null, entries: [entry()] })} includeZero={false} />);
    expect(screen.queryAllByLabelText(/레이팅 점수 \d/)).toHaveLength(0);
  });
});

describe("TierGroupSection 접기", () => {
  const entries = [entry({ entryId: 1, title: "Banana" })];

  it("collapsible이면 처음에는 닫혀 있고 머리의 칩·평균만 보인다", () => {
    render(<TierGroupSection group={group({ entries })} includeZero={false} collapsible />);
    const toggle = screen.getByRole("button", { name: /5\.8/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Banana")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "내 달성 현황" })).toBeInTheDocument(); // 머리 정보는 닫혀도 보인다
  });

  it("제목 줄을 누르면 채보 목록이 펼쳐지고 다시 누르면 접힌다", () => {
    render(<TierGroupSection group={group({ entries })} includeZero={false} collapsible />);
    const toggle = screen.getByRole("button", { name: /5\.8/ });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByText("Banana").length).toBeGreaterThan(0);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Banana")).not.toBeInTheDocument();
  });

  it("접기 버튼이 머리 전체로 늘어나 칩·평균 자리를 눌러도 반응한다(::after 덮개)", () => {
    const { container } = render(<TierGroupSection group={group({ entries })} includeZero={false} collapsible />);
    const toggle = screen.getByRole("button", { name: /5\.8/ });
    // jsdom은 CSS 위치를 계산하지 않아 클래스로 확인한다: 덮개가 가장 가까운 relative 조상(header) 전체를 덮는다
    expect(toggle).toHaveClass("after:absolute", "after:inset-0");
    expect(container.querySelector("header")).toHaveClass("relative");
  });

  it("모바일은 접힌 묶음에서 칩과 기록 수를 숨기고(md 이상은 보임), 펼치면 보인다", () => {
    render(<TierGroupSection group={group({ entries })} includeZero={false} collapsible />);
    const chips = screen.getByRole("list", { name: "내 달성 현황" });
    const recorded = screen.getByText(/기록 \d+\/\d+/);
    // jsdom은 CSS를 계산하지 않으므로 클래스로 확인한다: 접힘 = 모바일 숨김 + md 이상 표시
    expect(chips).toHaveClass("hidden", "md:flex");
    expect(recorded).toHaveClass("hidden", "md:flex");
    fireEvent.click(screen.getByRole("button", { name: /5\.8/ }));
    expect(chips).toHaveClass("flex");
    expect(chips).not.toHaveClass("hidden");
    expect(recorded).not.toHaveClass("hidden");
  });

  it("묶음 화면(collapsible 아님)은 항상 펼쳐 있어서 칩과 기록 수가 숨겨지지 않는다", () => {
    render(<TierGroupSection group={group({ entries })} includeZero={false} />);
    expect(screen.getByRole("list", { name: "내 달성 현황" })).not.toHaveClass("hidden");
    expect(screen.getByText(/기록 \d+\/\d+/)).not.toHaveClass("hidden");
  });

  it("collapsible이 아니면(묶음 화면) 버튼 없이 항상 펼쳐 있다", () => {
    render(<TierGroupSection group={group({ entries })} includeZero={false} />);
    expect(screen.queryByRole("button", { name: /5\.8/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("Banana").length).toBeGreaterThan(0);
  });
});

describe("TierGroupSection 정렬", () => {
  const entries = [
    entry({ entryId: 1, title: "Banana", mine: { rate: 90, fullCombo: false, stage: "A" } }),
    entry({ entryId: 2, title: "Apple", mine: { rate: 99, fullCombo: false, stage: "SS" } }),
  ];
  // 모바일 카드와 데스크톱 줄이 둘 다 DOM에 있어, 곡명이 나오는 순서 중 앞의 둘(카드)만 본다.
  // (머리 줄의 묶음 칩도 li라서 li 순서로 세지 않고 곡명 글자로 찾는다)
  const cardTitles = (container: HTMLElement) =>
    Array.from(container.querySelectorAll("*"))
      .filter((el) => el.children.length === 0 && /^(Banana|Apple)$/.test(el.textContent ?? ""))
      .slice(0, 2)
      .map((el) => el.textContent ?? "");

  it("정렬 기준을 주면 묶음 안 채보 순서가 바뀐다", () => {
    const { container, rerender } = render(<TierGroupSection group={group({ entries })} includeZero={false} />);
    expect(cardTitles(container)[0]).toContain("Banana"); // 기본은 서버 순서
    rerender(<TierGroupSection group={group({ entries })} includeZero={false} sort="title" />);
    expect(cardTitles(container)[0]).toContain("Apple");
    rerender(<TierGroupSection group={group({ entries })} includeZero={false} sort="rateDesc" />);
    expect(cardTitles(container)[0]).toContain("Apple");
    rerender(<TierGroupSection group={group({ entries })} includeZero={false} sort="rateAsc" />);
    expect(cardTitles(container)[0]).toContain("Banana");
  });
});

describe("서열표 표형 열", () => {
  it("표형 열: 곡명 · 채보 190 · 속성 52 · 추천 44 · 랭크·달성률 72 · 점수 64 · 기록 32 (머리 행과 행이 같은 값을 쓴다)", () => {
    expect(ROW_GRID).toContain("minmax(0,1fr)_190px_52px_44px_72px_64px_32px");
  });
});
