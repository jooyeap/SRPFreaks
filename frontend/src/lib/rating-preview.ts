import type { SkillEntryResponse, SkillResponse } from "@/lib/api-types";

/** 기록 입력 중에 보여 주는 "이 기록을 저장하면 레이팅이 어떻게 되는가" 예상. */
export interface RatingPreview {
  /** 레이팅 합계 증감(0 이상). 점수가 같거나 낮으면 0 */
  change: number;
  /** 저장하면 이 채보가 레이팅 목록에 들어 있게 되는가 */
  inList: boolean;
  /** 지금은 목록에 없는데 저장하면 새로 들어가는가 (화면에 NEW) */
  entered: boolean;
}

/**
 * 지금 내 레이팅 목록(서버 값)에 새 점수를 넣어 본 결과. 저장하지 않고 화면에서 계산하는 미리보기다.
 *  - 구역은 속성으로 정한다: 단일이면 단일 구역, 그 외(복합·이중·삼중)는 그 외 구역. 이미 목록에 있는 채보는 있던 구역을 따른다.
 *    속성이 없거나 `레이팅 제외`이고 목록에도 없으면 레이팅 대상이 아니라 null.
 *  - 채보의 값은 가장 높은 기록이 쓰이므로 새 점수가 현재 점수보다 낮으면 목록은 그대로다(증감 0).
 *  - 예외: 지금 목록에 반영된 그 기록을 낮게 고치는 경우(`loweringBest`)는 다음으로 높은 기록이 대신 쓰이는데 화면은 그 값을 몰라서 null(예상하지 않음).
 * 서버가 같은 식으로 다시 계산해 저장 직후 알림에 실제 값을 알려 준다.
 */
export function previewRatingChange(
  skill: SkillResponse,
  chartId: number,
  newScore: number,
  pattern: string | null | undefined,
  loweringBest = false,
): RatingPreview | null {
  const inSingle = skill.single.find((e) => e.songDifficultyId === chartId);
  const inOther = skill.other.find((e) => e.songDifficultyId === chartId);
  const listed: SkillEntryResponse | undefined = inSingle ?? inOther;

  let group: "single" | "other";
  if (inSingle) {
    group = "single";
  } else if (inOther) {
    group = "other";
  } else if (pattern === "단일") {
    group = "single";
  } else if (pattern && pattern !== "레이팅 제외") {
    group = "other";
  } else {
    return null;
  }
  if (listed && loweringBest && newScore < listed.score) {
    return null;
  }

  const entries = group === "single" ? skill.single : skill.other;
  const limit = group === "single" ? skill.singleLimit : skill.otherLimit;
  const effective = listed ? Math.max(listed.score, newScore) : newScore;
  const others = entries.filter((e) => e.songDifficultyId !== chartId).map((e) => e.score);
  const after = [...others, effective].sort((a, b) => b - a).slice(0, limit);
  const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);
  const change = Math.max(sum(after) - sum(entries.map((e) => e.score)), 0);
  // 같은 점수끼리는 앞(기존 곡)이 우선이라, 새 곡은 자기보다 높거나 같은 곡이 limit개 미만일 때만 들어간다
  const inList = listed !== undefined || others.filter((s) => s >= effective).length < limit;
  return { change, inList, entered: listed === undefined && inList };
}

/** 미리보기 한 줄 문구. 증감은 + 부호 글자로 쓴다(색만으로 전달하지 않는다). */
export function ratingPreviewText(preview: RatingPreview): string {
  if (preview.change > 0) {
    const base = `예상 레이팅 +${preview.change.toFixed(2)}`;
    return preview.entered ? `${base} · NEW 레이팅 목록에 새로 들어갑니다` : base;
  }
  return preview.inList ? "레이팅 변화 없음" : "레이팅 변화 없음 · 아직 레이팅 목록에는 들지 못합니다";
}
