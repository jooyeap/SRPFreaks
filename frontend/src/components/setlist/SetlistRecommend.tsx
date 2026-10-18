"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pager } from "@/components/Pager";
import { useToast } from "@/components/Toast";
import { ChartBadge } from "@/components/table/Badges";
import { StageBadge } from "@/components/table/StageBadge";
import { ApiError } from "@/lib/api";
import type { RecommendationItem } from "@/lib/api-types";
import { formatRate, formatTier } from "@/lib/format";
import { addToSetlist, fetchRecommendations, SETLIST_LIMIT, setlistKeys } from "@/lib/setlist";

/**
 * 내 실력대 추천 (D37): 내 레이팅 목록의 평균 난이도를 기준으로 오늘 도전해 볼 채보를 두 묶음으로 보여 준다.
 * - SS 도전: 평균 ± rangeSs 안에서 기록이 없거나 SS 미만인 채보
 * - S 채우기: 평균 ± rangeS(더 넓다) 안에서 기록이 없거나 S 미만인 채보
 * 줄마다 `담기`를 누른다(한꺼번에 담는 버튼은 없다). 담으면 서버가 그 채보를 추천에서 빼므로 목록이 새로 채워진다.
 * 레이팅 채보가 모자라 평균을 구할 수 없으면 안내만 보인다. 범위 숫자는 서버 설정 값이라 화면에 하드코딩하지 않는다.
 */
export function SetlistRecommend({ userId, addedIds, full }: { userId: number; addedIds: ReadonlySet<number>; full: boolean }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(0);

  const result = useQuery({
    queryKey: setlistKeys.recommend(userId, page),
    queryFn: ({ signal }) => fetchRecommendations(page, signal),
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
      ) : result.data.baseTier === null ? (
        <p className="text-sm text-fg-sub">기록이 더 쌓이면 추천해 드려요. 레이팅 목록에 채보가 어느 정도 모이면 내 평균 난이도를 기준으로 골라 드립니다.</p>
      ) : (
        <>
          <p className="text-xs text-fg-sub">
            내 평균 난이도 <span className="font-num text-fg">{formatTier(result.data.baseTier)}</span> 기준입니다.
          </p>
          {full ? <p className="text-xs text-fg-sub">{SETLIST_LIMIT}곡이 모두 담겨 있습니다. 곡을 빼면 새로 담을 수 있습니다.</p> : null}
          <Group
            title="SS 도전"
            range={result.data.rangeSs}
            items={result.data.ssChallenge}
            addedIds={addedIds}
            full={full}
            pendingId={add.isPending ? add.variables?.songDifficultyId : undefined}
            onAdd={(item) => add.mutate(item)}
          />
          <Group
            title="S 채우기"
            range={result.data.rangeS}
            items={result.data.sFill}
            addedIds={addedIds}
            full={full}
            pendingId={add.isPending ? add.variables?.songDifficultyId : undefined}
            onAdd={(item) => add.mutate(item)}
          />
          <Pager page={page} totalPages={result.data.totalPages} onChange={setPage} />
        </>
      )}
    </section>
  );
}

function Group({
  title,
  range,
  items,
  addedIds,
  full,
  pendingId,
  onAdd,
}: {
  title: string;
  range: number;
  items: readonly RecommendationItem[];
  addedIds: ReadonlySet<number>;
  full: boolean;
  pendingId: number | undefined;
  onAdd: (item: RecommendationItem) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-bold text-fg-sub">
        {title} <span className="font-normal text-fg-dim">(평균 ±{range})</span>
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
                    {/* 기록 유무는 색이 아니라 글자로 보인다 */}
                    {stage ? (
                      <span className="flex items-center gap-1 text-xs text-fg-sub">
                        <StageBadge stage={stage} />
                        <span className="font-num">{formatRate(item.mine?.rate)}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-fg-dim">기록 없음</span>
                    )}
                  </p>
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
    </div>
  );
}
