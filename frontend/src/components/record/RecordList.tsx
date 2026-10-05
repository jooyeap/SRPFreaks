"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";
import { StageBadge } from "@/components/table/StageBadge";
import { formatPlayedDate, formatRate } from "@/lib/format";
import { fetchRecordsOfChart, recordKeys, type RecordResponse } from "@/lib/records";

/**
 * 이 채보에 내가 남긴 기록 목록 (DESIGN-UI 10장 "이 곡의 내 기록": 달성률 · 단계 칩 · 날짜).
 * 서버는 항상 토큰의 사용자 기록만 돌려준다. 기록이 없으면 아무것도 그리지 않는다.
 */
export function RecordList({
  songDifficultyId,
  editingId,
  onEdit,
}: {
  songDifficultyId: number;
  editingId: number | null;
  onEdit: (record: RecordResponse) => void;
}) {
  const { user } = useAuth();
  const userId = user?.id ?? 0;
  const { data } = useQuery({
    queryKey: recordKeys.ofChart(userId, songDifficultyId),
    queryFn: ({ signal }) => fetchRecordsOfChart(songDifficultyId, signal),
    enabled: user !== null,
  });

  if (!data || data.content.length === 0) {
    return null;
  }
  return (
    <section aria-label="이 채보의 내 기록" className="mb-4">
      <h3 className="mb-2 text-sm font-semibold text-fg-sub">이 채보의 내 기록</h3>
      <ul className="flex flex-col gap-1">
        {data.content.map((record) => (
          <li
            key={record.id}
            className="flex items-center gap-3 rounded border border-line px-3 py-1.5 text-sm"
          >
            <span className="font-num font-semibold text-fg">{formatRate(record.achievementRate)}</span>
            <StageBadge stage={record.stage} />
            <span className="font-num text-xs text-fg-dim">{formatPlayedDate(record.playedAt)}</span>
            <button
              type="button"
              onClick={() => onEdit(record)}
              aria-pressed={editingId === record.id}
              aria-label={`${formatRate(record.achievementRate)} 기록 수정`}
              className="ml-auto rounded-full border border-chip-line px-2.5 py-0.5 text-xs text-fg-sub hover:text-fg"
            >
              수정
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-fg-dim">수정하면 서열표와 스킬에 바로 반영됩니다.</p>
    </section>
  );
}
