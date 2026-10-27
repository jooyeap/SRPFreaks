import Link from "next/link";
import type { CSSProperties } from "react";
import { StageBar } from "@/components/table/StageBar";
import { chipsOf } from "@/components/table/TierGroupSection";
import type { ProgressGroup } from "@/lib/difficulty-table";
import { percentOf, tileTint } from "@/lib/progress";
import { useTranslations } from "next-intl";

// 머리글 칩 이름을 chipsOf와 같은 목록에서 얻기 위한 빈 개수
const EMPTY_COUNTS = { total: 0, exc: 0, fc: 0, ss: 0, s: 0, belowS: 0 };

/** 전체가 있고 기록이 모두 채워졌으면 완료. 완료한 칸은 막대 테두리와 이름 글자 색이 달라진다(`n/n` 숫자가 같이 보여 색만으로 구분하지 않는다). */
function isDone(recorded: number, total: number): boolean {
  return total > 0 && recorded >= total;
}

/** 배경/테두리 색: 단계 SS 막대 색(--stage-ss-bar)에 진하기(퍼센트)만 섞는다. 색 값은 컴포넌트에 없고 테마 변수만 쓴다. */
function mix(percent: number): string {
  return `color-mix(in srgb, var(--stage-ss-bar) ${percent}%, transparent)`;
}

/** 모바일 표형 줄의 열 배치: 구간 · 달성 % · 단계 5칸(EXC FC SS S S 미만). 머리글과 줄이 같은 값을 써서 열이 맞는다. */
const MOBILE_COLS = "grid grid-cols-[4rem_2.5rem_repeat(5,minmax(0,1fr))] items-center";

/**
 * 칸 지도: 묶음(서열표는 기준 난이도, 곡 목록은 레벨 폴더) 하나가 한 칸이다. 칸마다 기록 퍼센트, `기록/전체`,
 * 단계 비율 막대가 있고, 많이 채울수록 칸이 진해진다. 칸 전체가 링크라서 누르면 그 묶음으로 간다.
 * - sm(640px) 이상: 3열 카드. 칸 오른편에 개수 칩이 두 줄(EXC·FC / SS·S·S 미만)로 보이고 막대는 칸 아래에 전체 폭으로 깔린다.
 * - 640px 미만(폰): **표형 1열**(2026-10-20 시안 A). 단계 이름은 맨 위 머리글에 한 번만 쓰고 줄마다 숫자만 둔다(0은 `-`).
 *   카드는 폭이 좁아 칩이 들어가지 않아서 바꿨다. 목록(ul)은 하나이고 한 줄(li) 안에 두 배치를 CSS로 번갈아 보인다
 *   (같은 목록을 두 번 그리면 링크와 접근성 이름이 겹친다). 숫자 앞에는 화면에 보이지 않는 단계 이름(sr-only)이 있고,
 *   색은 단계 글자(EXC·FC·SS·S)와 함께 쓰여 색만으로 구분하지 않는다.
 */
export function ProgressTiles({ groups, label }: { groups: readonly ProgressGroup[]; label: string }) {
  const t = useTranslations("Progress");
  return (
    <div className="flex flex-col gap-1 sm:gap-0">
      <div aria-hidden="true" className={`${MOBILE_COLS} border-b border-line px-1 pb-1.5 text-center text-[10px] font-bold text-fg-dim sm:hidden`}>
        <span className="text-left">{t("colRange")}</span>
        <span>{t("colAchieve")}</span>
        {chipsOf(EMPTY_COUNTS).map((chip) => (
          <span key={chip.key} data-stage={chip.stage ?? undefined} className={chip.stage ? "stage-text" : "text-fg-sub"}>
            {chip.stage ? chip.label : t("belowS")}
          </span>
        ))}
      </div>
      <ul aria-label={label} className="grid grid-cols-1 sm:grid-cols-3 sm:gap-2">
        {groups.map((g) => {
          const done = isDone(g.recorded, g.total);
          const tint = tileTint(g.recorded, g.total);
          const chips = chipsOf(g);
          // 넓은 화면 카드의 칩은 0이 아닌 단계만 보인다(0 칩이 다섯 개씩 붙어 화면이 복잡했다, 2026-10-27). 줄 나눔(EXC·FC / 나머지)과 순서는 그대로다.
          // 모바일 표형 줄은 열이 고정이라 지금처럼 0을 "-"로 둔다.
          const chipRows = [chips.slice(0, 2), chips.slice(2)].map((row) => row.filter((chip) => chip.count > 0)).filter((row) => row.length > 0);
          return (
            <li key={g.key} data-done={done ? "true" : undefined} className="border-t border-line first:border-t-0 sm:border-0">
              <Link
                href={g.href}
                // 카드 색은 sm 이상에서만 입힌다(모바일 표형 줄은 배경 없이 구분선만)
                className={`relative flex h-full flex-col gap-1.5 rounded-lg hover:bg-table-head sm:rounded-[10px] sm:border ${g.recorded === 0 ? "sm:border-dashed" : ""} sm:p-2 sm:[background:var(--tile-bg)] sm:[border-color:var(--tile-line)] sm:hover:opacity-90 lg:p-3`}
                style={{ "--tile-bg": mix(tint.fill), "--tile-line": mix(tint.line) } as CSSProperties}
              >
                {/* 모바일 표형 줄: 구간(이름·기록/전체) · 달성 % · 단계별 개수. 줄 아래에 얇은 단계 비율 막대 */}
                <span className={`${MOBILE_COLS} min-h-11 px-1 pb-1 sm:hidden`}>
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className={`truncate font-num text-[13px] font-bold ${done ? "text-done-text" : "text-fg"}`}>{g.label}</span>
                    <span className="font-num text-[10px] text-fg-dim">
                      {g.recorded}/{g.total}
                    </span>
                  </span>
                  <span className={`text-center font-num text-xs font-bold ${g.recorded === 0 ? "text-fg-faint" : "text-fg"}`}>
                    {percentOf(g.recorded, g.total)}%
                  </span>
                  {chips.map((chip) => (
                    <span
                      key={chip.key}
                      data-stage={chip.stage ?? undefined}
                      className={`text-center font-num text-[13px] font-bold ${chip.count === 0 ? "text-fg-faint" : chip.stage ? "stage-text" : "text-fg-sub"}`}
                    >
                      <span className="sr-only">{chip.stage ? chip.label : t("belowS")} </span>
                      {chip.count === 0 ? "-" : chip.count}
                    </span>
                  ))}
                  <span aria-hidden="true" className="absolute inset-x-1 bottom-0.5">
                    <StageBar counts={g} total={g.total} className="h-[3px]" done={done} />
                  </span>
                </span>

                {/* sm 이상 카드: 위줄은 왼쪽 이름·퍼센트·기록/전체, 오른편에 단계 칩 두 줄. 막대는 아래에 전체 폭 */}
                <span className="hidden items-center justify-between gap-2 sm:flex">
                  <span className="flex min-w-0 flex-col gap-1.5">
                    <span className={`truncate font-num text-xs font-semibold ${done ? "text-done-text" : "text-fg-sub"}`}>{g.label}</span>
                    <span className="font-num text-xl font-bold leading-none text-fg">
                      {percentOf(g.recorded, g.total)}
                      <span className="text-[10px] font-medium text-fg-dim">%</span>
                    </span>
                    <span className="font-num text-[11px] text-fg-dim">
                      {g.recorded}/{g.total}
                    </span>
                  </span>
                  {/* 기록이 하나도 없는 칸은 칩 대신 한 줄 안내(테두리도 점선) */}
                  {g.recorded === 0 ? <span className="shrink-0 self-start text-[11px] text-fg-dim">{t("tileEmpty")}</span> : null}
                  <span className={`flex shrink-0 flex-col items-end gap-1 ${g.recorded === 0 ? "hidden" : ""}`}>
                    {chipRows.map((row, i) => (
                      <span key={i} className="flex gap-1">
                        {row.map((chip) => (
                          <span
                            key={chip.key}
                            data-stage={chip.stage ?? undefined}
                            className={`rounded-md border border-chip-line px-1.5 py-px text-[11px] ${
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
                  <StageBar counts={g} total={g.total} className="h-1" done={done} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
