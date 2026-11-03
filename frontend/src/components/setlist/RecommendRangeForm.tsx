"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import { makeRecommendRangeSchema, resetRecommendRange, saveRecommendRange, setlistKeys, toRangeBody, type RecommendRangeValues } from "@/lib/setlist";
import { useTranslations } from "next-intl";

const FIELD = "w-full rounded-[10px] border border-line bg-card px-3 py-2 font-num text-fg";

/** 폼에 보이는 숫자 글자. 3.5 -> "3.5", -0.6 -> "-0.6" (입력하기 쉽게 일반 마이너스를 쓴다). */
const asText = (value: number) => String(Math.round(value * 100) / 100);

interface Current {
  ssMin: number;
  ssMax: number;
  sMin: number;
  sMax: number;
  customRange: boolean;
}

/**
 * 추천 범위 직접 설정. 값은 "내 평균 난이도 대비 차이"이고 음수는 더 쉬운 곡이다.
 * 저장하면 서버가 내 설정으로 보관해 다음 추천부터 쓰고, `기본값으로`는 내 설정을 지워 서버 기본 범위로 돌아간다.
 * 하위 ≤ 상위, −3.00~3.00, 소수 둘째 자리까지는 Zod(여기), Bean Validation(서버), DB CHECK 세 곳에서 모두 확인한다.
 */
export function RecommendRangeForm({ current, onDone }: { current: Current; onDone: () => void }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const toast = useToast();
  const schema = useMemo(() => makeRecommendRangeSchema(t), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RecommendRangeValues>({
    resolver: zodResolver(schema),
    defaultValues: { ssMin: asText(current.ssMin), ssMax: asText(current.ssMax), sMin: asText(current.sMin), sMax: asText(current.sMax) },
    mode: "onTouched",
  });

  const onError = (error: unknown) => toast(error instanceof ApiError ? error.message : t("Common.actionFailed"));
  const afterChange = async (message: string) => {
    toast(message);
    await queryClient.invalidateQueries({ queryKey: setlistKeys.all });
    onDone();
  };

  const save = useMutation({
    mutationFn: (values: RecommendRangeValues) => saveRecommendRange(toRangeBody(values)),
    onSuccess: () => afterChange(t("Setlist.rangeSaved")),
    onError,
  });
  const reset = useMutation({
    mutationFn: resetRecommendRange,
    onSuccess: () => afterChange(t("Setlist.rangeReset")),
    onError,
  });
  const busy = save.isPending || reset.isPending;

  return (
    <form onSubmit={handleSubmit((values) => save.mutate(values))} noValidate aria-label={t("Setlist.rangeAria")} className="flex flex-col gap-3 rounded-xl border border-line p-3">
      <p className="text-xs text-fg-sub">{t("Setlist.rangeLead")}</p>
      <RangeRow title={t("Setlist.ssBasis")} lowName="ssMin" highName="ssMax" register={register} errors={errors} />
      <RangeRow title={t("Setlist.sBasis")} lowName="sMin" highName="sMax" register={register} errors={errors} />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={busy || !current.customRange}
          onClick={() => reset.mutate()}
          className="flex min-h-9 items-center rounded-lg border border-ctl px-3 text-sm text-fg enabled:hover:bg-table-head disabled:text-disabled"
        >
          {t("Setlist.toDefault")}
        </button>
        <button type="submit" disabled={busy} className="flex min-h-9 items-center rounded-lg bg-chip-on-bg px-3 text-sm font-bold text-chip-on-fg disabled:opacity-60">
          {t("Setlist.save")}
        </button>
      </div>
    </form>
  );
}

type Register = ReturnType<typeof useForm<RecommendRangeValues>>["register"];
type Errors = ReturnType<typeof useForm<RecommendRangeValues>>["formState"]["errors"];

function RangeRow({ title, lowName, highName, register, errors }: { title: string; lowName: "ssMin" | "sMin"; highName: "ssMax" | "sMax"; register: Register; errors: Errors }) {
  const t = useTranslations();
  const messages = [errors[lowName]?.message, errors[highName]?.message].filter((m): m is string => Boolean(m));
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-xs font-bold text-fg-sub">{title}</legend>
      <div className="flex items-center gap-2">
        <input type="text" inputMode="decimal" autoComplete="off" aria-label={t("Setlist.lowAria", { title })} aria-invalid={errors[lowName] ? true : undefined} className={FIELD} {...register(lowName)} />
        <span aria-hidden="true" className="text-fg-dim">~</span>
        <input type="text" inputMode="decimal" autoComplete="off" aria-label={t("Setlist.highAria", { title })} aria-invalid={errors[highName] ? true : undefined} className={FIELD} {...register(highName)} />
      </div>
      {messages.map((m) => (
        <p key={m} role="alert" className="text-sm text-fg">
          {m}
        </p>
      ))}
    </fieldset>
  );
}
