"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { StageBar, type StageCounts } from "@/components/table/StageBar";
import { isDone } from "@/components/home/ProgressTiles";
import { folderHref } from "@/lib/difficulty-table";
import { lowestFullStage, type FullStage } from "@/lib/progress";
import { foldRange, layoutTiles, markIntroPlayed, wasIntroPlayed, type TileOrder } from "@/lib/table-tiles";
import { clearTableReturn, readTableReturn, rememberTableReturn } from "@/lib/table-view-state";
import { useMediaQuery } from "@/lib/use-media-query";
import { useTranslations } from "next-intl";

/** 타일 하나가 그리는 값: 기준 난이도, 내 기록 수/전체, 단계별 개수(모두 필터를 적용한 값). 단계 개수는 서열표 묶음 응답을 화면에서 다시 센 값이다(filterTierGroup). */
export interface TierTile extends StageCounts {
  tier: number;
  total: number;
  recorded: number;
}

/** 난이도 숫자의 단계 색 클래스. EXC·FC는 그라데이션 글자, 나머지는 단색(홈 ProgressTiles의 nameColor와 같은 규칙, 색 값은 data-stage → globals.css) */
function stageNumberClass(stage: FullStage): string {
  return stage === "EXC" || stage === "FC" ? "stage-grad-text" : "stage-text";
}

/**
 * 기록 수 옆의 작은 글자(`S↑`/`S+↑`/`SS↑`/`FC↑`, 전곡 EXC는 화살표 없이 `EXC`). 색만으로 전달하지 않으려고 항상 글자를 같이 쓰고,
 * 읽는 글자(sr-only)는 홈과 같은 문장(`모든 채보가 S+ 이상입니다.`)이다.
 */
function FullStageMark({ stage }: { stage: FullStage }) {
  const t = useTranslations("Progress");
  return (
    <span data-full-stage={stage} className={`font-bold ${stageNumberClass(stage)}`}>
      <span className="sr-only">{stage === "EXC" ? t("allExc") : t("allAtLeast", { stage })} </span>
      <span aria-hidden="true">{stage === "EXC" ? "EXC" : `${stage}↑`}</span>
    </span>
  );
}

/**
 * 서열표 첫 화면의 난이도 타일 격자(3열, 480px 이상 4열). 타일 하나가 난이도 하나이고 누르면 그 난이도 폴더(/table/folder/{tier})로 간다.
 * 컴팩트 타일(2026-11-21, D92, 시안 Tier35 C안): 가운데 난이도 숫자 · 아래 `기록/전체`(기록이 없으면 `기록 없음`) · 맨 아래 가장자리에 3px 단계 분포 막대(홈 StageBar와 같은 색).
 * - 진행 정도는 막대가 말한다(예전의 타일이 진해지는 색조는 없앴다). 기록이 0인 타일은 점선 윤곽 + 흐린 글자.
 * - 전곡 기록 타일(홈과 같은 isDone): 위쪽 가장자리 전폭 3px 선(가장 낮은 단계 색, 약한 빛 번짐) + 숫자가 단계 글자색 + 옅은 배경(--done-tint) + 기록 수 옆 `S↑`(EXC는 `EXC`).
 *   `n/n`과 단계 글자가 같이 있어 색만으로 구분하지 않고, 화면 읽기용 숨은 글자 `완료`도 붙는다.
 *   S 미만(A/B/C)이 섞여 단계를 못 정하면(lowestFullStage가 null) 선·글자 없이 숫자만 완료 색(--done-text)이다(홈과 같은 규칙).
 * - 평균 타일: 주황 윤곽(outline, 타일 높이를 다른 타일과 같게 두려고 border가 아니라 outline)과 숨은 글자 `내 평균 난이도`. 이 탭에서 처음 들어올 때만 1.1초 빛남 ×3회 하고(globals.css tile-glow),
 *   화면 밖이면 그 위치로 스크롤한다. 폴더에 갔다 돌아오면 다시 하지 않는다(lib/table-tiles.ts의 첫 진입 기억). 움직임 줄이기 설정이면 빛남 없이 윤곽만.
 * - 평균 근처 3칸을 뺀 먼 쪽 타일은 한 줄로 접는다(눌러서 그 자리에서 펼침).
 * - 타일을 누르면 보던 스크롤 위치·접힘 상태·보기 상태 쿼리를 기억해 두고(rememberTableReturn), 폴더의 `←`로 돌아와 이 격자가 다시 그려질 때 되살린다.
 *   되살릴 때는 첫 진입 연출(빛남·자동 스크롤)을 하지 않는다.
 */
export function TierTileGrid({
  tiles,
  average,
  order,
  label,
  returnQuery = "",
}: {
  tiles: readonly TierTile[];
  average: number | null;
  order: TileOrder;
  label: string;
  /** 지금 서열표의 보기 상태 쿼리(viewStateToQuery). 폴더로 갈 때 기억해 `←`와 폴더 시작 필터에 쓴다 */
  returnQuery?: string;
}) {
  const t = useTranslations("Table");
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  // 폴더에서 돌아온 경우의 기억. 처음 그릴 때 한 번만 읽고, 되살린 뒤 effect에서 지운다(필터를 바꿔 격자가 다시 만들어질 때 옛 기억을 쓰지 않게)
  const [restored] = useState(() => readTableReturn());
  const [unfolded, setUnfolded] = useState(restored?.unfolded ?? false);
  const layout = layoutTiles(tiles, average, order);
  const { ordered, folded, averageTier } = layout;
  const hidden = folded.length > 0 && !unfolded ? new Set(folded) : null;

  // 첫 진입 연출 여부는 처음 그릴 때 한 번만 정한다(그린 뒤 기억을 남겨도 이번 화면의 연출은 끝까지 간다)
  const [intro] = useState(() => averageTier !== null && !restored && !wasIntroPlayed());
  const averageRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (restored) {
      window.scrollTo({ top: restored.scrollY, behavior: "instant" }); // 부드럽게 굴러가지 않고 보던 자리로 바로
      clearTableReturn();
      return;
    }
    if (!intro) return;
    markIntroPlayed();
    const el = averageRef.current;
    if (!el || typeof el.scrollIntoView !== "function") return;
    const rect = el.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      el.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    }
    // 연출은 화면에 처음 들어올 때 한 번뿐이다. reduced가 나중에 바뀌어도 다시 스크롤하지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const range = folded.length > 0 ? foldRange(folded) : null;
  const foldText = range
    ? t(order === "hard" ? "tilesFoldHigher" : "tilesFoldLower", { count: folded.length, from: range.from, to: range.to })
    : "";
  return (
    <ul aria-label={label} className="grid grid-cols-3 gap-2 min-[480px]:grid-cols-4">
      {range ? (
        <li className="col-span-full">
          <button
            type="button"
            aria-expanded={unfolded}
            onClick={() => setUnfolded((v) => !v)}
            className="break-keep min-h-11 w-full rounded-lg border border-dashed border-ctl px-3 text-left text-[13px] text-fg-sub hover:bg-table-head"
          >
            <span aria-hidden="true">{unfolded ? "▴ " : "▸ "}</span>
            {unfolded ? t("tilesFoldClose") : foldText}
          </button>
        </li>
      ) : null}
      {ordered.map((tile) => {
        if (hidden?.has(tile)) return null;
        const done = isDone(tile.recorded, tile.total);
        const isAverage = tile.tier === averageTier;
        // 전곡 기록이 있고 S 이상일 때만 단계가 있다(아니면 null: 선·글자 없음)
        const fullStage = lowestFullStage({ ...tile });
        const numberColor = fullStage
          ? stageNumberClass(fullStage)
          : done
            ? "text-done-text"
            : tile.recorded === 0
              ? "text-fg-dim"
              : "text-fg";
        return (
          <li key={tile.tier} data-done={done ? "true" : undefined}>
            <Link
              ref={isAverage ? averageRef : undefined}
              href={folderHref(tile.tier)}
              onClick={() => rememberTableReturn({ query: returnQuery, scrollY: window.scrollY, unfolded })}
              data-average={isAverage ? "true" : undefined}
              // data-stage는 이 타일 안의 --st-bar/--st-text를 정한다(위쪽 선·숫자·`S↑` 글자). relative·overflow-hidden: 위쪽 선과 아래 막대를 둥근 모서리 안에 가둔다.
              // 평균 타일은 주황 outline(border를 키우면 높이가 달라진다). 빛남 막(::after)이 position 기준이 되도록 relative
              data-stage={fullStage ?? undefined}
              className={`relative flex flex-col overflow-hidden rounded-xl border px-1 pt-2 hover:opacity-90 ${
                done ? "[background:linear-gradient(180deg,var(--done-tint),transparent_80%),var(--card)]" : "bg-card"
              } ${tile.recorded === 0 ? "border-dashed border-line" : "border-line"} ${
                isAverage ? `outline outline-2 -outline-offset-1 outline-weak ${intro && !reduced ? "tile-glow" : ""}` : ""
              }`}
            >
              {fullStage ? (
                <span
                  aria-hidden="true"
                  data-stage={fullStage}
                  data-full-line=""
                  className="stage-bar absolute inset-x-0 top-0 h-[3px] shadow-[0_1px_8px_var(--st-text)]"
                />
              ) : null}
              <span className={`text-center font-num text-lg font-bold leading-none ${numberColor}`}>{tile.tier.toFixed(1)}</span>
              {/* 숫자 사이의 공백: 화면 배치에는 영향이 없고, 읽기 프로그램·접근성 이름이 `5.8 4/10`으로 나뉘어 읽히게 한다 */}
              {" "}
              <span className="mt-0.5 flex items-baseline justify-center gap-1 font-num text-[10px] leading-3">
                {tile.recorded === 0 ? (
                  <span className="text-fg-dim">{t("tilesNoRecord")}</span>
                ) : (
                  <span className="text-fg-sub">
                    {tile.recorded}/{tile.total}
                  </span>
                )}
                {fullStage ? <FullStageMark stage={fullStage} /> : null}
              </span>
              {done ? <span className="sr-only">{" "}{t("tilesDone")}</span> : null}
              {isAverage ? <span className="sr-only">{" "}{t("tilesMyAverage")}</span> : null}
              {/* 단계 분포 막대: 타일 아래 가장자리에 좌우 끝까지(-mx-1 = 타일 안쪽 여백만큼). 기록 없는 부분은 바탕색 */}
              <span aria-hidden="true" className="-mx-1 mt-1.5 block">
                <StageBar counts={tile} total={tile.total} className="h-[3px]" />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
