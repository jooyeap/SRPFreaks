"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";
import { StageBadge } from "@/components/table/StageBadge";
import { formatPlayedDate, formatRate } from "@/lib/format";
import { fetchRecordsOfChart, isEdited, recordKeys, recordOriginText, type RecordResponse } from "@/lib/records";
import { useTranslations } from "next-intl";

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
  const t = useTranslations();
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
    <section aria-label={t("Record.listAria")} className="mb-4">
      <h3 className="mb-2 text-sm font-semibold text-fg-sub">{t("Record.listAria")}</h3>
      <ul className="flex flex-col gap-1">
        {data.content.map((record) => (
          <li
            key={record.id}
            className="flex items-center gap-3 rounded border border-line py-1 pl-3 pr-1.5 text-sm"
          >
            <span className="font-num font-semibold text-fg">{formatRate(record.achievementRate)}</span>
            <StageBadge stage={record.stage} />
            {/* 플레이 날짜(내가 입력한 값)와 서버에 등록·수정한 날짜는 다르므로 두 줄로 나눠 보여 준다 */}
            <span className="flex min-w-0 flex-col font-num text-xs leading-tight text-fg-dim">
              <span>{t("Record.playedOn", { date: formatPlayedDate(record.playedAt) })}</span>
              <span>
                {isEdited(record) ? <span className="font-bold text-fg-sub">{t("Record.editedMark")}</span> : null}
                {recordOriginText(record, t)}
              </span>
            </span>
            <button
              type="button"
              onClick={() => onEdit(record)}
              aria-pressed={editingId === record.id}
              aria-label={t("Record.editRateAria", { rate: formatRate(record.achievementRate) })}
              className="ml-auto min-h-9 rounded-lg border border-chip-line px-3.5 text-sm text-fg-sub hover:text-fg"
            >
              {t("Record.edit")}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-fg-dim">{t("Record.editNote")}</p>
    </section>
  );
}
