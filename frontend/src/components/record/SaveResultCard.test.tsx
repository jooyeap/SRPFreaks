import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SaveResultCard, type SaveOutcome } from "@/components/record/SaveResultCard";

const base: SaveOutcome = {
  before: { rate: 91.2, fullCombo: false },
  after: { rate: 96.5, fullCombo: false },
  tier: 5.6,
  ratingChange: { totalBefore: 10638.13, totalAfter: 10654.35, change: 16.22, entered: true, inList: true },
};

function renderCard(outcome: SaveOutcome = base, onClose = vi.fn(), onNext?: () => void) {
  render(<SaveResultCard outcome={outcome} onClose={onClose} onNext={onNext} />);
  return { onClose, card: screen.getByRole("group", { name: "저장 결과" }) };
}

describe("SaveResultCard", () => {
  it("달성률·단계·곡 점수(직접 계산한 값)·레이팅 변화를 전후로 보여 준다", () => {
    const { card } = renderCard();
    // 직접 계산: T=5.6 -> R=11. A=91.2 -> V=8.8+3.2*11.2/15=11.18933 -> x20=223.787 -> 표시 223.79 / A=96.5 -> V=8.8+3.2=12 -> 240.00
    expect(within(card).getByText("91.20")).toBeInTheDocument();
    expect(within(card).getByText("96.50")).toBeInTheDocument();
    expect(within(card).getByLabelText("달성 단계 S")).toBeInTheDocument();
    expect(within(card).getByLabelText("달성 단계 SS")).toBeInTheDocument();
    expect(within(card).getByText("단계 상승")).toBeInTheDocument();
    expect(within(card).getByText("223.79")).toBeInTheDocument();
    expect(within(card).getByText("240.00")).toBeInTheDocument();
    expect(within(card).getByText("+16.22")).toBeInTheDocument();
    expect(within(card).getByText("10654.35")).toHaveAttribute("data-tier");
    expect(within(card).getByText("NEW")).toBeInTheDocument();
    expect(within(card).getByText("새로 들어갔습니다")).toBeInTheDocument();
  });

  it("새 기록 등록(이전 값 없음)이면 전후 비교 없이 결과만 보인다", () => {
    const { card } = renderCard({ ...base, before: null });
    expect(within(card).queryByText("91.20")).toBeNull();
    expect(within(card).queryByText("단계 상승")).toBeNull();
    expect(within(card).getByLabelText("달성 단계 SS")).toBeInTheDocument();
  });

  it("단계가 같으면 단계 변화를 그리지 않는다", () => {
    const { card } = renderCard({ ...base, before: { rate: 96, fullCombo: false } });
    expect(within(card).getAllByLabelText(/^달성 단계/)).toHaveLength(1);
    expect(within(card).queryByText("단계 상승")).toBeNull();
  });

  it("레이팅 상수가 없으면(미정) 곡 점수 줄이 없다", () => {
    const { card } = renderCard({ ...base, tier: null });
    expect(within(card).queryByText("곡 점수")).toBeNull();
  });

  it("목록 밖이면 합계 줄 없이 안내 문구만 보인다", () => {
    const { card } = renderCard({
      ...base,
      ratingChange: { totalBefore: 100, totalAfter: 100, change: 0, entered: false, inList: false },
    });
    expect(within(card).queryByText("레이팅 합계")).toBeNull();
    expect(within(card).getByText("아직 목록에는 들지 못했습니다")).toBeInTheDocument();
    expect(within(card).getByText("아직 레이팅 목록에는 들지 못했습니다.")).toBeInTheDocument();
  });

  it("서버가 레이팅 변화를 못 주면 레이팅 줄을 그리지 않는다", () => {
    const { card } = renderCard({ ...base, ratingChange: null });
    expect(within(card).queryByText("레이팅 합계")).toBeNull();
    expect(within(card).queryByText("레이팅 목록")).toBeNull();
  });

  it("제목은 `저장했어요`이고 ✓는 장식으로 따로 둔다", () => {
    const { card } = renderCard();
    expect(within(card).getByRole("heading", { name: "저장했어요" })).toBeInTheDocument();
    expect(within(card).getByText("✓")).toHaveAttribute("aria-hidden", "true");
  });

  it("진입 안내: 단일이면 `단일 15 안으로 들어왔어요`, 그 외면 `그 외 25 안으로 들어왔어요`", () => {
    const single = renderCard({ ...base, entry: { group: "single", limit: 15 } });
    expect(within(single.card).getByText("단일 15 안으로 들어왔어요")).toBeInTheDocument();
    expect(within(single.card).queryByText("새로 들어갔습니다")).toBeNull();
    cleanup();
    const other = renderCard({ ...base, entry: { group: "other", limit: 25 } });
    expect(within(other.card).getByText("그 외 25 안으로 들어왔어요")).toBeInTheDocument();
  });

  it("그룹을 판정할 수 없으면(entry 없음) 기존 `새로 들어갔습니다` 문구를 쓴다", () => {
    const { card } = renderCard({ ...base, entry: null });
    expect(within(card).getByText("새로 들어갔습니다")).toBeInTheDocument();
  });

  it("목록에 새로 들어온 게 아니면 진입 안내를 쓰지 않는다", () => {
    const { card } = renderCard({
      ...base,
      entry: { group: "single", limit: 15 },
      ratingChange: { totalBefore: 100, totalAfter: 110, change: 10, entered: false, inList: true },
    });
    expect(within(card).queryByText(/안으로 들어왔어요/)).toBeNull();
    expect(within(card).getByText("목록에 있습니다")).toBeInTheDocument();
  });

  it("기준 난이도가 미정이면 점수·목록 줄 대신 안내 한 줄만 보인다", () => {
    const { card } = renderCard({ ...base, tier: null, entry: null });
    expect(within(card).queryByText("곡 점수")).toBeNull();
    expect(within(card).queryByText("레이팅 목록")).toBeNull();
    expect(within(card).getByText("기준 난이도가 정해지지 않아 레이팅에는 반영되지 않습니다.")).toBeInTheDocument();
  });

  it("기준 난이도가 있으면 미정 안내는 없다", () => {
    const { card } = renderCard();
    expect(within(card).queryByText(/기준 난이도가 정해지지 않아/)).toBeNull();
  });

  it("내 레이팅 보기 링크는 카드에 없다", () => {
    const { card } = renderCard(base, vi.fn(), vi.fn());
    expect(within(card).queryByRole("link")).toBeNull();
    expect(within(card).queryByText("내 레이팅 보기")).toBeNull();
  });

  it("세트리스트에서 입력 중이 아니면(onNext 없음) [닫기]만 보이고 `다음 곡 ›`은 숨긴다", () => {
    const { card, onClose } = renderCard();
    expect(within(card).getAllByRole("button").map((b) => b.textContent)).toEqual(["닫기"]);
    fireEvent.click(within(card).getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("세트리스트에서 입력 중이면 [닫기] [다음 곡 ›] 두 개이고, `다음 곡 ›`은 onNext만 부른다", () => {
    const onNext = vi.fn();
    const { card, onClose } = renderCard(base, vi.fn(), onNext);
    expect(within(card).getAllByRole("button").map((b) => b.textContent)).toEqual(["닫기", "다음 곡 ›"]);
    fireEvent.click(within(card).getByRole("button", { name: "다음 곡 ›" }));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
