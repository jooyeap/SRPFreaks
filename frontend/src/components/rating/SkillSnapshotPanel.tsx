"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SnapshotCompare } from "@/components/rating/SnapshotCompare";
import { useToast } from "@/components/Toast";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import { playerTierKey } from "@/lib/chart-tier";
import { formatScore } from "@/lib/format";
import {
  blockReasonText,
  createSnapshot,
  fetchSnapshotStatus,
  fetchSnapshots,
  formatChange,
  snapshotButtonText,
  snapshotKeys,
} from "@/lib/skill-snapshot";
import { ErrorRetry } from "@/components/ErrorRetry";
import { useTranslations } from "next-intl";

/**
 * 레이팅 기록 (D32, DESIGN-UI 5장). 레이팅 화면 맨 아래.
 * 사용자가 `지금 레이팅 기록하기`를 누르면 그 시점의 합계·소계를 하루(서울 날짜)에 한 줄만 남기고, 날짜별 목록과 증감을 보여 준다.
 * 누를 수 없는 경우(오늘 이미 기록 / 레이팅에 기록이 없음 / 마지막 기록과 점수가 같음)는 버튼을 막고 이유를 글자로 적는다.
 * 같은 검사를 서버도 한다(화면의 버튼 상태는 편의일 뿐 규칙의 근거가 아니다).
 */
export function SkillSnapshotPanel({ userId }: { userId: number }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<number | null>(null); // 비교를 펼친 줄(한 번에 하나)

  const status = useQuery({
    queryKey: snapshotKeys.status(userId),
    queryFn: ({ signal }) => fetchSnapshotStatus(signal),
  });
  const list = useQuery({
    queryKey: snapshotKeys.list(userId, page),
    queryFn: ({ signal }) => fetchSnapshots(page, signal),
    placeholderData: keepPreviousData,
  });

  const toast = useToast();
  const buttonText = snapshotButtonText(status.data?.replacesToday, t);
  const record = useMutation({
    mutationFn: createSnapshot,
    onSuccess: async () => {
      toast(buttonText.saved);
      setPage(0); // 방금 만든 줄이 맨 위에 보이게 첫 페이지로 돌아간다
      await queryClient.invalidateQueries({ queryKey: snapshotKeys.all(userId) });
      await queryClient.invalidateQueries({ queryKey: snapshotKeys.status(userId) });
    },
  });

  const blocked = status.data && !status.data.available ? status.data.reason : null;
  const canRecord = status.data?.available === true && !record.isPending;
  const data = list.data;

  return (
    <section aria-label={t("Rating.snapshotTitle")} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <div>
        <h2 className="text-[15px] font-bold text-fg">{t("Rating.snapshotTitle")}</h2>
        <p className="mt-0.5 text-xs text-fg-sub">{t("Rating.snapshotLead")}</p>
      </div>

      <div className="flex flex-col items-start gap-1.5">
        <button
          type="button"
          disabled={!canRecord}
          onClick={() => record.mutate()}
          className="rounded-full bg-chip-on-bg px-4 py-1.5 text-sm font-semibold text-chip-on-fg enabled:hover:opacity-90 disabled:bg-table-head disabled:text-disabled"
        >
          {record.isPending ? t("Rating.snapshotSaving") : buttonText.label}
        </button>
        {blocked ? <p className="text-xs text-fg-sub">{blockReasonText(blocked, t)}</p> : null}
        {status.isError ? <p className="text-xs text-fg-sub">{t("Rating.statusFailed")}</p> : null}
        {record.isError ? (
          <p role="alert" className="text-xs text-fg">
            {record.error instanceof ApiError ? record.error.message : t("Rating.snapshotFailed")}
          </p>
        ) : null}
      </div>

      {list.isError ? (
        <ErrorRetry onRetry={() => void list.refetch()} retrying={list.isFetching}>
          {list.error instanceof ApiError ? list.error.message : t("Rating.snapshotsLoadFailed")}
        </ErrorRetry>
      ) : !data ? (
        <p className="text-sm text-fg-sub">{t("Common.loading")}</p>
      ) : data.content.length === 0 ? (
        <p className="text-sm text-fg-sub">{t("Rating.noSnapshots")}</p>
      ) : (
        <>
          <ul aria-label={t("Rating.snapshotListAria")} className="flex flex-col">
            {data.content.map((row) => {
              const change = formatChange(row.change);
              const opened = openId === row.id;
              return (
                <li key={row.id} className="flex flex-col gap-2 border-t border-line py-2 first:border-t-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-num text-sm text-fg-sub">{row.date}</span>
                    <span className="flex items-center gap-2">
                      {/* 총점은 그 점수의 플레이어 티어 색 글자다(레이팅 카드와 같은 규칙). 숫자가 그대로 보이므로 색만으로 전달하지 않는다 */}
                      <span data-tier={playerTierKey(row.totalScore)} className="tier-score font-num text-base font-semibold">
                        {formatScore(row.totalScore)}
                      </span>
                      {/* 증감은 부호 글자(▲ +/▼ -)가 있어서 색은 보조다 */}
                      <span data-direction={change.direction} className={`font-num w-20 text-right text-sm ${change.direction === "up" ? "text-done-text" : "text-fg-sub"}`}>
                        {change.text}
                      </span>
                      {/* 첫 기록은 비교할 이전 기록이 없어서 버튼이 없다 */}
                      {row.change !== null ? (
                        <button
                          type="button"
                          aria-expanded={opened}
                          aria-label={t("Rating.compareWithPrevAria", { date: row.date })}
                          onClick={() => setOpenId(opened ? null : row.id)}
                          className="min-h-9 rounded-lg border border-ctl px-3 text-sm text-fg-sub hover:text-fg"
                        >
                          {opened ? t("Table.close") : t("Rating.compare")}
                        </button>
                      ) : (
                        <span className="w-[3.25rem]" aria-hidden="true" />
                      )}
                    </span>
                  </div>
                  {opened ? <SnapshotCompare userId={userId} snapshotId={row.id} /> : null}
                </li>
              );
            })}
          </ul>
          {data.totalPages > 1 ? (
            <nav aria-label={t("Rating.snapshotPagerAria")} className="flex items-center justify-center gap-3 text-sm text-fg-sub">
              <button
                type="button"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(p - 1, 0))}
                className="rounded-lg border border-ctl px-3 py-1 enabled:hover:text-fg disabled:text-disabled"
              >
                {t("Common.prev")}
              </button>
              <span className="font-num">
                {data.page + 1} / {data.totalPages}
              </span>
              <button
                type="button"
                disabled={page + 1 >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-ctl px-3 py-1 enabled:hover:text-fg disabled:text-disabled"
              >
                {t("Common.next")}
              </button>
            </nav>
          ) : null}
        </>
      )}
    </section>
  );
}
