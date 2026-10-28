"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { CompareBody } from "@/components/rating/SnapshotCompare";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import { createSnapshot, fetchCompareCurrent, fetchSnapshotStatus, formatChange, snapshotKeys } from "@/lib/skill-snapshot";
import { useTranslations } from "next-intl";

/**
 * 마이페이지 레이팅 탭의 "지금 상황" 카드 (D32 확장). 요약 카드 바로 아래에 놓인다.
 *  1) 기록 제안: 오늘 아직 기록하지 않았고 점수가 달라졌을 때만 눈에 띄게 `지금 레이팅 기록하기`를 권한다.
 *     오늘 이미 기록했으면 같은 날 갱신(D32 변경)이 가능해도 이 제안은 띄우지 않는다 — 기록을 저장할 때마다 다시 뜨면 성가시다.
 *     갱신은 아래 `레이팅 기록`의 버튼(`오늘 기록 갱신`)과 가져오기 결과 화면에서 한다.
 *     자동으로 저장하지 않는다 — 기록은 사용자가 누를 때만 남는다(D32). 하루 1회·변경 없음 검사는 서버가 한다.
 *  2) 요약 한 줄: 마지막 기록 대비 얼마나 달라졌고 새로 들어온 곡이 몇 개인지. 누르면 곡별 비교를 펼친다.
 * 모두 이미 받은 레이팅 목록과 비교 API 결과를 화면에서 맞춰 보는 것이라 새로 저장하는 값이 없다.
 */
export function RatingInsights({ userId }: { userId: number }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const toast = useToast();
  const detailId = useId();
  const [detailOpen, setDetailOpen] = useState(false);

  const status = useQuery({
    queryKey: snapshotKeys.status(userId),
    queryFn: ({ signal }) => fetchSnapshotStatus(signal),
  });
  const compare = useQuery({
    queryKey: snapshotKeys.compareCurrent(userId),
    queryFn: ({ signal }) => fetchCompareCurrent(signal),
  });
  const record = useMutation({
    mutationFn: createSnapshot,
    onSuccess: async () => {
      toast(t("Rating.snapshotSaved"));
      await queryClient.invalidateQueries({ queryKey: snapshotKeys.all(userId) });
      await queryClient.invalidateQueries({ queryKey: snapshotKeys.status(userId) });
    },
  });

  const canRecord = status.data?.available === true && !status.data.replacesToday;
  // 서버가 비교할 수 없다고 답하면(처음이거나 상세가 없는 예전 기록) 요약 한 줄은 그리지 않는다
  const result = compare.data?.available === true ? compare.data : null;

  return (
    <div className="flex flex-col gap-3">
      {canRecord ? (
        <section aria-label={t("Rating.snapshotSuggestAria")} className="flex flex-col gap-2 rounded-2xl border border-chip-on-bg bg-card p-4">
          <p className="text-sm font-semibold text-fg">
            {result
              ? t("Rating.sinceLast", { date: result.fromDate ?? "", change: formatChange(result.totalChange).text })
              : compare.data?.reason === "NO_SNAPSHOT"
                ? t("Rating.noSnapshots")
                : t("Rating.canSaveToday")}
          </p>
          <p className="text-xs text-fg-sub">{t("Rating.snapshotHint")}</p>
          <div>
            <button
              type="button"
              disabled={record.isPending}
              onClick={() => record.mutate()}
              className="min-h-11 rounded-full bg-chip-on-bg px-5 text-sm font-semibold text-chip-on-fg enabled:hover:opacity-90 disabled:bg-table-head disabled:text-disabled"
            >
              {record.isPending ? t("Rating.snapshotSaving") : t("Rating.snapshotSave")}
            </button>
          </div>
          {record.isError ? (
            <p role="alert" className="text-xs text-fg">
              {record.error instanceof ApiError ? record.error.message : t("Rating.snapshotFailed")}
            </p>
          ) : null}
        </section>
      ) : null}

      {result ? (
        <section aria-label={t("Rating.statusAria")} className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              aria-expanded={detailOpen}
              aria-controls={detailId}
              onClick={() => setDetailOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="text-sm text-fg">
                {t.rich("Rating.vsLast", {
                  b: (c) => <span className="font-num font-semibold">{c}</span>,
                  date: result.fromDate ?? "",
                  change: formatChange(result.totalChange).text,
                  count: result.entered.length,
                })}
              </span>
              <span aria-hidden="true" className="shrink-0 text-fg-dim">
                {detailOpen ? "▴" : "▾"}
              </span>
            </button>
            {detailOpen ? (
              <div id={detailId} className="border-t border-line pt-2">
                <CompareBody result={result} />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
