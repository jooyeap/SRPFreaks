import { toHundredths } from "@/lib/format";
import type { AchievementStage } from "@/lib/types";

/**
 * 달성 단계 계산 (기록 입력 화면의 "달성 표시 미리보기"용).
 * 백엔드(AchievementStage.of)와 같은 규칙이다. 단계는 저장하지 않고 달성률과 FC 여부로 계산한다 (D9, D24).
 *
 * 판정 순서: EXC(100.00) -> FC -> SS(95 이상) -> S(80 이상) -> A(73 이상) -> B(63 이상) -> C.
 * 기록이 있으면 항상 단계가 하나 있고, 기록이 없을 때(rate가 null)만 null이다.
 * 경계 값은 100배 한 정수(9500 = 95.00)로 비교한다 (소수 오차 방지, format.ts의 toHundredths).
 */
export function achievementStage(rate: number | null | undefined, fullCombo: boolean): AchievementStage | null {
  if (rate === null || rate === undefined) {
    return null;
  }
  const hundredths = toHundredths(rate);
  if (hundredths === null) {
    return null;
  }
  if (hundredths >= 10000) return "EXC";
  if (fullCombo) return "FC";
  if (hundredths >= 9500) return "SS";
  if (hundredths >= 8000) return "S";
  if (hundredths >= 7300) return "A";
  if (hundredths >= 6300) return "B";
  return "C";
}

/** 낮은 단계 -> 높은 단계 순서. 단계끼리 높낮이를 비교할 때 쓴다. */
export const STAGE_ORDER: readonly AchievementStage[] = ["C", "B", "A", "S", "SS", "FC", "EXC"];

/** a가 b보다 높은 단계이면 true. */
export function isHigherStage(a: AchievementStage, b: AchievementStage): boolean {
  return STAGE_ORDER.indexOf(a) > STAGE_ORDER.indexOf(b);
}
