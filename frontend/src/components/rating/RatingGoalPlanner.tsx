"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ChartBadge } from "@/components/table/Badges";
import type { SkillResponse } from "@/lib/api-types";
import { formatRate, formatScore } from "@/lib/format";
import { goalFormSchema, goalPlan, type GoalFormValues } from "@/lib/rating-goal";

/** 경로가 길면(목표가 멀면 곡이 많다) 앞쪽만 보이고 나머지는 개수로 알린다 */
const VISIBLE_STEPS = 8;

const FIELD = "w-full rounded-[10px] border border-line bg-card px-3 py-2 text-fg";

/**
 * 목표 레이팅: 목표 합계를 직접 입력하면 "어떤 곡을 몇 %까지 올리면 닿는지" 경로를 보여 준다 (계산은 lib/rating-goal.ts).
 * 입력값은 저장하지 않는다(새로고침하면 비어 있다). 서열표·곡 마스터 같은 다른 요청도 보내지 않고, 이미 받은 내 레이팅 목록만 쓴다.
 * 처음에는 접혀 있다(레이팅 목록이 먼저 보이게). 입력하는 즉시 계산한다.
 */
export function RatingGoalPlanner({ skill }: { skill: SkillResponse }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  return (
    <section aria-label="목표 레이팅" className="rounded-2xl border border-line bg-card">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span>
          <span className="block text-[15px] font-bold text-fg">목표 레이팅</span>
          <span className="block text-xs text-fg-sub">목표 점수를 정하면 어떤 곡을 몇 %까지 올리면 되는지</span>
        </span>
        <span aria-hidden="true" className="text-fg-dim">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open ? (
        <div id={bodyId} className="border-t border-line px-4 py-3">
          <GoalBody skill={skill} />
        </div>
      ) : null}
    </section>
  );
}

function GoalBody({ skill }: { skill: SkillResponse }) {
  const inputId = useId();
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useForm<GoalFormValues>({ resolver: zodResolver(goalFormSchema), defaultValues: { target: "" }, mode: "onChange" });
  // watch 대신 useWatch: React Compiler 린트가 watch를 허용하지 않는다
  const raw = useWatch({ control, name: "target" });

  // 형식이 맞는 값만 계산한다. 비었거나 형식이 틀리면 결과 대신 위의 오류 문구가 보인다
  const parsed = goalFormSchema.safeParse({ target: raw });
  const plan = parsed.success ? goalPlan(skill, Number(parsed.data.target)) : null;
  const alreadyReached = parsed.success && plan === null;

  const nextMin = skill.tier.nextMinScore;
  const nextName = skill.tier.nextDisplayName;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-semibold text-fg">
          목표 점수
        </label>
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder={`지금 ${formatScore(skill.totalScore)}`}
          aria-invalid={errors.target ? true : undefined}
          className={FIELD}
          {...register("target")}
        />
        {errors.target ? (
          <p role="alert" className="text-xs text-fg">
            {errors.target.message}
          </p>
        ) : null}
        {nextMin !== null && nextName !== null ? (
          <div>
            <button
              type="button"
              onClick={() => setValue("target", String(nextMin), { shouldValidate: true })}
              className="min-h-10 rounded-full border border-line px-4 text-xs font-semibold text-fg-sub hover:text-fg"
            >
              {nextName} ({nextMin})로 정하기
            </button>
          </div>
        ) : null}
      </div>

      {alreadyReached ? (
        <p className="text-sm text-fg">이미 목표를 넘었습니다. 지금 레이팅은 {formatScore(skill.totalScore)}입니다.</p>
      ) : null}

      {plan ? (
        <div aria-live="polite" className="flex flex-col gap-2">
          <p className="text-sm text-fg">
            목표까지 <span className="font-num font-semibold">+{formatScore(plan.needed)}</span>
            {plan.reachable ? (
              <>
                , 곡 <span className="font-num font-semibold">{plan.steps.length}</span>개를 올리면 달성합니다.
              </>
            ) : (
              "."
            )}
          </p>
          {plan.reachable ? null : (
            <p role="alert" className="text-sm text-fg">
              목록 안의 곡을 모두 95%까지 올려도 <span className="font-num font-semibold">+{formatScore(plan.maxGain)}</span>만 늘어나서{" "}
              <span className="font-num font-semibold">{formatScore(plan.shortfall)}</span>점이 모자랍니다. 더 높은 난이도의 곡을 레이팅 목록에 넣어야 합니다.
            </p>
          )}
          {plan.steps.length > 0 ? (
            <ol aria-label="목표까지 올릴 곡" className="flex flex-col gap-2">
              {plan.steps.slice(0, VISIBLE_STEPS).map((step) => (
                <li key={step.entry.songDifficultyId} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-line px-3 py-2 text-xs text-fg-sub">
                  <Link
                    href={`/songs/${step.entry.songId}?from=table&chart=${step.entry.songDifficultyId}`}
                    className="text-[13px] font-semibold text-fg underline-offset-2 hover:underline"
                  >
                    {step.entry.title}
                  </Link>
                  <ChartBadge part={step.entry.part} difficulty={step.entry.difficulty} level={step.entry.level} />
                  <span className="font-num">
                    {formatRate(step.fromRate)}% → <span className="font-semibold text-fg">{formatRate(step.toRate)}%</span>
                  </span>
                  <span className="font-num text-fg">+{formatScore(step.gain)}</span>
                </li>
              ))}
            </ol>
          ) : null}
          {plan.steps.length > VISIBLE_STEPS ? (
            <p className="text-xs text-fg-dim">
              외 <span className="font-num">{plan.steps.length - VISIBLE_STEPS}</span>곡은 같은 방식으로 올리면 됩니다(여지가 큰 순서).
            </p>
          ) : null}
          <p className="text-xs leading-relaxed text-fg-dim">
            지금 레이팅 목록에 있는 곡만 계산합니다. 곡은 95%까지 올릴 수 있고(95%에서 점수가 최대), 목록 밖의 곡을 새로 넣는 경우는 반영하지 않습니다.
          </p>
        </div>
      ) : null}
    </div>
  );
}
