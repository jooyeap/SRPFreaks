"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/Toast";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import { deleteChart, deleteSong, SONG_DELETE_AFFECTED_KEYS } from "@/lib/song-admin";
import { useTranslations } from "next-intl";

type Target = "song" | "chart";

const BTN = "rounded-lg border border-chip-line px-3 py-1 text-sm text-fg-sub hover:text-fg";

/**
 * 곡 삭제 / 채보 삭제 (ROOT·ADMIN 전용, 부모가 role을 보고 그린다. 서버도 권한을 다시 검사한다).
 * 되돌리기 어려운 동작이라 누르면 바로 지우지 않고 확인 문구와 `삭제`/`취소`를 먼저 보여 준다.
 * 서버는 소프트 삭제라 기록 자체는 남지만 목록·서열표·레이팅에서는 빠진다.
 * onDeleted: 삭제가 끝난 뒤 화면을 옮기는 일은 부모가 한다 (곡 삭제는 곡 목록으로, 채보 삭제는 같은 곡으로).
 */
export function SongDeleteControl({
  songId,
  songTitle,
  chartId,
  chartLabel,
  onDeleted,
}: {
  songId: number;
  songTitle: string;
  /** 지금 보고 있는 채보. 없으면 채보 삭제 버튼은 숨긴다 */
  chartId: number | null;
  chartLabel: string | null;
  onDeleted: (target: Target) => void;
}) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<Target | null>(null);

  const toast = useToast();
  const mutation = useMutation({
    mutationFn: (target: Target) => (target === "song" ? deleteSong(songId) : deleteChart(chartId ?? 0)),
    onSuccess: (_data, target) => {
      setConfirming(null);
      toast(target === "song" ? t("Song.songDeleted") : t("Song.chartDeleted"));
      // 화면을 먼저 옮긴다. 목록을 먼저 새로 받으면 지워진 곡의 상세 조회가 404가 되어 오류 화면이 잠깐 보인다.
      onDeleted(target);
      void Promise.all(SONG_DELETE_AFFECTED_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
  });

  const message =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? t("Song.deleteFailed")
        : null;

  if (confirming) {
    const sentence =
      confirming === "song"
        ? t("Song.confirmSong", { title: songTitle })
        : t("Song.confirmChart", { title: songTitle, chart: chartLabel ?? t("Song.thisChart") });
    return (
      <div role="group" aria-label={t("Song.deleteConfirm")} className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
        <p className="text-sm text-fg">{sentence}</p>
        {message ? (
          <p role="alert" className="text-sm text-fg">
            {message}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(confirming)}
            className="h-10 rounded-xl bg-chip-on-bg px-5 text-sm font-extrabold text-chip-on-fg disabled:opacity-60"
          >
            {mutation.isPending ? t("Song.deleting") : t("Song.delete")}
          </button>
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => {
              mutation.reset();
              setConfirming(null);
            }}
            className="h-10 rounded-xl border border-chip-line px-5 text-sm font-bold text-fg-sub hover:text-fg"
          >
            {t("Common.cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {chartId !== null ? (
        <button type="button" onClick={() => setConfirming("chart")} className={BTN}>
          {t("Song.deleteChart")}
        </button>
      ) : null}
      <button type="button" onClick={() => setConfirming("song")} className={BTN}>
        {t("Song.deleteSong")}
      </button>
    </div>
  );
}
