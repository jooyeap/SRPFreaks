"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/components/Toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ApiError } from "@/lib/api";
import type { SongChartResponse, SongDetailResponse } from "@/lib/api-types";
import { difficultyLabel, partLabel } from "@/lib/format";
import {
  addAlias,
  aliasesOf,
  aliasLimit,
  makeChartEditSchema,
  SONG_EDIT_AFFECTED_KEYS,
  makeSongEditSchema,
  songToEditValues,
  updateChart,
  updateSong,
  type ChartEditValues,
  type SongEditValues,
} from "@/lib/song-admin";
import { useTranslations } from "next-intl";
import { TitleDuplicateNotice } from "@/components/song/TitleDuplicateNotice";

const FIELD = "rounded-[10px] border border-line bg-card px-3 py-2 text-fg";

/** 무엇을 고치는지. song = 곡 정보(곡명·아티스트·버전), chart = 지금 보는 채보의 레벨. */
export type SongEditTarget = { kind: "song"; song: SongDetailResponse } | { kind: "chart"; song: SongDetailResponse; chart: SongChartResponse };

/**
 * 곡·채보 수정 창(ROOT·ADMIN). 등록 창과 같은 <dialog> 방식이다 (모바일은 아래 시트, md 이상은 가운데 창).
 * target이 null이면 닫힌 것이고, 닫으면 안의 폼을 지워서 다시 열 때 최신 값으로 시작한다.
 * 채보의 파트·난이도는 서버가 바꾸지 못하게 해서(채보의 정체성) 레벨만 고친다.
 */
export function SongEditDialog({ target, onClose }: { target: SongEditTarget | null; onClose: () => void }) {
  const t = useTranslations();
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
            {target.kind === "song" ? t("Song.editSong") : t("Song.editChart")}
          </h2>
          {target.kind === "song" ? <SongForm song={target.song} onDone={onClose} /> : <ChartForm song={target.song} chart={target.chart} onDone={onClose} />}
        </>
      ) : null}
    </dialog>
  );
}

function useErrorText(error: unknown): { message: string | null; lines: string[] } {
  const t = useTranslations();
  if (!error) {
    return { message: null, lines: [] };
  }
  if (error instanceof ApiError) {
    return { message: error.message, lines: error.fieldErrors ? Object.values(error.fieldErrors) : [] };
  }
  return { message: t("Song.saveFailed"), lines: [] };
}

function Footer({ pending, error, onDone }: { pending: boolean; error: unknown; onDone: () => void }) {
  const t = useTranslations();
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
          {t("Common.cancel")}
        </button>
        <button type="submit" disabled={pending} className="h-12 flex-1 rounded-xl bg-chip-on-bg text-sm font-extrabold text-chip-on-fg disabled:opacity-60">
          {pending ? t("Song.saving") : t("Song.save")}
        </button>
      </div>
    </>
  );
}

function SongForm({ song, onDone }: { song: SongDetailResponse; onDone: () => void }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const schema = useMemo(() => makeSongEditSchema(t), [t]);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SongEditValues>({ resolver: zodResolver(schema), defaultValues: songToEditValues(song), mode: "onTouched" });
  const titleValue = useWatch({ control, name: "title" });

  // 검색 키워드(별칭): 곡명 대신 쓰는 줄임말·별명. 폼 값(RHF)과 따로 목록 상태로 두고, 저장할 때 곡 정보와 함께 보낸다.
  const [aliases, setAliases] = useState<string[]>(() => aliasesOf(song));
  const [draft, setDraft] = useState("");
  const [aliasError, setAliasError] = useState<string | null>(null);
  const limit = aliasLimit(song);

  function commitDraft(): string[] | null {
    if (draft.trim() === "") {
      return aliases;
    }
    const result = addAlias(aliases, draft, limit, t);
    if (!result.ok) {
      setAliasError(result.message);
      return null;
    }
    setAliases(result.aliases);
    setDraft("");
    setAliasError(null);
    return result.aliases;
  }

  const toast = useToast();
  const mutation = useMutation({
    mutationFn: ({ values, list }: { values: SongEditValues; list: string[] }) => updateSong(song, values, list),
    onSuccess: async () => {
      toast(t("Song.songEdited"));
      await Promise.all(SONG_EDIT_AFFECTED_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      onDone();
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => {
        // 입력칸에 쓰고 `추가`를 안 눌렀더라도 저장할 때 같이 넣는다(적은 키워드가 사라지지 않게)
        const list = commitDraft();
        if (list) {
          mutation.mutate({ values, list });
        }
      })}
      noValidate
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="edit-title" className="text-sm text-fg-sub">
          {t("Song.fieldTitle")}
        </label>
        <input id="edit-title" type="text" autoComplete="off" aria-invalid={errors.title ? true : undefined} className={FIELD} {...register("title")} />
        {errors.title ? (
          <p role="alert" className="text-sm text-fg">
            {errors.title.message}
          </p>
        ) : null}
        <TitleDuplicateNotice title={titleValue ?? ""} excludeSongId={song.id} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="edit-artist" className="text-sm text-fg-sub">
          {t("Song.fieldArtist")}
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
          {t("Song.fieldVersion")}
        </label>
        <input id="edit-version" type="text" autoComplete="off" className={`${FIELD} w-40`} {...register("addedVersion")} />
        {errors.addedVersion ? (
          <p role="alert" className="text-sm text-fg">
            {errors.addedVersion.message}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-alias" className="text-sm text-fg-sub">
          {t("Song.searchKeywords")}
        </label>
        {aliases.length > 0 ? (
          <ul aria-label={t("Song.registeredKeywords")} className="flex flex-wrap gap-1.5">
            {aliases.map((alias) => (
              <li key={alias} className="flex items-center gap-1 rounded-lg border border-chip-line py-0.5 pl-3 pr-1 text-sm text-fg">
                {alias}
                <button
                  type="button"
                  onClick={() => setAliases((current) => current.filter((a) => a !== alias))}
                  aria-label={t("Song.removeKeyword", { alias })}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-fg-sub hover:text-fg"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-fg-dim">{t("Song.noKeywords")}</p>
        )}
        <div className="flex gap-2">
          <input
            id="edit-alias"
            type="text"
            autoComplete="off"
            maxLength={255}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter는 폼 저장이 아니라 키워드 추가로 쓴다
              if (event.key === "Enter") {
                event.preventDefault();
                commitDraft();
              }
            }}
            aria-describedby="edit-alias-help"
            className={`${FIELD} min-w-0 flex-1`}
          />
          <button type="button" onClick={commitDraft} className="rounded-[10px] border border-chip-line px-4 text-sm font-bold text-fg-sub hover:text-fg">
            {t("Song.add")}
          </button>
        </div>
        {aliasError ? (
          <p role="alert" className="text-sm text-fg">
            {aliasError}
          </p>
        ) : null}
        <p id="edit-alias-help" className="text-xs text-fg-dim">
          {t("Song.aliasHelp", { count: aliases.length, limit })}
        </p>
      </div>
      <p className="text-xs text-fg-dim">{t("Song.auditNote")}</p>
      <Footer pending={mutation.isPending} error={mutation.error} onDone={onDone} />
    </form>
  );
}

function ChartForm({ song, chart, onDone }: { song: SongDetailResponse; chart: SongChartResponse; onDone: () => void }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const chartSchema = useMemo(() => makeChartEditSchema(t), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChartEditValues>({
    resolver: zodResolver(chartSchema),
    defaultValues: { level: chart.level.toFixed(2) },
    mode: "onTouched",
  });

  const toast = useToast();
  const mutation = useMutation({
    mutationFn: (values: ChartEditValues) => updateChart(chart, values),
    onSuccess: async () => {
      toast(t("Song.chartEdited"));
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
          {t("Song.fieldLevel")}
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
      <p className="text-xs text-fg-dim">{t("Song.partLockedNote")}</p>
      <Footer pending={mutation.isPending} error={mutation.error} onDone={onDone} />
    </form>
  );
}
