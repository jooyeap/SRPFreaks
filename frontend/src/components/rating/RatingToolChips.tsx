"use client";

import { useId, useState } from "react";
import { RatingCardButton } from "@/components/rating/RatingCardDialog";
import { GoalBody } from "@/components/rating/RatingGoalPlanner";
import { PlannerBody } from "@/components/rating/RatingTargetPlanner";
import type { SkillResponse } from "@/lib/api-types";
import { useTranslations } from "next-intl";

type Tool = "goal" | "target";

const CHIP = "min-h-11 min-w-0 flex-1 break-keep rounded-xl border px-2 text-[13px] font-bold leading-tight";
const CHIP_OFF = "border-ctl text-fg-sub hover:text-fg";
// 펼쳐진 칩: 배경만이 아니라 ▴ 글자(aria-expanded)로도 알 수 있다
const CHIP_ON = "border-chip-on-bg bg-chip-on-bg text-chip-on-fg";

/**
 * 마이페이지 레이팅 탭의 도구 칩 한 줄 (2026-11-13, DESIGN-UI 5장). 예전에는 `목표 레이팅 추산`, `레이팅 예상 값`, `카드 이미지 저장`이
 * 카드·버튼으로 따로 쌓여 첫 화면을 차지했다. 이제 칩 세 개가 한 줄에 있다.
 *  - 앞의 두 칩은 누르면 칩 줄 아래에 기존 펼침 내용(GoalBody / PlannerBody)이 열린다. 한 번에 하나만 열린다(다른 칩을 누르면 바뀌고, 같은 칩을 다시 누르면 닫힌다).
 *  - `카드 이미지 저장`은 기존 대화상자를 연다(RatingCardButton). 기록이 하나도 없으면 이 칩은 없다.
 * 펼침 상태는 저장하지 않는다(새로고침하면 닫혀 있다). 펼침 안의 계산·내용은 그대로이고, 열렸을 때만 그려서 서열표 요청도 이때 처음 보낸다.
 */
export function RatingToolChips({ userId, skill }: { userId: number; skill: SkillResponse }) {
  const t = useTranslations();
  const [open, setOpen] = useState<Tool | null>(null);
  const goalId = useId();
  const targetId = useId();

  const toggle = (tool: Tool) => setOpen((cur) => (cur === tool ? null : tool));
  const chip = (tool: Tool, id: string, label: string) => (
    <button
      type="button"
      aria-expanded={open === tool}
      aria-controls={id}
      onClick={() => toggle(tool)}
      className={`${CHIP} ${open === tool ? CHIP_ON : CHIP_OFF}`}
    >
      {label} <span aria-hidden="true">{open === tool ? "▴" : "▾"}</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-stretch gap-2">
        {chip("goal", goalId, t("Rating.goalRating"))}
        {chip("target", targetId, t("Rating.targetAria"))}
        <RatingCardButton skill={skill} className={`${CHIP} ${CHIP_OFF}`} />
      </div>
      {open === "goal" ? (
        <section id={goalId} aria-label={t("Rating.goalRating")} className="rounded-2xl border border-line bg-card px-4 py-3">
          <GoalBody userId={userId} skill={skill} />
        </section>
      ) : null}
      {open === "target" ? (
        <section id={targetId} aria-label={t("Rating.targetAria")} className="rounded-2xl border border-line bg-card px-4 py-3">
          <PlannerBody userId={userId} skill={skill} />
        </section>
      ) : null}
    </div>
  );
}
