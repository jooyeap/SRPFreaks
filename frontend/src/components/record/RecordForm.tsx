"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
// import { SongJacket } from "@/components/SongJacket"; // 재킷 칸 숨김 (아래 주석 참고)
import { StageBadge } from "@/components/table/StageBadge";
import { ChartBadge } from "@/components/table/Badges";
import { ApiError } from "@/lib/api";
import { makeRecordSchema, type RecordFormValues } from "@/lib/record-schema";
import {
  AFFECTED_QUERY_KEYS,
  createRecord,
  deleteRecord,
  isMaxRate,
  recordToFormValues,
  toRecordRequest,
  todaySeoul,
  updateRecord,
  type RecordResponse,
} from "@/lib/records";
import { chartTierAttrs, previewScore } from "@/lib/chart-tier";
import { formatScore, formatTier } from "@/lib/format";
import { achievementStage } from "@/lib/stage";
import type { DifficultyType, InstrumentPart } from "@/lib/types";

/** 기록을 입력할 채보 정보 (서열표 줄에서 넘어온다). */
export interface RecordChart {
  songDifficultyId: number;
  title: string;
  part: InstrumentPart;
  difficulty: DifficultyType;
  level: number;
  /** 서열표의 레이팅 상수 난이도. 있으면 달성률을 입력하는 동안 점수를 바로 계산해 보여 준다. 미정이거나 모르면 null/생략 */
  tier?: number | null;
}

const FIELD_NAMES = ["achievementRate", "fullCombo", "playedDate", "memo"] as const;
type FieldName = (typeof FIELD_NAMES)[number];

function isFieldName(name: string): name is FieldName {
  return (FIELD_NAMES as readonly string[]).includes(name);
}

/**
 * 기록 등록/수정 폼. record가 있으면 수정(같은 화면, 저장은 PUT, "이 기록 삭제"가 붙는다), 없으면 등록이다 (DESIGN-UI 10장).
 * 수정에서는 채보를 바꿀 수 없다. 잘못 골랐으면 삭제 후 다시 입력한다 (서버 규칙). React Hook Form이 입력 상태를, Zod가 검사를 맡는다.
 * 달성 단계 미리보기는 입력값에서 계산해서 보여 줄 뿐이고, 단계는 저장하지 않는다 (D9, D24).
 */
export function RecordForm({
  chart,
  record,
  onSaved,
  onDeleted,
  onCancel,
}: {
  chart: RecordChart;
  record?: RecordResponse;
  onSaved: (saved: RecordResponse) => void;
  onDeleted?: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  // 스키마와 기본값은 한 번만 만든다 ("오늘"은 폼을 연 시점 기준)
  const schema = useMemo(() => makeRecordSchema(todaySeoul), []);
  const defaultValues = useMemo<RecordFormValues>(
    () =>
      record
        ? recordToFormValues(record)
        : { achievementRate: "", fullCombo: false, playedDate: todaySeoul(), memo: "" },
    [record],
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<RecordFormValues>({ resolver: zodResolver(schema), defaultValues, mode: "onTouched" });

  // useWatch: 입력이 바뀔 때마다 이 컴포넌트를 다시 그려서 미리보기를 갱신한다 (watch는 React 컴파일러와 맞지 않는다)
  const rate = useWatch({ control, name: "achievementRate" });
  const fullComboChecked = useWatch({ control, name: "fullCombo" });
  const maxRate = isMaxRate(rate);
  const fullCombo = maxRate || fullComboChecked; // 100.00이면 풀콤보를 자동으로 켠다 (DESIGN-UI 10장)
  const rateNumber = rate.trim() === "" ? null : Number(rate.trim());
  const stage = rateNumber === null || Number.isNaN(rateNumber) ? null : achievementStage(rateNumber, fullCombo);
  // 입력한 달성률로 곡 점수를 바로 계산한다(저장하지 않는 미리보기). 레이팅 상수 난이도가 없거나 달성률이 범위 밖이면 null
  const preview =
    chart.tier === undefined || chart.tier === null || rateNumber === null ? null : previewScore(chart.tier, rateNumber);

  const mutation = useMutation({
    mutationFn: (values: RecordFormValues) => {
      const body = toRecordRequest(chart.songDifficultyId, values);
      return record ? updateRecord(record.id, body) : createRecord(body);
    },
    onSuccess: async (saved) => {
      // 서열표(내 기록, 칩, 평균)와 기록 목록이 바로 바뀌도록 관련 캐시를 무효화한다
      await Promise.all(AFFECTED_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      onSaved(saved);
    },
    onError: (error) => {
      // 서버가 필드별 오류를 주면 해당 입력칸 아래에 보여 준다
      if (error instanceof ApiError && error.fieldErrors) {
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          if (isFieldName(field)) {
            setError(field, { message });
          }
        }
      }
    },
  });

  const removal = useMutation({
    mutationFn: () => (record ? deleteRecord(record.id) : Promise.resolve()),
    onSuccess: async () => {
      await Promise.all(AFFECTED_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      onDeleted?.();
    },
  });

  const failure = mutation.error ?? removal.error;
  const serverMessage =
    failure instanceof ApiError && !failure.fieldErrors
      ? failure.message
      : failure
        ? "저장하지 못했습니다. 잠시 후 다시 시도해 주세요."
        : null;

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {/* 재킷 칸은 저작권(이미지 사용 허락) 문제가 정리될 때까지 숨긴다. 복원할 때 이 줄과 위의 import 주석을 되살린다. */}
        {/* <SongJacket className="h-11 w-11 rounded-[9px]" /> */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-fg">{chart.title}</p>
          <p className="mt-1 flex items-center gap-2 text-xs text-fg-sub">
            <ChartBadge part={chart.part} difficulty={chart.difficulty} level={chart.level} />
          </p>
        </div>
      </div>

      <div className="flex items-stretch gap-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor="achievementRate" className="text-xs font-bold text-fg-dim">
            달성률
          </label>
          <div className="flex h-[54px] items-center justify-between rounded-xl border-2 border-chip-on-bg bg-card px-3.5">
            <input
              id="achievementRate"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00 ~ 100.00"
              aria-invalid={errors.achievementRate ? true : undefined}
              aria-describedby={errors.achievementRate ? "achievementRate-error" : undefined}
              className="w-full min-w-0 bg-transparent font-num text-[26px] font-bold text-fg outline-none placeholder:text-base placeholder:font-normal placeholder:text-fg-faint"
              {...register("achievementRate")}
            />
            <span className="text-sm text-fg-dim" aria-hidden="true">
              %
            </span>
          </div>
          <p className="text-[11px] text-fg-faint">0.00 ~ 100.00 · 소수점 둘째 자리까지</p>
        </div>
        <div className="flex w-28 shrink-0 flex-col gap-1.5">
          <span className="text-xs font-bold text-fg-dim">달성 표시</span>
          <div aria-live="polite" className="flex h-[54px] items-center justify-center rounded-xl border border-line bg-card">
            {stage ? <StageBadge stage={stage} /> : <span className="text-fg-faint">–</span>}
          </div>
          <p className="text-[11px] text-fg-faint">자동 계산</p>
        </div>
      </div>
      {errors.achievementRate ? (
        <p id="achievementRate-error" role="alert" className="-mt-2 text-sm text-fg">
          {errors.achievementRate.message}
        </p>
      ) : null}

      {chart.tier !== undefined && chart.tier !== null ? (
        <div aria-live="polite" className="flex items-baseline justify-between rounded-xl border border-line bg-card px-3.5 py-2.5">
          <span className="text-xs font-bold text-fg-dim">
            예상 점수 <span className="font-normal">· 레이팅 상수 난이도 {formatTier(chart.tier)}</span>
          </span>
          {preview !== null ? (
            <span {...chartTierAttrs(preview)} className="tier-score font-num text-2xl font-extrabold">
              {formatScore(preview)}
            </span>
          ) : (
            <span className="text-fg-faint">–</span>
          )}
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <label className="flex h-[46px] items-center justify-between rounded-xl border border-line bg-card px-3.5 text-sm font-bold text-fg">
          풀콤보(0 miss)
          <input
            type="checkbox"
            checked={fullCombo}
            disabled={maxRate}
            className="h-5 w-5"
            {...register("fullCombo")}
          />
        </label>
        {maxRate ? <p className="text-xs text-fg-dim">달성률 100.00이면 풀콤보로 저장됩니다.</p> : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="playedDate" className="text-sm text-fg-sub">
          플레이 날짜
        </label>
        <input
          id="playedDate"
          type="date"
          max={todaySeoul()}
          aria-invalid={errors.playedDate ? true : undefined}
          className="w-44 rounded-[10px] border border-line bg-card px-3 py-2 font-num text-fg"
          {...register("playedDate")}
        />
        {errors.playedDate ? (
          <p role="alert" className="text-sm text-fg">
            {errors.playedDate.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="memo" className="text-sm text-fg-sub">
          메모 (선택)
        </label>
        <textarea
          id="memo"
          rows={2}
          className="rounded-[10px] border border-line bg-card px-3 py-2 text-fg"
          {...register("memo")}
        />
        {errors.memo ? (
          <p role="alert" className="text-sm text-fg">
            {errors.memo.message}
          </p>
        ) : null}
      </div>

      <p className="text-xs text-fg-dim">기록은 SRN+ 옵션으로 저장됩니다. 기록은 본인만 등록·수정·삭제할 수 있습니다.</p>

      {serverMessage ? (
        <p role="alert" className="text-sm text-fg">
          {serverMessage}
        </p>
      ) : null}

      {record ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-row-line pt-3">
          {confirmingDelete ? (
            <>
              <span className="text-sm text-fg">이 기록을 삭제할까요? 되돌릴 수 없습니다.</span>
              <button
                type="button"
                onClick={() => removal.mutate()}
                disabled={removal.isPending}
                className="rounded-full border border-danger px-3 py-1 text-sm font-semibold text-danger disabled:opacity-60"
              >
                {removal.isPending ? "삭제 중" : "삭제"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="rounded-full border border-chip-line px-3 py-1 text-sm text-fg-sub hover:text-fg"
              >
                취소
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmingDelete(true)} className="text-sm text-danger underline">
              이 기록 삭제
            </button>
          )}
        </div>
      ) : null}

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="h-12 w-24 rounded-xl border border-chip-line text-sm font-bold text-fg-sub hover:text-fg"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="h-12 flex-1 rounded-xl bg-chip-on-bg text-sm font-extrabold text-chip-on-fg disabled:opacity-60"
        >
          {mutation.isPending ? "저장 중" : "저장"}
        </button>
      </div>
    </form>
  );
}
