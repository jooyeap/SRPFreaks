"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pager } from "@/components/Pager";
import { RecommendRangeForm } from "@/components/setlist/RecommendRangeForm";
import { useToast } from "@/components/Toast";
import { ChartBadge } from "@/components/table/Badges";
import { StageBadge } from "@/components/table/StageBadge";
import { ApiError } from "@/lib/api";
import type { RecommendationItem } from "@/lib/api-types";
import { formatRate, formatTier } from "@/lib/format";
import { addToSetlist, fetchRecommendations, formatOffsetRange, SETLIST_LIMIT, setlistKeys } from "@/lib/setlist";

/**
 * 내 실력대 추천 (D37): 내 레이팅 목록의 평균 난이도를 기준으로 오늘 도전해 볼 채보를 두 묶음으로 보여 준다.
 * - SS 기준: 평균보다 쉬운 쪽(ssMin~ssMax)에서 기록이 없거나 SS 미만인 채보
 * - S 기준: 평균 근처에서 위쪽(sMin~sMax)에서 기록이 없거나 S 미만인 채보
 * 상태별 화면: READY 두 묶음 / STARTER 기록이 없는 신규는 입문 난이도 이하의 S 기준만 / INSUFFICIENT 단일·그 외 데이터가 적다는 안내만.
 * 줄마다 `담기`를 누른다(한꺼번에 담는 버튼은 없다). 담으면 서버가 그 채보를 추천에서 빼므로 목록이 새로 채워진다.
 * 범위 숫자와 개수는 서버 값이라 화면에 하드코딩하지 않는다. `범위 조정`으로 사용자가 SS·S 범위를 직접 정할 수 있다(저장하면 내 설정, 기본값으로 되돌릴 수 있다).
 */
export function SetlistRecommend({ userId, addedIds, full }: { userId: number; addedIds: ReadonlySet<number>; full: boolean }) {
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
      toast("세트리스트에 담았습니다.");
      await queryClient.invalidateQueries({ queryKey: setlistKeys.all });
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "처리하지 못했습니다. 잠시 후 다시 시도해 주세요."),
  });

  return (
    <section aria-label="내 실력대 추천" className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <h2 className="text-sm font-bold text-fg">내 실력대 추천</h2>

      {result.isPending ? (
        <p className="text-sm text-fg-sub">추천을 불러오는 중입니다.</p>
      ) : result.isError ? (
        <p role="alert" className="text-sm text-fg">
          {result.error instanceof ApiError ? result.error.message : "추천을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."}
        </p>
      ) : result.data.status === "UNAVAILABLE" ? (
        <p className="text-sm text-fg-sub">아직 추천할 수 없습니다. 서열표가 준비되면 보여 드려요.</p>
      ) : result.data.status === "INSUFFICIENT" ? (
        <p className="text-sm text-fg-sub">
          데이터가 적어 추천하기 어렵습니다. 레이팅 목록에 단일 {result.data.ratedSingle}/{result.data.requiredSingle}곡, 그 외 {result.data.ratedOther}/
          {result.data.requiredOther}곡이 있습니다. 기록을 더 채워 주세요.
        </p>
      ) : (
        <>
          {result.data.status === "STARTER" ? (
            <p className="text-xs text-fg-sub">
              아직 레이팅에 든 기록이 없어 기준 난이도 <span className="font-num text-fg">{formatTier(result.data.baseTier)}</span> 이하의 곡을 S 기준으로 보여 드려요.
            </p>
          ) : (
            <p className="text-xs text-fg-sub">
              내 평균 난이도 <span className="font-num text-fg">{formatTier(result.data.baseTier)}</span> 기준입니다.
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
                범위 조정 {adjusting ? "\u25B4" : "\u25BE"}
              </button>
              {result.data.customRange && !adjusting ? <p className="text-xs text-fg-sub">직접 정한 범위를 쓰고 있습니다.</p> : null}
              {adjusting ? <RecommendRangeForm current={result.data} onDone={() => setAdjusting(false)} /> : null}
            </div>
          ) : null}
          {full ? <p className="text-xs text-fg-sub">{SETLIST_LIMIT}곡이 모두 담겨 있습니다. 곡을 빼면 새로 담을 수 있습니다.</p> : null}
          {result.data.status === "READY" ? (
            <Group
              title="SS 기준"
              range={formatOffsetRange(result.data.ssMin, result.data.ssMax)}
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
            title="S 기준"
            range={result.data.status === "STARTER" ? `기준 난이도 ${formatTier(result.data.baseTier)} 이하` : formatOffsetRange(result.data.sMin, result.data.sMax)}
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
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-bold text-fg-sub">
        {title} <span className="font-normal text-fg-dim">({range})</span>
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-fg-dim">추천할 채보가 없습니다.</p>
      ) : (
        <ul aria-label={`${title} 추천`} className="flex flex-col">
          {items.map((item) => {
            const added = addedIds.has(item.songDifficultyId);
            const stage = item.mine?.stage ?? null;
            return (
              <li key={item.songDifficultyId} className="flex items-center justify-between gap-3 border-t border-row-line py-2 first:border-t-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-fg">{item.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    <ChartBadge part={item.part} difficulty={item.difficulty} level={item.level} />
                    <span className="text-xs text-fg-dim">
                      상수 <span className="font-num">{formatTier(item.tier)}</span>
                    </span>
                  </p>
                </div>
                {/* 내 랭크(달성 단계)와 달성률은 오른쪽에 모은다. 기록 유무는 색이 아니라 글자로 보인다 */}
                <div className="shrink-0 text-right">
                  {stage ? <StageBadge stage={stage} /> : <span className="text-xs text-fg-dim">기록 없음</span>}
                  {stage ? <span className="mt-0.5 block font-num text-xs text-fg-sub">{formatRate(item.mine?.rate)}</span> : null}
                </div>
                <button
                  type="button"
                  disabled={added || full || pendingId === item.songDifficultyId}
                  onClick={() => onAdd(item)}
                  aria-label={added ? `${item.title} 세트리스트에 담김` : `${item.title} 세트리스트에 담기`}
                  className="flex min-h-9 shrink-0 items-center rounded-lg border border-chip-line px-3 text-sm text-fg enabled:hover:bg-table-head disabled:text-disabled"
                >
                  {added ? "담김" : "담기"}
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
