"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Pager } from "@/components/Pager";
import { RecommendRangeForm } from "@/components/setlist/RecommendRangeForm";
import { useToast } from "@/components/Toast";
import { PatternMark } from "@/components/setlist/PatternMark";
import { ChartBadge } from "@/components/table/Badges";
import { StageBadge } from "@/components/table/StageBadge";
import { ApiError } from "@/lib/api";
import type { RecommendationItem } from "@/lib/api-types";
import { formatRate, formatTier } from "@/lib/format";
import { addToSetlist, fetchRecommendations, formatOffsetRange, SETLIST_LIMIT, setlistKeys } from "@/lib/setlist";
import { ErrorRetry } from "@/components/ErrorRetry";
import { useTranslations } from "next-intl";

/**
 * 내 실력대 추천 (D37): 내 레이팅 목록의 평균 난이도를 기준으로 오늘 도전해 볼 채보를 두 묶음으로 보여 준다.
 * - SS 기준: 평균보다 쉬운 쪽(ssMin~ssMax)에서 기록이 없거나 SS 미만인 채보
 * - S 기준: 평균 근처에서 위쪽(sMin~sMax)에서 기록이 없거나 S 미만인 채보
 * 상태별 화면: READY 두 묶음 / STARTER 기록이 없는 신규는 입문 난이도 이하의 S 기준만 / INSUFFICIENT 단일·그 외 데이터가 적다는 안내만.
 * 줄마다 `담기`를 누른다(한꺼번에 담는 버튼은 없다). 담으면 서버가 그 채보를 추천에서 빼므로 목록이 새로 채워진다.
 * 범위 숫자와 개수는 서버 값이라 화면에 하드코딩하지 않는다. `범위 조정`으로 사용자가 SS·S 범위를 직접 정할 수 있다(저장하면 내 설정, 기본값으로 되돌릴 수 있다).
 */
export function SetlistRecommend({ userId, addedIds, full }: { userId: number; addedIds: ReadonlySet<number>; full: boolean }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const toast = useToast();
  // SS 기준과 S 기준은 각자 자기 쪽을 넘긴다(한쪽을 넘겨도 다른 쪽 목록은 그대로)
  const [ssPage, setSsPage] = useState(0);
  const [sPage, setSPage] = useState(0);
  const [adjusting, setAdjusting] = useState(false);

  const result = useQuery({
    queryKey: setlistKeys.recommend(userId, ssPage, sPage),
    queryFn: ({ signal }) => fetchRecommendations(ssPage, sPage, signal),
    placeholderData: keepPreviousData, // 쪽을 넘기는 동안 이전 목록을 유지해 화면이 깜빡이지 않는다
  });

  const add = useMutation({
    mutationFn: (item: RecommendationItem) => addToSetlist(item.songDifficultyId),
    onSuccess: async () => {
      toast(t("Setlist.added"));
      await queryClient.invalidateQueries({ queryKey: setlistKeys.all });
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : t("Common.actionFailed")),
  });

  return (
    <section aria-label={t("Setlist.recommendAria")} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <h2 className="text-sm font-bold text-fg">{t("Setlist.recommendAria")}</h2>

      {result.isPending ? (
        <p className="text-sm text-fg-sub">{t("Setlist.recLoading")}</p>
      ) : result.isError ? (
        <ErrorRetry onRetry={() => void result.refetch()} retrying={result.isFetching}>
          {result.error instanceof ApiError ? result.error.message : t("Setlist.recFailed")}
        </ErrorRetry>
      ) : result.data.status === "UNAVAILABLE" ? (
        <p className="text-sm text-fg-sub">{t("Setlist.recNotYet")}</p>
      ) : result.data.status === "INSUFFICIENT" ? (
        <p className="text-sm text-fg-sub">
          {t("Setlist.insufficient", {
            ratedSingle: result.data.ratedSingle,
            requiredSingle: result.data.requiredSingle,
            ratedOther: result.data.ratedOther,
            requiredOther: result.data.requiredOther,
          })}
        </p>
      ) : (
        <>
          {result.data.status === "STARTER" ? (
            <p className="text-xs text-fg-sub">
              {t.rich("Setlist.starterNote", { n: (c) => <span className="font-num text-fg">{c}</span>, tier: formatTier(result.data.baseTier, t) })}
            </p>
          ) : (
            <p className="text-xs text-fg-sub">
              {t.rich("Setlist.basedOn", { n: (c) => <span className="font-num text-fg">{c}</span>, tier: formatTier(result.data.baseTier, t) })}
            </p>
          )}
          {result.data.status === "READY" ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                aria-expanded={adjusting}
                onClick={() => setAdjusting((open) => !open)}
                className="flex min-h-9 w-fit items-center gap-1 rounded-lg border border-chip-line px-3 text-sm text-fg hover:bg-table-head"
              >
                {t("Setlist.adjustRange")} {adjusting ? "\u25B4" : "\u25BE"}
              </button>
              {result.data.customRange && !adjusting ? <p className="text-xs text-fg-sub">{t("Setlist.customRange")}</p> : null}
              {adjusting ? <RecommendRangeForm current={result.data} onDone={() => setAdjusting(false)} /> : null}
            </div>
          ) : null}
          {full ? <p className="text-xs text-fg-sub">{t("Setlist.limitFull", { limit: SETLIST_LIMIT })}</p> : null}
          {result.data.status === "READY" ? (
            <Group
              title={t("Setlist.ssBasis")}
              range={formatOffsetRange(result.data.ssMin, result.data.ssMax, t)}
              items={result.data.ssChallenge}
              page={ssPage}
              totalPages={result.data.ssTotalPages}
              onPage={setSsPage}
              addedIds={addedIds}
              full={full}
              pendingId={add.isPending ? add.variables?.songDifficultyId : undefined}
              onAdd={(item) => add.mutate(item)}
            />
          ) : null}
          <Group
            title={t("Setlist.sBasis")}
            range={result.data.status === "STARTER" ? t("Setlist.starterRange", { tier: formatTier(result.data.baseTier, t) }) : formatOffsetRange(result.data.sMin, result.data.sMax, t)}
            items={result.data.sFill}
            page={sPage}
            totalPages={result.data.sTotalPages}
            onPage={setSPage}
            addedIds={addedIds}
            full={full}
            pendingId={add.isPending ? add.variables?.songDifficultyId : undefined}
            onAdd={(item) => add.mutate(item)}
          />
        </>
      )}
    </section>
  );
}

function Group({
  title,
  range,
  items,
  page,
  totalPages,
  onPage,
  addedIds,
  full,
  pendingId,
  onAdd,
}: {
  title: string;
  range: string;
  items: readonly RecommendationItem[];
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  addedIds: ReadonlySet<number>;
  full: boolean;
  pendingId: number | undefined;
  onAdd: (item: RecommendationItem) => void;
}) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-bold text-fg-sub">
        {title} <span className="font-normal text-fg-dim">({range})</span>
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-fg-dim">{t("Setlist.recEmpty")}</p>
      ) : (
        <ul aria-label={t("Setlist.recGroupAria", { title })} className="flex flex-col">
          {items.map((item) => {
            const added = addedIds.has(item.songDifficultyId);
            const stage = item.mine?.stage ?? null;
            return (
              <li key={item.songDifficultyId} className="flex items-center justify-between gap-3 border-t border-row-line py-2 first:border-t-0">
                <div className="min-w-0 flex-1">
                  {/* 곡명을 누르면 곡 상세(그 채보)로 간다. 담기 전에 곡 정보를 볼 수 있게(2026-10-27). 옅은 밑줄과 ›로 누를 수 있다는 걸 보인다 */}
                  <Link
                    href={`/songs/${item.songId}?from=table&chart=${item.songDifficultyId}`}
                    className="block truncate text-sm text-fg underline decoration-chip-line underline-offset-4 hover:decoration-fg"
                  >
                    {item.title} <span aria-hidden="true">›</span>
                  </Link>
                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    <ChartBadge part={item.part} difficulty={item.difficulty} level={item.level} />
                    <span className="text-xs text-fg-dim">
                      {t.rich("Setlist.constLabel", { n: (c) => <span className="font-num">{c}</span>, tier: formatTier(item.tier, t) })}
                    </span>
                    {item.pattern ? <PatternMark pattern={item.pattern} /> : null}
                  </p>
                </div>
                {/* 내 랭크(달성 단계)와 달성률은 오른쪽에 모은다. 기록 유무는 색이 아니라 글자로 보인다 */}
                <div className="shrink-0 text-right">
                  {stage ? <StageBadge stage={stage} /> : <span className="text-xs text-fg-dim">{t("Progress.noRecord")}</span>}
                  {stage ? <span className="mt-0.5 block font-num text-xs text-fg-sub">{formatRate(item.mine?.rate)}</span> : null}
                </div>
                <button
                  type="button"
                  disabled={added || full || pendingId === item.songDifficultyId}
                  onClick={() => onAdd(item)}
                  aria-label={added ? t("Setlist.addedAria", { title: item.title }) : t("Setlist.addAria", { title: item.title })}
                  className="flex min-h-9 shrink-0 items-center rounded-lg border border-chip-line px-3 text-sm text-fg enabled:hover:bg-table-head disabled:text-disabled"
                >
                  {added ? t("Setlist.addedMark") : t("Setlist.addBtn")}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Pager page={page} totalPages={totalPages} onChange={onPage} />
    </div>
  );
}
