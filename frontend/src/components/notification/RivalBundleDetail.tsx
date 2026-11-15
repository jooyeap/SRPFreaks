"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import type { RivalBundleSongResponse, RivalNotificationResponse } from "@/lib/api-types";
import { formatRate } from "@/lib/format";
import { fetchRivalBundleSongs, formatScoreDiff, notificationKeys } from "@/lib/rivals";
import { ChartChip, DiffChip } from "@/components/notification/NotificationParts";

/** 곡 한 줄의 차이(내 − 상대). 둘째 자리 값으로 부호를 정한다(formatScoreDiff). */
function songDiff(song: RivalBundleSongResponse) {
  return formatScoreDiff(song.myRate - song.actorRate);
}

/**
 * 라이벌 묶음 알림의 곡 목록 화면(D86, 시안 ③). 알림 창 안에서 목록 대신 보인다.
 * 곡 = 그날 하루 알림 건수를 넘어 묶인 곡 전부. 상대·내 달성률은 알림을 보인 시점 값이고 차이(내 − 상대)는 여기서 계산한다.
 * 20곡씩 `곡 더 보기`로 이어 받는다. 예전에 묶여 곡 목록이 남지 않은 곡이 있으면(missingCount) 맨 아래에 안내한다.
 * 맨 아래 버튼은 그 사람과의 곡별 승패 화면으로 간다(onCompare).
 */
export function RivalBundleDetail({
  viewerId,
  item,
  nickname,
  onBack,
  onCompare,
}: {
  viewerId: number;
  item: RivalNotificationResponse;
  nickname: string;
  onBack: () => void;
  onCompare: () => void;
}) {
  const t = useTranslations("Notify");
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // 화면이 바뀐 것을 키보드·스크린리더 사용자도 알 수 있게 되돌아가기 버튼으로 초점을 옮긴다
    backRef.current?.focus();
  }, []);

  const query = useInfiniteQuery({
    queryKey: notificationKeys.bundle(viewerId, item.id),
    queryFn: ({ pageParam, signal }) => fetchRivalBundleSongs(item.id, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.songs.page + 1 < last.songs.totalPages ? last.songs.page + 1 : undefined),
    retry: false,
  });

  const first = query.data?.pages[0];
  const songs = query.data?.pages.flatMap((p) => p.songs.content) ?? [];
  const n = first?.songCount ?? item.songCount;

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex items-center gap-1">
        <button
          ref={backRef}
          type="button"
          aria-label={t("bundleBack")}
          onClick={onBack}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-lg text-fg-sub hover:text-fg"
        >
          <span aria-hidden="true">‹</span>
        </button>
        <b className="min-w-0 flex-1 text-sm text-fg [overflow-wrap:anywhere]">{t("bundleTitle", { nickname, n })}</b>
      </div>
      <p className="px-1 text-xs text-fg-dim">{t("bundleNote")}</p>
      <div className="min-h-0 overflow-y-auto overflow-x-hidden">
        {query.isPending ? (
          <p className="p-3 text-sm text-fg-sub">{t("loading")}</p>
        ) : query.isError ? (
          <p role="alert" className="p-3 text-sm text-fg">{t("failed")}</p>
        ) : songs.length === 0 ? (
          <p className="p-3 text-sm text-fg-sub">{t("bundleEmpty")}</p>
        ) : (
          <ul className="flex flex-col">
            {songs.map((song, i) => {
              const diff = songDiff(song);
              return (
                <li key={`${song.songDifficultyId}-${i}`} className="flex min-h-11 items-start justify-between gap-3 border-t border-row-line px-1 py-2.5 first:border-t-0">
                  <span className="min-w-0 break-keep [overflow-wrap:anywhere]">
                    <b className="block text-[13px] leading-5 text-fg">{song.title}</b>
                    <span className="mt-1 block"><ChartChip part={song.part} difficulty={song.difficulty} /></span>
                  </span>
                  <span className="shrink-0 text-right font-num text-xs leading-5 text-fg-dim">
                    <span className="block">
                      {t("theirsLabel")} <b className="text-fg">{formatRate(song.actorRate)}</b>
                    </span>
                    <span className="flex items-baseline justify-end gap-1.5">
                      <span>
                        {t("mineLabel")} <b className="text-fg-sub">{formatRate(song.myRate)}</b>
                      </span>
                      {diff ? <DiffChip text={diff.text} sign={diff.sign} /> : null}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {query.hasNextPage ? (
          <button
            type="button"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
            className="mt-1 flex min-h-11 w-full items-center justify-center rounded-xl border border-ctl px-3 text-xs text-fg-sub hover:text-fg disabled:opacity-50"
          >
            {t("bundleMore")}
          </button>
        ) : null}
        {first && first.missingCount > 0 ? <p className="mt-2 px-1 text-xs text-fg-dim">{t("bundleMissing", { n: first.missingCount })}</p> : null}
      </div>
      <button
        type="button"
        onClick={onCompare}
        className="flex min-h-11 w-full items-center justify-center rounded-xl border border-check-line px-3 text-center text-xs font-bold text-check-fg [overflow-wrap:anywhere]"
      >
        {t("bundleCompare", { nickname })}
      </button>
    </div>
  );
}
