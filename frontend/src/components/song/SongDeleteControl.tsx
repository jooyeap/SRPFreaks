"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import { deleteChart, deleteSong, SONG_DELETE_AFFECTED_KEYS } from "@/lib/song-admin";

type Target = "song" | "chart";

const BTN = "rounded-full border border-chip-line px-3 py-1 text-sm text-fg-sub hover:text-fg";

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
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<Target | null>(null);

  const mutation = useMutation({
    mutationFn: (target: Target) => (target === "song" ? deleteSong(songId) : deleteChart(chartId ?? 0)),
    onSuccess: (_data, target) => {
      setConfirming(null);
      // 화면을 먼저 옮긴다. 목록을 먼저 새로 받으면 지워진 곡의 상세 조회가 404가 되어 오류 화면이 잠깐 보인다.
      onDeleted(target);
      void Promise.all(SONG_DELETE_AFFECTED_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
  });

  const message =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? "삭제하지 못했습니다. 잠시 후 다시 시도해 주세요."
        : null;

  if (confirming) {
    const what = confirming === "song" ? `'${songTitle}' 곡과 모든 채보를` : `'${songTitle}'의 ${chartLabel ?? "이 채보"}를`;
    return (
      <div role="group" aria-label="삭제 확인" className="flex flex-col gap-2 rounded-xl border border-line bg-card p-3">
        <p className="text-sm text-fg">{what} 삭제할까요? 목록·서열표·레이팅에서 빠지고, 삭제 내용은 관리 기록에 남습니다.</p>
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
            {mutation.isPending ? "삭제 중" : "삭제"}
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
            취소
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {chartId !== null ? (
        <button type="button" onClick={() => setConfirming("chart")} className={BTN}>
          채보 삭제
        </button>
      ) : null}
      <button type="button" onClick={() => setConfirming("song")} className={BTN}>
        곡 삭제
      </button>
    </div>
  );
}
