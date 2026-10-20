import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SaveResultCard, type SaveOutcome } from "@/components/record/SaveResultCard";

const base: SaveOutcome = {
  before: { rate: 91.2, fullCombo: false },
  after: { rate: 96.5, fullCombo: false },
  tier: 5.6,
  ratingChange: { totalBefore: 10638.13, totalAfter: 10654.35, change: 16.22, entered: true, inList: true },
};

function renderCard(outcome: SaveOutcome = base, onClose = vi.fn()) {
  render(<SaveResultCard outcome={outcome} onClose={onClose} />);
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

  it("내 레이팅 보기는 레이팅 탭으로 가고, 둘 다 창을 닫는다", () => {
    const { card, onClose } = renderCard();
    expect(within(card).getByRole("link", { name: "내 레이팅 보기" })).toHaveAttribute("href", "/me?tab=rating");
    fireEvent.click(within(card).getByRole("link", { name: "내 레이팅 보기" }));
    fireEvent.click(within(card).getByRole("button", { name: "다음 곡 입력" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
