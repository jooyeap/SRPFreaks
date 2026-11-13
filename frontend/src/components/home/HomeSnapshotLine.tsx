"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import { createSnapshot, fetchCompareCurrent, fetchSnapshotStatus, formatChange, snapshotButtonText, snapshotKeys } from "@/lib/skill-snapshot";
import { useTranslations } from "next-intl";

/**
 * 홈 레이팅 요약 카드 아래의 한 줄: `마지막 기록(10-25) 이후 ▲ +33.92 · 지금 기록하기` (2026-10-27, D32).
 * 레이팅 기록(스냅샷)을 남기는 사람이 적어서, 점수가 바뀌었을 때 홈에서 바로 누를 수 있게 한다.
 *  - 기록할 수 있을 때(마지막 기록과 점수가 다를 때)만 보인다. 점수가 같거나 기록이 없으면 그리지 않는다.
 *  - 오늘 이미 기록했으면 `오늘 기록 이후 … · 오늘 기록 갱신`(같은 날은 덮어쓴다).
 *  - 자동 저장은 하지 않는다. 누를 때만 남는다.
 * 요약 카드 전체가 마이페이지 링크라 그 안에 버튼을 넣을 수 없어서(링크 안의 버튼은 누르기 어렵다) 카드 바로 아래에 따로 둔다.
 */
export function HomeSnapshotLine({ userId }: { userId: number }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const toast = useToast();
  const status = useQuery({
    queryKey: snapshotKeys.status(userId),
    queryFn: ({ signal }) => fetchSnapshotStatus(signal),
  });
  const compare = useQuery({
    queryKey: snapshotKeys.compareCurrent(userId),
    queryFn: ({ signal }) => fetchCompareCurrent(signal),
    enabled: status.data?.available === true,
  });
  const buttonText = snapshotButtonText(status.data?.replacesToday, t);
  const record = useMutation({
    mutationFn: createSnapshot,
    onSuccess: async () => {
      toast(buttonText.saved);
      await queryClient.invalidateQueries({ queryKey: snapshotKeys.all(userId) });
      await queryClient.invalidateQueries({ queryKey: snapshotKeys.status(userId) });
      await queryClient.invalidateQueries({ queryKey: snapshotKeys.compareCurrent(userId) });
    },
  });

  if (status.data?.available !== true) {
    return null;
  }
  const result = compare.data?.available === true ? compare.data : null;
  const change = result ? formatChange(result.totalChange) : null;
  const b = (chunks: React.ReactNode) => (
    <span className={`font-num font-semibold ${change?.direction === "up" ? "text-done-text" : "text-fg"}`}>{chunks}</span>
  );
  const text = !result
    ? t("Rating.noSnapshots")
    : status.data.replacesToday
      ? t.rich("Home.snapshotSinceToday", { change: change?.text ?? "", b })
      : t.rich("Home.snapshotSince", { date: result.fromDate ?? "", change: change?.text ?? "", b });

  return (
    <section aria-label={t("Rating.snapshotSuggestAria")} className="-mt-2 flex items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-2.5">
      <p className="min-w-0 text-[13px] leading-snug text-fg-sub">{text}</p>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <button
          type="button"
          disabled={record.isPending}
          onClick={() => record.mutate()}
          className={`min-h-11 rounded-full px-4 text-[13px] font-bold disabled:opacity-60 ${
            status.data.replacesToday ? "border border-ctl text-fg hover:bg-table-head" : "bg-chip-on-bg text-chip-on-fg hover:opacity-90"
          }`}
        >
          {record.isPending ? t("Rating.snapshotSaving") : buttonText.label}
        </button>
        {record.isError ? (
          <p role="alert" className="text-xs text-fg">
            {record.error instanceof ApiError ? record.error.message : t("Rating.snapshotFailed")}
          </p>
        ) : null}
      </div>
    </section>
  );
}
