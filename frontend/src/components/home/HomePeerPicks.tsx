"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { PeerReason } from "@/components/setlist/PeerReason";
import { useToast } from "@/components/Toast";
import { ChartLine } from "@/components/table/ChartLine";
import { StageRatePill } from "@/components/table/StageRatePill";
import { ApiError } from "@/lib/api";
import type { RecommendationItem } from "@/lib/api-types";
import { useJackets } from "@/lib/jackets";
import { pickHomeRecommendations } from "@/lib/peer-picks";
import { addToSetlist, fetchRecommendations, fetchSetlist, SETLIST_LIMIT, setlistKeys } from "@/lib/setlist";
import { useTranslations } from "next-intl";

/**
 * 홈 `다음 목표` 아래의 추천 곡 3줄(D89, 시안 Tier24 A). 세트리스트 추천과 같은 API·같은 쿼리 키(첫 쪽)를 써서 요청이 겹치지 않고,
 * 담으면 세트리스트 쿼리가 무효화되어 추천이 새로 채워진다. 불러오는 중·실패·추천할 수 없는 상태(READY가 아님)에서는 아무것도 그리지 않는다
 * (홈의 다른 카드를 막지 않는다). 근거 인원은 서버가 숨기는 기준(peer.*)을 이미 적용해 준 값이다.
 */
export function HomePeerPicks({ userId }: { userId: number }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const toast = useToast();
  const jackets = useJackets();
  const recommend = useQuery({
    queryKey: setlistKeys.recommend(userId, 0, 0),
    queryFn: ({ signal }) => fetchRecommendations(0, 0, signal),
  });
  const list = useQuery({ queryKey: setlistKeys.list(userId), queryFn: ({ signal }) => fetchSetlist(signal) });
  const add = useMutation({
    mutationFn: (item: RecommendationItem) => addToSetlist(item.songDifficultyId),
    onSuccess: async () => {
      toast(t("Setlist.added"));
      await queryClient.invalidateQueries({ queryKey: setlistKeys.all });
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : t("Common.actionFailed"), { kind: "error" }),
  });

  const picks = recommend.data ? pickHomeRecommendations(recommend.data) : [];
  if (picks.length === 0) return null;
  const items = list.data?.content ?? [];
  const addedIds = new Set(items.map((i) => i.songDifficultyId));
  const full = items.length >= SETLIST_LIMIT;
  const hasPeer = picks.some((item) => item.reason === "PEER_TIER");

  return (
    <section aria-label={t("Progress.picksAria")} className="flex flex-col gap-1">
      <h3 className="px-0.5 text-[11px] font-bold text-fg-sub">
        {hasPeer ? t("Progress.peerPicksTitle", { count: picks.length }) : t("Progress.picksTitle", { count: picks.length })}
      </h3>
      <ul aria-label={t("Progress.picksAria")} className="flex flex-col rounded-[10px] border border-line bg-card">
        {picks.map((item) => {
          const added = addedIds.has(item.songDifficultyId);
          return (
            <ChartLine
              key={item.songDifficultyId}
              className="border-t border-row-line first:border-t-0"
              jacket={jackets.visible ? { url: jackets.urlOf(item.songId) } : null}
              pattern={item.pattern}
              tier={item.tier}
              title={item.title}
              href={`/songs/${item.songId}?from=table&chart=${item.songDifficultyId}`}
              part={item.part}
              difficulty={item.difficulty}
              level={item.level}
              foot={item.reason ? <PeerReason item={item} /> : undefined}
              aside={
                <div className="flex w-[72px] shrink-0 flex-col items-end gap-1.5">
                  <StageRatePill stage={item.mine?.stage ?? null} rate={item.mine?.rate} />
                  <button
                    type="button"
                    disabled={added || full || (add.isPending && add.variables?.songDifficultyId === item.songDifficultyId)}
                    onClick={() => add.mutate(item)}
                    aria-label={added ? t("Setlist.addedAria", { title: item.title }) : t("Setlist.addAria", { title: item.title })}
                    className={`relative flex h-[26px] w-full items-center justify-center rounded-md border px-1 text-xs after:absolute after:-inset-1.5 after:content-[''] ${
                      added ? "border-done text-done-text" : "border-ctl text-fg enabled:hover:bg-table-head disabled:text-disabled"
                    }`}
                  >
                    {added ? t("Setlist.addedMark") : t("Setlist.addBtn")}
                  </button>
                </div>
              }
            />
          );
        })}
      </ul>
      <div className="flex items-center justify-between gap-2 px-0.5 text-[11px] text-fg-sub">
        <span className="font-num">{t("Progress.setlistCount", { count: items.length, limit: SETLIST_LIMIT })}</span>
        <Link href="/me?tab=list" className="flex min-h-11 items-center text-fg hover:underline">
          {t("Progress.morePicks")}
        </Link>
      </div>
    </section>
  );
}
