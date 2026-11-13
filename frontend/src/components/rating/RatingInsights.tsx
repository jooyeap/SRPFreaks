"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState, type ReactNode } from "react";
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
 * 1)과 2)는 카드 한 장이다(변화량은 한 번만 적는다). 기록 버튼은 카드 오른쪽, 요약은 왼쪽이다.
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
  // 변화 없음: 합계 증감이 0이고 들어오거나 오르거나 내려가거나 빠진 곡이 하나도 없을 때
  const unchanged =
    result !== null &&
    formatChange(result.totalChange).direction === "flat" &&
    result.entered.length + result.improved.length + result.declined.length + result.left.length === 0;

  // 카드 한 장으로 합친 요약 (2026-11-13, DESIGN-UI 5장): 예전에는 `기록 제안` 배너와 `마지막 기록 대비` 줄이 각각 같은 변화량을 적어 +값이 두 번 보였다.
  // 이제 변화량은 요약 글자 한 곳에만 나오고, `지금 레이팅 기록하기` 버튼은 같은 카드 오른쪽에 있다. 요약을 누르면(▾) 곡별 비교가 그 자리에서 열린다.
  const hasDetail = result !== null && !unchanged;
  let summary: ReactNode = null;
  if (result && unchanged) {
    // 점수도 목록 구성도 그대로면 펼칠 내용이 없으니 접는 줄 대신 한 줄 안내만 둔다(2026-10-27: `±0.00 · 새로 들어온 곡 0개`가 의미 없이 보였다)
    summary = t("Rating.noChangeSince", { date: result.fromDate ?? "" });
  } else if (result) {
    // 새로 들어온 곡이 없으면 `· 새로 들어온 곡 0개`는 빼고 증감만 적는다
    summary =
      result.entered.length > 0
        ? t.rich("Rating.vsLast", {
            b: (c) => <span className="font-num font-semibold">{c}</span>,
            date: result.fromDate ?? "",
            change: formatChange(result.totalChange).text,
            count: result.entered.length,
          })
        : t.rich("Rating.vsLastNoNew", {
            b: (c) => <span className="font-num font-semibold">{c}</span>,
            date: result.fromDate ?? "",
            change: formatChange(result.totalChange).text,
          });
  } else if (canRecord) {
    // 마지막 기록이 없거나 비교할 수 없으면 숫자 없이 기록을 권하는 안내만 둔다
    summary = compare.data?.reason === "NO_SNAPSHOT" ? t("Rating.noSnapshots") : t("Rating.canSaveToday");
  }
  if (summary === null) {
    return null;
  }

  return (
    <section aria-label={t("Rating.statusAria")} className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-3">
      <div className="flex items-center gap-3">
        {hasDetail ? (
          <button
            type="button"
            aria-expanded={detailOpen}
            aria-controls={detailId}
            onClick={() => setDetailOpen((v) => !v)}
            className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 text-left"
          >
            <span className="text-sm text-fg">{summary}</span>
            <span aria-hidden="true" className="shrink-0 text-fg-dim">
              {detailOpen ? "▴" : "▾"}
            </span>
          </button>
        ) : (
          <p className="min-w-0 flex-1 text-sm text-fg-sub">{summary}</p>
        )}
        {canRecord ? (
          <button
            type="button"
            disabled={record.isPending}
            onClick={() => record.mutate()}
            className="min-h-11 w-24 shrink-0 break-keep rounded-full bg-chip-on-bg px-2 text-[13px] font-semibold leading-tight text-chip-on-fg enabled:hover:opacity-90 disabled:bg-table-head disabled:text-disabled"
          >
            {record.isPending ? t("Rating.snapshotSaving") : t("Rating.snapshotSave")}
          </button>
        ) : null}
      </div>
      {record.isError ? (
        <p role="alert" className="text-xs text-fg">
          {record.error instanceof ApiError ? record.error.message : t("Rating.snapshotFailed")}
        </p>
      ) : null}
      {hasDetail && detailOpen && result ? (
        <div id={detailId} className="border-t border-line pt-2">
          <CompareBody result={result} />
        </div>
      ) : null}
    </section>
  );
}
