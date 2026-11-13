"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";
import type { RecordChart } from "@/components/record/RecordForm";
import { difficultyLabel, partLabel } from "@/lib/format";
import { distinctRecentCharts, fetchRecentEntered, recordKeys } from "@/lib/records";
import { useTranslations } from "next-intl";

/**
 * 기록 창 맨 위의 "최근 입력한 곡" 바로가기 (최대 5곡).
 * 같은 곡을 난이도별로 이어서 넣거나 방금 넣은 곡을 다시 고칠 때, 서열표·곡 목록으로 돌아가 찾지 않고 바로 옮겨 가려는 용도다.
 * 지금 열려 있는 채보는 목록에서 뺀다. 기록이 없거나 불러오지 못하면 아무것도 그리지 않는다(필수 기능이 아니라서 방해하지 않는다).
 * 서열표 기준 난이도(tier)는 기록 응답에 없어서, 옮겨 간 뒤에는 입력 중 점수 미리보기가 나오지 않는다.
 */
export function RecentCharts({ currentChartId, onPick }: { currentChartId: number; onPick: (chart: RecordChart) => void }) {
  const t = useTranslations();
  const { user } = useAuth();
  const userId = user?.id ?? 0;
  const recent = useQuery({
    queryKey: recordKeys.recentEntered(userId),
    queryFn: ({ signal }) => fetchRecentEntered(signal),
    enabled: user !== null,
  });
  const items = distinctRecentCharts(recent.data?.content ?? []).filter((r) => r.songDifficultyId !== currentChartId);
  if (items.length === 0) {
    return null;
  }
  return (
    <section aria-label={t("Record.recentAria")} className="mb-3">
      <h3 className="mb-1.5 text-xs font-bold text-fg-sub">{t("Record.recentAria")}</h3>
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {items.map((r) => (
          <li key={r.songDifficultyId} className="shrink-0">
            <button
              type="button"
              onClick={() =>
                onPick({ songDifficultyId: r.songDifficultyId, songId: r.songId, title: r.title, part: r.part, difficulty: r.difficulty, level: r.level })
              }
              className="flex min-h-11 max-w-44 flex-col items-start justify-center rounded-lg border border-ctl px-3 py-1 text-left hover:bg-chip-on-bg"
            >
              <span className="w-full truncate text-sm text-fg">{r.title}</span>
              <span className="text-xs text-fg-dim">
                {partLabel(r.part)} {difficultyLabel(r.difficulty)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
