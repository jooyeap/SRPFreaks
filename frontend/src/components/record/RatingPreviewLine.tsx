"use client";

import { useQuery } from "@tanstack/react-query";
import type { RecordChart } from "@/components/record/RecordForm";
import { previewRatingChange, ratingPreviewText } from "@/lib/rating-preview";
import { fetchMySkill, skillKeys } from "@/lib/rating";
import type { RecordResponse } from "@/lib/records";

/**
 * 기록 입력 중 "이 기록을 저장하면 레이팅이 몇 점 오르는지, 레이팅 목록에 새로 들어가는지"를 예상 점수 아래에 보인다.
 * 서버의 내 레이팅 목록(레이팅 화면과 같은 쿼리)을 받아 화면에서 계산한다. 저장하지 않고, 저장 직후 알림에는 서버가 계산한 실제 값이 나온다.
 * 목록을 아직 못 받았거나 레이팅 대상이 아니면(속성 없음·레이팅 제외·반영 끔) 아무것도 보이지 않는다.
 */
export function RatingPreviewLine({
  userId,
  chart,
  score,
  record,
}: {
  userId: number;
  chart: RecordChart;
  score: number | null;
  record?: RecordResponse;
}) {
  const skill = useQuery({
    queryKey: skillKeys.me(userId),
    queryFn: ({ signal }) => fetchMySkill(signal),
  });
  if (score === null || !skill.data || chart.ratingEnabled === false) {
    return null;
  }
  const listed = [...skill.data.single, ...skill.data.other].find((e) => e.songDifficultyId === chart.songDifficultyId);
  // 수정하는 기록이 지금 목록에 반영된(가장 높은) 기록이면, 낮게 고칠 때 다음 기록이 대신 쓰여서 예상하지 않는다
  const editingBest = record !== undefined && listed !== undefined && Math.abs(listed.achievementRate - record.achievementRate) < 0.005;
  const preview = previewRatingChange(skill.data, chart.songDifficultyId, score, listed?.pattern ?? chart.pattern, editingBest);
  if (preview === null) {
    return null;
  }
  return (
    <p className={`text-xs ${preview.entered ? "font-bold text-fg" : "text-fg-sub"}`}>{ratingPreviewText(preview)}</p>
  );
}
