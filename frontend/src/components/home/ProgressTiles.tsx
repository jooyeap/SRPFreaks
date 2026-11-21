"use client";

import Link from "next/link";
import { useState } from "react";
import type { CSSProperties } from "react";
import { StageBar } from "@/components/table/StageBar";
import { chipsOf } from "@/components/table/TierGroupSection";
import type { ProgressGroup } from "@/lib/difficulty-table";
import { lowestFullStage, percentOf, tileTint, type FullStage } from "@/lib/progress";
import { useTranslations } from "next-intl";

// 머리글 칩 이름을 chipsOf와 같은 목록에서 얻기 위한 빈 개수
const EMPTY_COUNTS = { total: 0, exc: 0, fc: 0, ss: 0, sPlus: 0, s: 0, belowS: 0 };

/** 전체가 있고 기록이 모두 채워졌으면 완료. 완료한 칸은 막대 테두리와 이름 글자 색이 달라진다(`n/n` 숫자가 같이 보여 색만으로 구분하지 않는다). */
export function isDone(recorded: number, total: number): boolean {
  return total > 0 && recorded >= total;
}

/** 배경/테두리 색: 단계 SS 막대 색(--stage-ss-bar)에 진하기(퍼센트)만 섞는다. 색 값은 컴포넌트에 없고 테마 변수만 쓴다. */
function mix(percent: number): string {
  return `color-mix(in srgb, var(--stage-ss-bar) ${percent}%, transparent)`;
}

/**
 * 난이도 이름(숫자)에 입히는 단계 색 클래스(D85). EXC·FC는 그라데이션 글자(`stage-grad-text`), 나머지는 단색(`stage-text`, 단계마다 대비를 맞춘 색).
 * 색 값은 컴포넌트에 없고 data-stage → globals.css의 단계 변수만 쓴다.
 */
function nameColor(stage: FullStage | null, fallback: string): string {
  if (stage === null) {
    return fallback;
  }
  return stage === "EXC" || stage === "FC" ? "stage-grad-text" : "stage-text";
}

/** 숫자 아래 작은 글자: `S+↑`(전곡 S+ 이상). 시안 Home4처럼 EXC도 `EXC↑`다. 색만으로 전달하지 않으려고 항상 글자를 같이 쓴다. */
function FullStageMark({ stage, inline = false }: { stage: FullStage; inline?: boolean }) {
  const t = useTranslations("Progress");
  return (
    // inline: 모바일 표형 줄(시안 Home4 B안)은 `기록/전체` 바로 오른쪽에 8px 글자로 붙는다. 넓은 화면 카드는 숫자 아래 10px 한 줄
    <span data-stage={stage} data-full-stage={stage} className={`stage-text font-num font-bold leading-none ${inline ? "ml-[3px] text-[8px]" : "text-[10px]"}`}>
      <span className="sr-only">{stage === "EXC" ? t("allExc") : t("allAtLeast", { stage })} </span>
      <span aria-hidden="true">{stage}↑</span>
    </span>
  );
}

/** 모바일 표형 줄의 열 배치: 구간 · 달성 % · 단계 6칸(EXC FC SS S+ S S 미만). 머리글과 줄이 같은 값을 써서 열이 맞는다. */
const MOBILE_COLS = "grid grid-cols-[50px_36px_repeat(6,minmax(0,1fr))] items-center gap-0.5";

/**
 * 칸 지도: 묶음(서열표는 기준 난이도, 곡 목록은 레벨 폴더) 하나가 한 칸이다. 칸마다 기록 퍼센트, `기록/전체`,
 * 단계 비율 막대가 있고, 많이 채울수록 칸이 진해진다. 칸 전체가 링크라서 누르면 그 묶음으로 간다.
 * - sm(640px) 이상: 3열 카드. 칸 오른편에 개수 칩이 두 줄(EXC·FC·SS / S+·S·S 미만)로 보이고 막대는 칸 아래에 전체 폭으로 깔린다.
 * - 640px 미만(폰): **표형 1열**(2026-10-20 시안 A). 단계 이름은 맨 위 머리글에 한 번만 쓰고 줄마다 숫자만 둔다(0은 `-`).
 *   카드는 폭이 좁아 칩이 들어가지 않아서 바꿨다. 목록(ul)은 하나이고 한 줄(li) 안에 두 배치를 CSS로 번갈아 보인다
 *   (같은 목록을 두 번 그리면 링크와 접근성 이름이 겹친다). 숫자 앞에는 화면에 보이지 않는 단계 이름(sr-only)이 있고,
 *   색은 단계 글자(EXC·FC·SS·S+·S)와 함께 쓰여 색만으로 구분하지 않는다.
 */
export function ProgressTiles({
  groups,
  label,
  foldCount = 0,
}: {
  groups: readonly ProgressGroup[];
  label: string;
  /** 맨 위에서 접어 둘 구간 수(기록 없는 먼 높은 구간, emptyHighCount). 0이면 접지 않는다 */
  foldCount?: number;
}) {
  const t = useTranslations("Progress");
  const [unfolded, setUnfolded] = useState(false);
  const folded = foldCount > 0 && !unfolded;
  const shown = folded ? groups.slice(foldCount) : groups;
  return (
    <div className="flex flex-col gap-1 sm:gap-0">
      <div aria-hidden="true" className={`${MOBILE_COLS} border-b border-line px-0.5 pb-[3px] text-center text-[9px] font-bold text-fg-dim sm:hidden`}>
        <span className="text-left">{t("colRange")}</span>
        <span>{t("colAchieve")}</span>
        {chipsOf(EMPTY_COUNTS).map((chip) => (
          <span key={chip.key} data-stage={chip.stage ?? undefined} className={chip.stage ? "stage-text" : "text-fg-sub"}>
            {chip.stage ? chip.label : t("belowS")}
          </span>
        ))}
      </div>
      {foldCount > 0 ? (
        <button
          type="button"
          aria-expanded={!folded}
          onClick={() => setUnfolded((v) => !v)}
          className="mb-1 min-h-11 w-full rounded-lg border border-dashed border-ctl px-3 text-left text-[13px] text-fg-sub hover:bg-table-head sm:mb-2"
        >
          <span aria-hidden="true">{folded ? "▸ " : "▴ "}</span>
          {folded ? t("foldClosed", { from: groups[0].label, to: groups[foldCount - 1].label, count: foldCount }) : t("foldOpen")}
        </button>
      ) : null}
      <ul aria-label={label} className="grid grid-cols-1 sm:grid-cols-3 sm:gap-2">
        {shown.map((g, tileIndex) => {
          const done = isDone(g.recorded, g.total);
          const tint = tileTint(g.recorded, g.total);
          const chips = chipsOf(g);
          // 전곡 기록이 있고 S 이상일 때만 단계가 있다(아니면 null: 색·막대·글자 없음)
          const fullStage = lowestFullStage(g);
          // 넓은 화면 카드의 칩은 0이 아닌 단계만 보인다(0 칩이 다섯 개씩 붙어 화면이 복잡했다, 2026-10-27). 줄 나눔(EXC·FC·SS / 나머지)과 순서는 그대로다.
          // 모바일 표형 줄은 열이 고정이라 지금처럼 0을 "-"로 둔다.
          const chipRows = [chips.slice(0, 3), chips.slice(3)].map((row) => row.filter((chip) => chip.count > 0)).filter((row) => row.length > 0);
          return (
            <li key={g.key} data-done={done ? "true" : undefined} className="border-t border-line first:border-t-0 sm:border-0">
              <Link
                href={g.href}
                // 카드 색은 sm 이상에서만 입힌다(모바일 표형 줄은 배경 없이 구분선만)
                className={`relative flex h-full flex-col gap-1.5 rounded-lg hover:bg-table-head sm:rounded-[10px] sm:border ${g.recorded === 0 ? "sm:border-dashed" : ""} sm:p-2 sm:[background:var(--tile-bg)] sm:[border-color:var(--tile-line)] sm:hover:opacity-90 lg:p-3`}
                style={{ "--tile-bg": mix(tint.fill), "--tile-line": mix(tint.line) } as CSSProperties}
              >
                {/* 전곡 완료 난이도: 왼쪽 세로 막대(가장 낮은 단계 색, 시안 Home4 B안). 장식이라 aria-hidden이고 같은 정보가 숫자 아래 글자로 있다.
                    모바일 표형 줄에서는 카드 안쪽 여백(-8px)에 놓이고, 넓은 화면 카드에서는 카드 안 왼쪽 가장자리에 놓인다 */}
                {fullStage ? (
                  <span
                    aria-hidden="true"
                    data-stage={fullStage}
                    data-full-bar=""
                    className="stage-bar absolute -left-2 bottom-1 top-2 w-[3px] rounded-sm shadow-[0_0_8px_var(--st-text)] sm:inset-y-1.5 sm:left-px sm:shadow-none"
                  />
                ) : null}
                {/* 모바일 표형 줄(시안 Home4): 난이도(숫자·기록/전체·단계 글자) · 달성 % · 단계 6칸(값이 있으면 단계 색 둥근 칩, 없으면 `-`). 줄 아래에 단계 비율 누적 막대 */}
                <span className="sm:hidden">
                  <span className={`${MOBILE_COLS} px-0.5 pt-1.5 text-center`}>
                    <span className="min-w-0 text-left leading-tight">
                      <span
                        data-stage={fullStage ?? undefined}
                        className={`inline-block font-num text-base font-bold leading-[1.1] ${nameColor(fullStage, done ? "text-done-text" : "text-fg")}`}
                      >
                        {g.label}
                      </span>
                      <span className="block whitespace-nowrap font-num text-[9px] text-fg-dim">
                        {g.recorded}/{g.total}
                        {fullStage ? <FullStageMark stage={fullStage} inline /> : null}
                      </span>
                    </span>
                    <span className={`font-num text-[11px] font-bold ${g.recorded === 0 ? "text-fg-faint" : "text-fg"}`}>{percentOf(g.recorded, g.total)}%</span>
                    {chips.map((chip) => (
                      <span
                        key={chip.key}
                        // S 미만(chip.stage 없음)은 회색 계열 A 색을 쓴다(막대·도넛과 같다)
                        data-stage={chip.count === 0 ? undefined : (chip.stage ?? "A")}
                        style={chip.count === 0 ? undefined : { background: "color-mix(in srgb, var(--st-text) 16%, transparent)" }}
                        className={`rounded-[7px] py-1 font-num text-[13px] font-bold ${chip.count === 0 ? "text-fg-faint" : "stage-text"}`}
                      >
                        <span className="sr-only">{chip.stage ? chip.label : t("belowS")} </span>
                        {chip.count === 0 ? "-" : chip.count}
                      </span>
                    ))}
                  </span>
                  <span aria-hidden="true" className="mx-0.5 mb-1.5 mt-[5px] block">
                    <StageBar counts={g} total={g.total} className="h-1" motionKey={`tile:${label}:${g.key}:m`} motionIndex={tileIndex} />
                  </span>
                </span>

                {/* sm 이상 카드: 위줄은 왼쪽 이름·퍼센트·기록/전체, 오른편에 단계 칩 두 줄. 막대는 아래에 전체 폭 */}
                <span className="hidden items-center justify-between gap-2 sm:flex">
                  <span className="flex min-w-0 flex-col gap-1.5">
                    <span
                      data-stage={fullStage ?? undefined}
                      className={`truncate font-num text-xs font-semibold ${nameColor(fullStage, done ? "text-done-text" : "text-fg-sub")}`}
                    >
                      {g.label}
                    </span>
                    {/* 기록이 하나도 없는 칸은 0% 대신 한 줄 안내(칩은 없고 테두리는 점선) */}
                    {g.recorded === 0 ? (
                      <span className="text-[13px] leading-5 text-fg-dim">{t("tileEmpty")}</span>
                    ) : (
                      <span className="font-num text-xl font-bold leading-none text-fg">
                        {percentOf(g.recorded, g.total)}
                        <span className="text-[10px] font-medium text-fg-dim">%</span>
                      </span>
                    )}
                    <span className="font-num text-[11px] text-fg-dim">
                      {g.recorded}/{g.total}
                    </span>
                    {fullStage ? <FullStageMark stage={fullStage} /> : null}
                  </span>
                  <span className={`flex shrink-0 flex-col items-end gap-1 ${g.recorded === 0 ? "hidden" : ""}`}>
                    {chipRows.map((row, i) => (
                      <span key={i} className="flex gap-1">
                        {row.map((chip) => (
                          <span
                            key={chip.key}
                            data-stage={chip.stage ?? undefined}
                            className={`rounded-md border border-ctl px-1.5 py-px text-[11px] ${
                              chip.count === 0 ? "text-fg-faint" : chip.stage ? "stage-text" : "text-fg-sub"
                            }`}
                          >
                            {chip.stage ? chip.label : t("belowS")} <span className="font-num">{chip.count}</span>
                          </span>
                        ))}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="hidden sm:block">
                  <StageBar counts={g} total={g.total} className="h-1" done={done} motionKey={`tile:${label}:${g.key}:d`} motionIndex={tileIndex} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
