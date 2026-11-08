import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SaveResultCard, type SaveOutcome } from "@/components/record/SaveResultCard";
import type { RatingChange } from "@/lib/records";
import koMessages from "../../../messages/ko.json";
import jaMessages from "../../../messages/ja.json";

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

  describe("서버 필드(2단계)", () => {
    const server = (extra: Partial<RatingChange>): RatingChange => ({
      totalBefore: 100, totalAfter: 100, change: 0, entered: false, inList: false, ...extra,
    });

    it("목록 밖이면 기존 안내 뒤에 그룹 마지막 자리까지 남은 점수 한 줄을 붙인다", () => {
      const { card } = renderCard({
        ...base,
        ratingChange: server({ group: "SINGLE", groupLimit: 15, rank: null, pointsToList: 64, scoreAfter: 240, scoreBefore: null, newBest: true, previousBestRate: null }),
      });
      expect(within(card).getByText("아직 레이팅 목록에는 들지 못했습니다.")).toBeInTheDocument();
      expect(within(card).getByText("단일 15위까지 64.00점 남았어요")).toBeInTheDocument();
      cleanup();
      const other = renderCard({ ...base, ratingChange: server({ group: "OTHER", groupLimit: 25, pointsToList: 1.5, scoreAfter: 240 }) });
      expect(within(other.card).getByText("그 외 25위까지 1.50점 남았어요")).toBeInTheDocument();
    });

    it("그룹이 덜 차서 남은 점수가 없으면(null) 남은 점수 줄은 없다", () => {
      const { card } = renderCard({ ...base, ratingChange: server({ group: "SINGLE", groupLimit: 15, pointsToList: null, scoreAfter: 240 }) });
      expect(within(card).queryByText(/위까지/)).toBeNull();
    });

    it("최고 기록이 아니면 이전 최고 기록을 말하고 `레이팅은 그대로입니다.` 계열 문구는 대신 쓴다", () => {
      const { card } = renderCard({
        ...base,
        after: { rate: 90, fullCombo: false },
        ratingChange: server({ inList: true, newBest: false, previousBestRate: 95, loweredBest: false, scoreAfter: 304, scoreBefore: 304 }),
      });
      expect(within(card).getByText("이전 최고 기록 95.00보다 낮아 레이팅은 그대로입니다.")).toBeInTheDocument();
      expect(within(card).queryByText("레이팅은 그대로입니다.")).toBeNull();
    });

    it("이전 최고와 같으면 같다고 말하고, 최고 기록을 낮춘 수정이면 이 안내를 쓰지 않는다", () => {
      const same = renderCard({ ...base, after: { rate: 95, fullCombo: false }, ratingChange: server({ inList: true, newBest: false, previousBestRate: 95, scoreAfter: 304, scoreBefore: 304 }) });
      expect(within(same.card).getByText("이전 최고 기록과 같아 레이팅은 그대로입니다.")).toBeInTheDocument();
      cleanup();
      const lowered = renderCard({ ...base, after: { rate: 80, fullCombo: false }, ratingChange: server({ inList: true, change: -64, totalAfter: 36, newBest: false, previousBestRate: 95, loweredBest: true, scoreAfter: 240, scoreBefore: 304 }) });
      expect(within(lowered.card).queryByText(/이전 최고 기록/)).toBeNull();
    });

    it("레이팅 제외이면 사유 안내 한 줄만 보이고 점수·목록 줄은 없다", () => {
      const { card } = renderCard({ ...base, ratingChange: server({ notRatedReason: "EXCLUDED", scoreAfter: null }) });
      expect(within(card).getByText("이 채보는 레이팅 대상이 아니라 레이팅에는 반영되지 않습니다.")).toBeInTheDocument();
      expect(within(card).queryByText("레이팅 목록")).toBeNull();
      expect(within(card).queryByText("레이팅 합계")).toBeNull();
    });

    it("서버가 기준 난이도 미정이라고 하면 1단계의 미정 안내를 쓴다", () => {
      const { card } = renderCard({ ...base, ratingChange: server({ notRatedReason: "TIER_UNDECIDED" }) });
      expect(within(card).getByText("기준 난이도가 정해지지 않아 레이팅에는 반영되지 않습니다.")).toBeInTheDocument();
    });

    it("곡 점수는 서버 값의 전→후(+차이)가 이기고, 등록 때도 전이 있으면 보인다", () => {
      const { card } = renderCard({
        ...base,
        before: null,
        ratingChange: server({ inList: true, change: 64, totalAfter: 164, group: "SINGLE", groupLimit: 15, rank: 1, scoreBefore: 240, scoreAfter: 304 }),
      });
      expect(within(card).getByText("240.00")).toBeInTheDocument();
      expect(within(card).getByText("304.00")).toBeInTheDocument();
      expect(within(card).getAllByText("+64.00")).toHaveLength(2); // 곡 점수 차이 + 레이팅 합계 증감
      expect(within(card).queryByText("223.79")).toBeNull();
    });

    it("서버가 점수 전을 null로 주면(처음 기록) 화면 계산으로 전을 만들지 않는다", () => {
      const { card } = renderCard({ ...base, ratingChange: server({ inList: true, entered: true, change: 304, totalAfter: 404, scoreBefore: null, scoreAfter: 304 }) });
      expect(within(card).getByText("304.00")).toBeInTheDocument();
      expect(within(card).queryByText("223.79")).toBeNull();
    });

    it("진입 안내는 서버의 그룹·한도가 이긴다", () => {
      const { card } = renderCard({
        ...base,
        entry: { group: "single", limit: 15 },
        ratingChange: server({ inList: true, entered: true, change: 5, group: "OTHER", groupLimit: 25, scoreAfter: 240 }),
      });
      expect(within(card).getByText("그 외 25 안으로 들어왔어요")).toBeInTheDocument();
    });

    it("새 필드가 없는 구버전 응답에서도 1단계 동작 그대로다", () => {
      const { card } = renderCard({ ...base, ratingChange: { totalBefore: 100, totalAfter: 100, change: 0, entered: false, inList: false } });
      expect(within(card).getByText("아직 레이팅 목록에는 들지 못했습니다.")).toBeInTheDocument();
      expect(within(card).queryByText(/위까지/)).toBeNull();
      expect(within(card).queryByText(/이전 최고 기록/)).toBeNull();
    });
  });

  it("새 문구는 ko/ja 둘 다 있고 자리표시자가 같다", () => {
    const keys = ["excludedNote", "pointsToListSingle", "pointsToListOther", "notBestNote", "sameBestNote"] as const;
    for (const key of keys) {
      const ko = koMessages.Record[key];
      const ja = jaMessages.Record[key];
      expect(ko).toBeTruthy();
      expect(ja).toBeTruthy();
      expect(ja.match(/\{\w+\}/g)?.sort()).toEqual(ko.match(/\{\w+\}/g)?.sort());
    }
  });
});
