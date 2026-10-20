"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import type { SongChartResponse } from "@/lib/api-types";
import { patternLabel, recommendLabel } from "@/lib/chart-labels";
import { difficultyLabel, partLabel } from "@/lib/format";
import {
  addChart,
  availableCombos,
  emptyChart,
  makeChartSchema,
  newChartAddProgress,
  SONG_CREATE_AFFECTED_KEYS,
  type ChartValues,
} from "@/lib/song-admin";
import { PATTERN_CHOICES, RECOMMEND_CHOICES } from "@/lib/table-entry-admin";

const FIELD = "rounded-[10px] border border-line bg-card px-3 py-2 text-fg";

/**
 * 기존 곡에 채보(파트·난이도) 하나를 추가하는 창 (ROOT·ADMIN, 곡 상세 `관리` 창에서 연다).
 * 곡 등록 창과 같은 <dialog> 방식이다. 서버는 (곡, 파트, 난이도)가 같은 채보를 거절(409)하므로 이미 있는 조합은 선택지에서 뺀다.
 * tableId가 있으면(서열표를 받은 상태) 기준 난이도·추천도·속성을 같이 받아 서열표에도 넣는다. 기준 난이도를 비우면 미정이다.
 */
export function ChartAddDialog({
  open,
  songId,
  existing,
  tableId,
  onClose,
}: {
  open: boolean;
  songId: number;
  /** 이 곡에 이미 있는 채보. 같은 조합은 고를 수 없다 */
  existing: readonly SongChartResponse[];
  tableId: number | null;
  onClose: () => void;
}) {
  const t = useTranslations();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

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
      {open ? (
        <>
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-chip-line md:hidden" aria-hidden="true" />
          <h2 id={titleId} className="mb-3 text-lg font-extrabold">
            {t("ChartAdd.title")}
          </h2>
          <ChartAddForm songId={songId} existing={existing} tableId={tableId} onDone={onClose} />
        </>
      ) : null}
    </dialog>
  );
}

function ChartAddForm({
  songId,
  existing,
  tableId,
  onDone,
}: {
  songId: number;
  existing: readonly SongChartResponse[];
  tableId: number | null;
  onDone: () => void;
}) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const toast = useToast();
  // 채보는 만들어졌는데 서열표 저장이 실패했을 때 이어서 하려고 ref에 둔다 (렌더가 바뀌어도 유지)
  const progress = useRef(newChartAddProgress());
  const [locked, setLocked] = useState(false);

  // 창을 연 순간의 조합 목록으로 고정한다. 채보를 만든 뒤 곡 정보가 새로 오면 목록이 바뀌어 선택이 사라지는 걸 막는다.
  const [combos] = useState(() => availableCombos(existing));
  const [comboIndex, setComboIndex] = useState(0);

  const schema = useMemo(() => makeChartSchema(t), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChartValues>({ resolver: zodResolver(schema), defaultValues: emptyChart(), mode: "onTouched" });

  const mutation = useMutation({
    mutationFn: (values: ChartValues) => {
      const combo = combos[comboIndex];
      return addChart(songId, { ...values, part: combo.part, difficulty: combo.difficulty }, tableId, progress.current);
    },
    onSuccess: async () => {
      await Promise.all(SONG_CREATE_AFFECTED_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      toast(t("ChartAdd.added"));
      onDone();
    },
    onError: async () => {
      if (progress.current.chartId !== null) {
        // 채보는 이미 생겼으니 목록은 새로 받고, 값은 바꾸지 못하게 잠근다
        setLocked(true);
        await Promise.all(SONG_CREATE_AFFECTED_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      }
    },
  });

  const failure = mutation.error;
  const serverMessage = failure instanceof ApiError ? failure.message : failure ? t("Song.saveFailed") : null;
  const fieldLines = failure instanceof ApiError && failure.fieldErrors ? Object.values(failure.fieldErrors) : [];

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate className="flex flex-col gap-4">
      <p className="text-sm text-fg-sub">{t("ChartAdd.lead")}</p>
      <fieldset disabled={locked} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-stretch gap-2">
          <select
            aria-label={t("ChartAdd.combo")}
            className={FIELD}
            value={comboIndex}
            onChange={(event) => setComboIndex(Number(event.target.value))}
          >
            {combos.map((combo, index) => (
              <option key={`${combo.part}|${combo.difficulty}`} value={index}>
                {partLabel(combo.part)} {difficultyLabel(combo.difficulty)}
              </option>
            ))}
          </select>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder={t("SongCreate.levelPlaceholder")}
            aria-label={t("ChartAdd.level")}
            aria-invalid={errors.level ? true : undefined}
            className={`${FIELD} w-28`}
            {...register("level")}
          />
        </div>
        {errors.level ? (
          <p role="alert" className="text-sm text-fg">
            {errors.level.message}
          </p>
        ) : null}

        {tableId !== null ? (
          <div className="flex flex-wrap items-start gap-2">
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder={t("SongCreate.tierPlaceholder")}
              aria-label={t("ChartAdd.tier")}
              aria-invalid={errors.tier ? true : undefined}
              className={`${FIELD} w-52`}
              {...register("tier")}
            />
            <select aria-label={t("ChartAdd.recommend")} className={FIELD} {...register("recommend")}>
              <option value="">{t("SongCreate.noRecommend")}</option>
              {RECOMMEND_CHOICES.map((value) => (
                <option key={value} value={value}>
                  {recommendLabel(value, t)}
                </option>
              ))}
            </select>
            <select aria-label={t("ChartAdd.pattern")} className={FIELD} {...register("pattern")}>
              <option value="">{t("SongCreate.noPattern")}</option>
              {PATTERN_CHOICES.map((value) => (
                <option key={value} value={value}>
                  {patternLabel(value, t)}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {errors.tier ? (
          <p role="alert" className="text-sm text-fg">
            {errors.tier.message}
          </p>
        ) : null}
        {tableId !== null ? (
          <div className="flex flex-col gap-1">
            <label className="flex min-h-9 items-center gap-2 text-sm text-fg-sub">
              <input type="checkbox" className="size-4" {...register("ratingEnabled")} />
              {t("ChartAdd.rating")}
            </label>
            <p className="text-xs text-fg-dim">{t("Song.offNote")}</p>
          </div>
        ) : null}
      </fieldset>

      <p className="text-xs text-fg-dim">
        {tableId !== null ? t("SongCreate.noteTable") : t("SongCreate.noteListOnly")}
        {t("SongCreate.noteCommon")}
      </p>

      {locked ? (
        <p role="alert" className="text-sm text-fg">
          {t("ChartAdd.partialFail")}
        </p>
      ) : null}
      {serverMessage ? (
        <div role="alert" className="text-sm text-fg">
          <p>{serverMessage}</p>
          {fieldLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2.5">
        <button type="button" onClick={onDone} className="h-12 w-24 rounded-xl border border-chip-line text-sm font-bold text-fg-sub hover:text-fg">
          {locked ? t("SongCreate.close") : t("Common.cancel")}
        </button>
        <button
          type="submit"
          disabled={mutation.isPending || combos.length === 0}
          className="h-12 flex-1 rounded-xl bg-chip-on-bg text-sm font-extrabold text-chip-on-fg disabled:opacity-60"
        >
          {mutation.isPending ? t("ChartAdd.submitting") : locked ? t("ChartAdd.retry") : t("ChartAdd.submit")}
        </button>
      </div>
    </form>
  );
}
