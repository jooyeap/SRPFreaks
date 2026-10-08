"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef } from "react";
import { useForm } from "react-hook-form";
import { ApiError } from "@/lib/api";
import type { SongChartResponse, SongDetailResponse } from "@/lib/api-types";
import { difficultyLabel, partLabel } from "@/lib/format";
import {
  chartEditSchema,
  SONG_EDIT_AFFECTED_KEYS,
  songEditSchema,
  songToEditValues,
  updateChart,
  updateSong,
  type ChartEditValues,
  type SongEditValues,
} from "@/lib/song-admin";

const FIELD = "rounded-[10px] border border-line bg-card px-3 py-2 text-fg";

/** 무엇을 고치는지. song = 곡 정보(곡명·아티스트·버전), chart = 지금 보는 채보의 레벨. */
export type SongEditTarget = { kind: "song"; song: SongDetailResponse } | { kind: "chart"; song: SongDetailResponse; chart: SongChartResponse };

/**
 * 곡·채보 수정 창(ROOT·ADMIN). 등록 창과 같은 <dialog> 방식이다 (모바일은 아래 시트, md 이상은 가운데 창).
 * target이 null이면 닫힌 것이고, 닫으면 안의 폼을 지워서 다시 열 때 최신 값으로 시작한다.
 * 채보의 파트·난이도는 서버가 바꾸지 못하게 해서(채보의 정체성) 레벨만 고친다.
 */
export function SongEditDialog({ target, onClose }: { target: SongEditTarget | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const open = target !== null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90vh] w-full max-w-none overflow-y-auto rounded-t-[20px] border border-line bg-card px-5 pb-5 pt-2.5 text-fg backdrop:bg-black/60 md:inset-0 md:m-auto md:max-w-md md:rounded-xl"
    >
      {target ? (
        <>
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-chip-line md:hidden" aria-hidden="true" />
          <h2 id={titleId} className="mb-3 text-lg font-extrabold">
            {target.kind === "song" ? "곡 정보 수정" : "채보 수정"}
          </h2>
          {target.kind === "song" ? <SongForm song={target.song} onDone={onClose} /> : <ChartForm song={target.song} chart={target.chart} onDone={onClose} />}
        </>
      ) : null}
    </dialog>
  );
}

function useErrorText(error: unknown): { message: string | null; lines: string[] } {
  if (!error) {
    return { message: null, lines: [] };
  }
  if (error instanceof ApiError) {
    return { message: error.message, lines: error.fieldErrors ? Object.values(error.fieldErrors) : [] };
  }
  return { message: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", lines: [] };
}

function Footer({ pending, error, onDone }: { pending: boolean; error: unknown; onDone: () => void }) {
  const { message, lines } = useErrorText(error);
  return (
    <>
      {message ? (
        <div role="alert" className="text-sm text-fg">
          <p>{message}</p>
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
      <div className="flex gap-2.5">
        <button type="button" onClick={onDone} className="h-12 w-24 rounded-xl border border-chip-line text-sm font-bold text-fg-sub hover:text-fg">
          취소
        </button>
        <button type="submit" disabled={pending} className="h-12 flex-1 rounded-xl bg-chip-on-bg text-sm font-extrabold text-chip-on-fg disabled:opacity-60">
          {pending ? "저장 중" : "저장"}
        </button>
      </div>
    </>
  );
}

function SongForm({ song, onDone }: { song: SongDetailResponse; onDone: () => void }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SongEditValues>({ resolver: zodResolver(songEditSchema), defaultValues: songToEditValues(song), mode: "onTouched" });

  const mutation = useMutation({
    mutationFn: (values: SongEditValues) => updateSong(song, values),
    onSuccess: async () => {
      await Promise.all(SONG_EDIT_AFFECTED_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      onDone();
    },
  });

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="edit-title" className="text-sm text-fg-sub">
          곡명
        </label>
        <input id="edit-title" type="text" autoComplete="off" aria-invalid={errors.title ? true : undefined} className={FIELD} {...register("title")} />
        {errors.title ? (
          <p role="alert" className="text-sm text-fg">
            {errors.title.message}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="edit-artist" className="text-sm text-fg-sub">
          아티스트
        </label>
        <input id="edit-artist" type="text" autoComplete="off" className={FIELD} {...register("artist")} />
        {errors.artist ? (
          <p role="alert" className="text-sm text-fg">
            {errors.artist.message}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="edit-version" className="text-sm text-fg-sub">
          버전
        </label>
        <input id="edit-version" type="text" autoComplete="off" className={`${FIELD} w-40`} {...register("addedVersion")} />
        {errors.addedVersion ? (
          <p role="alert" className="text-sm text-fg">
            {errors.addedVersion.message}
          </p>
        ) : null}
      </div>
      <p className="text-xs text-fg-dim">변경 내용은 관리 기록에 남습니다.</p>
      <Footer pending={mutation.isPending} error={mutation.error} onDone={onDone} />
    </form>
  );
}

function ChartForm({ song, chart, onDone }: { song: SongDetailResponse; chart: SongChartResponse; onDone: () => void }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChartEditValues>({
    resolver: zodResolver(chartEditSchema),
    defaultValues: { level: chart.level.toFixed(2) },
    mode: "onTouched",
  });

  const mutation = useMutation({
    mutationFn: (values: ChartEditValues) => updateChart(chart, values),
    onSuccess: async () => {
      await Promise.all(SONG_EDIT_AFFECTED_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      onDone();
    },
  });

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate className="flex flex-col gap-4">
      <p className="text-sm text-fg-sub">
        {song.title} · {partLabel(chart.instrumentPart)} {difficultyLabel(chart.difficultyType)}
      </p>
      <div className="flex flex-col gap-1">
        <label htmlFor="edit-level" className="text-sm text-fg-sub">
          레벨
        </label>
        <input
          id="edit-level"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={errors.level ? true : undefined}
          className={`${FIELD} w-32 font-num`}
          {...register("level")}
        />
        {errors.level ? (
          <p role="alert" className="text-sm text-fg">
            {errors.level.message}
          </p>
        ) : null}
      </div>
      <p className="text-xs text-fg-dim">파트와 난이도는 바꿀 수 없습니다. 바꾸려면 채보를 삭제하고 다시 등록해 주세요. 변경 내용은 관리 기록에 남습니다.</p>
      <Footer pending={mutation.isPending} error={mutation.error} onDone={onDone} />
    </form>
  );
}
