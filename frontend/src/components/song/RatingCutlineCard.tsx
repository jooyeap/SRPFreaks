"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ErrorRetry } from "@/components/ErrorRetry";
import { ChartBadge } from "@/components/table/Badges";
import { formatScore, rateFromInput } from "@/lib/format";
import {
  achievementFromInput,
  fetchRatingSimulation,
  gapWithUnit,
  initialInput,
  makeSimulationSchema,
  QUICK_RATES,
  rateWithUnit,
  simulationKeys,
  type RatingSimulationResponse,
  type SimulationFormValues,
  type SimulationGroup,
  type SimulationNotRatedReason,
} from "@/lib/rating-simulation";
import { formatScoreDiff } from "@/lib/rivals";

/** 입력을 멈추고 이 시간(ms)이 지나야 서버에 묻는다. 한 글자마다 요청이 나가지 않게 한다. */
const DEBOUNCE_MS = 400;

/**
 * 곡 상세의 `컷라인 · 목표 달성률` 카드 (D71). 내 기록 카드 아래에 둔다. 로그인한 사용자만 그린다(호출하는 쪽에서 거른다).
 *
 * 숫자(컷라인, 필요 달성률, 순위, 총점 변화)는 모두 서버(GET /skills/me/simulate)가 계산한 값이고, 여기서는 수식을 쓰지 않는다.
 * 네 가지 상태: 이미 목록 안 / 목록 밖 / 기록 없음 / 레이팅 대상 아님(카드를 숨기고 안내 한 줄만 보인다).
 *
 * - 불러오는 중에는 아무것도 그리지 않는다: 틀을 먼저 그리면 레이팅 대상이 아닐 때 카드가 나타났다 사라지며 화면이 흔들린다(PeerStatsCard와 같은 이유).
 * - 시뮬레이션 입력은 기록 입력과 같은 방식이다: 소수점 없는 정수(9650 = 96.50%).
 */
export function RatingCutlineCard({ chartId, userId }: { chartId: number; userId: number }) {
  const t = useTranslations("Cutline");
  const query = useQuery({
    queryKey: simulationKeys.chart(userId, chartId, null),
    queryFn: ({ signal }) => fetchRatingSimulation(chartId, null, signal),
    staleTime: 60_000,
  });

  if (query.isPending) {
    return null;
  }
  if (query.isError) {
    return (
      <section aria-label={t("title")} className="flex flex-col gap-2.5 rounded-lg border border-line bg-card p-4">
        <h2 className="text-sm font-semibold text-fg-sub">{t("title")}</h2>
        <ErrorRetry onRetry={() => void query.refetch()} retrying={query.isFetching}>
          {t("loadFailed")}
        </ErrorRetry>
      </section>
    );
  }

  const data = query.data;
  if (data.status === "NOT_RATED") {
    // 카드는 숨기고 이유만 한 줄로 알린다
    return <p className="px-1 text-xs text-fg-dim">{t(notRatedKey(data.notRatedReason))}</p>;
  }

  return (
    <section aria-label={t("title")} className="flex flex-col gap-3 rounded-lg border border-line bg-card p-4">
      <h2 className="text-sm font-semibold text-fg-sub">{t("title")}</h2>
      <CutlineSummary data={data} />
      {/* key: 채보가 바뀌면(좌우 이동) 입력칸 값도 새로 시작한다 */}
      <SimulationForm key={chartId} chartId={chartId} userId={userId} cutline={data} />
    </section>
  );
}

function notRatedKey(reason: SimulationNotRatedReason | null): "notRatedTierUndecided" | "notRatedExcluded" {
  return reason === "TIER_UNDECIDED" ? "notRatedTierUndecided" : "notRatedExcluded";
}

/** 그룹 이름(단일 / 그 외). 라이벌 화면과 같은 번역을 쓴다. */
function useGroupLabel() {
  const t = useTranslations("Rival");
  return (group: SimulationGroup | null) => (group === "SINGLE" ? t("groupSingle") : t("groupOther"));
}

function CutlineSummary({ data }: { data: RatingSimulationResponse }) {
  const t = useTranslations("Cutline");
  const groupLabel = useGroupLabel();
  const cutline = data.cutline;
  const required = cutline?.requiredRate ?? null;
  const gap = cutline?.rateGap ?? null;

  return (
    <div className="flex flex-col gap-1.5">
      <dl className="flex flex-col gap-1.5 text-[13px]">
        <Row label={t("group")} value={`${groupLabel(data.group)} · ${t("groupCount", { size: data.groupSize, limit: data.groupLimit })}`} />
        <Row
          label={t("lastScore")}
          value={cutline?.lastScore != null ? formatScore(cutline.lastScore) : t("groupNotFull")}
        />
        <Row
          label={t("current")}
          value={
            data.currentRate === null
              ? t("noRecord")
              : `${rateWithUnit(data.currentRate)} · ${formatScore(data.currentScore)} · ${
                  data.currentRank === null ? t("outOfList") : t("rankInList", { rank: data.currentRank })
                }`
          }
        />
      </dl>

      {/* 필요 달성률 한 줄: 글자로 말하므로 색에 기대지 않는다. (진행 막대는 항상 거의 가득 차 뜻을 알 수 없다는 피드백으로 삭제했다) */}
      <p className="text-sm font-semibold text-fg">
        {cutline === null || required === null
          ? t("unreachable")
          : data.status === "IN_LIST"
            ? t("margin", { rate: rateWithUnit(required), margin: `${Math.abs(gap ?? 0).toFixed(2)}%` })
            : data.status === "OUT_OF_LIST" && gap !== null
              ? t("requiredOut", { rate: rateWithUnit(required), gap: gapWithUnit(gap) })
              : !cutline.groupFull
                ? t("freeSlot")
                : t("requiredNo", { rate: rateWithUnit(required) })}
      </p>
    </div>
  );
}

function SimulationForm({
  chartId,
  userId,
  cutline,
}: {
  chartId: number;
  userId: number;
  cutline: RatingSimulationResponse;
}) {
  const tAll = useTranslations();
  const t = useTranslations("Cutline");
  const groupLabel = useGroupLabel();
  const schema = useMemo(() => makeSimulationSchema(tAll), [tAll]);
  const initial = initialInput(cutline);

  const {
    register,
    setValue,
    control,
    formState: { errors },
  } = useForm<SimulationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { achievementRate: initial },
    mode: "onChange",
  });
  const rate = useWatch({ control, name: "achievementRate" });
  const rateField = register("achievementRate");

  // 입력을 멈춘 뒤에만 서버에 묻는다. 칩을 누르면 기다리지 않고 바로 묻는다.
  const [settled, setSettled] = useState(initial);
  useEffect(() => {
    const id = setTimeout(() => setSettled(rate), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [rate]);

  const achievement = achievementFromInput(settled);
  const hundredths = achievement === null ? null : Math.round(achievement * 100);
  const sim = useQuery({
    queryKey: simulationKeys.chart(userId, chartId, hundredths),
    queryFn: ({ signal }) => fetchRatingSimulation(chartId, achievement, signal),
    enabled: achievement !== null,
    staleTime: 60_000,
    placeholderData: keepPreviousData, // 값을 바꾸는 동안 이전 결과를 두어 화면이 깜빡이지 않게 한다
  });

  const typed = rateFromInput(rate);
  const result = achievement === null ? null : (sim.data?.simulation ?? null);
  const change = result ? formatScoreDiff(result.totalChange) : null;

  return (
    <div className="flex flex-col gap-2.5 border-t border-line pt-3">
      <h3 className="text-[13px] font-bold text-fg">{t("simTitle")}</h3>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`target-rate-${chartId}`} className="text-xs text-fg-dim">
          {t("targetLabel")}
        </label>
        <div className="flex items-center gap-2">
          <input
            id={`target-rate-${chartId}`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={errors.achievementRate ? true : undefined}
            aria-describedby={errors.achievementRate ? `target-rate-error-${chartId}` : undefined}
            placeholder="0 ~ 10000"
            className="h-11 w-32 rounded-lg border border-ctl bg-card px-3 font-num text-base text-fg placeholder:text-fg-faint"
            {...rateField}
            // 숫자 이외의 글자(소수점 포함)는 칸에 들어가지 못하게 지우고 5자리(10000)까지만 받는다(기록 입력 칸과 같은 방식)
            onChange={(event) => {
              event.target.value = event.target.value.replace(/\D/g, "").slice(0, 5);
              return rateField.onChange(event);
            }}
          />
          {typed !== null ? <span className="font-num text-sm text-fg-sub">= {rateWithUnit(typed)}</span> : null}
        </div>
        <p className="text-[11px] text-fg-faint">{tAll("Record.rateHint")}</p>
        {errors.achievementRate ? (
          <p id={`target-rate-error-${chartId}`} role="alert" className="text-xs text-fg">
            {errors.achievementRate.message}
          </p>
        ) : null}
      </div>

      <div role="group" aria-label={t("quickAria")} className="flex flex-wrap gap-2">
        {QUICK_RATES.map((chip) => (
          <button
            key={chip.input}
            type="button"
            aria-pressed={rate === chip.input}
            onClick={() => {
              setValue("achievementRate", chip.input, { shouldValidate: true, shouldDirty: true });
              setSettled(chip.input);
            }}
            className={`min-h-11 min-w-14 rounded-lg border px-3 font-num text-sm font-bold ${
              rate === chip.input ? "border-transparent bg-chip-on-bg text-chip-on-fg" : "border-ctl text-fg-sub"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="flex flex-col gap-1.5 text-[13px]">
        {achievement !== null && sim.isError ? (
          <ErrorRetry onRetry={() => void sim.refetch()} retrying={sim.isFetching}>
            {t("simFailed")}
          </ErrorRetry>
        ) : result && sim.data ? (
          <>
            <p className="text-sm font-semibold text-fg">
              {result.entered && result.rank !== null
                ? cutline.status === "IN_LIST"
                  ? t("rankAt", { group: groupLabel(sim.data.group), rank: result.rank })
                  : t("enteredAt", { group: groupLabel(sim.data.group), rank: result.rank })
                : t("notEntered")}
            </p>
            {result.belowBest ? <p className="text-xs text-fg-dim">{t("belowBest")}</p> : null}
            <dl className="flex flex-col gap-1.5">
              <Row
                label={t("totalChange")}
                value={`${change?.text ?? "–"} (${formatScore(result.totalBefore)} → ${formatScore(result.totalAfter)})`}
                emphasize
              />
              {result.pushedOut ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="shrink-0 text-xs text-fg-dim">{t("pushedOut")}</dt>
                  <dd className="flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1 text-right">
                    <span className="min-w-0 break-words font-bold text-fg">{result.pushedOut.title}</span>
                    <ChartBadge part={result.pushedOut.part} difficulty={result.pushedOut.difficulty} level={result.pushedOut.level} />
                    <span className="font-num text-fg-sub">{formatScore(result.pushedOut.score)}</span>
                  </dd>
                </div>
              ) : null}
            </dl>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs text-fg-dim">{label}</dt>
      <dd className={`min-w-0 break-words text-right font-num font-bold ${emphasize ? "text-done-text" : "text-fg"}`}>{value}</dd>
    </div>
  );
}
