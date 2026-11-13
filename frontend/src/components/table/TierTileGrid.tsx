"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { folderHref } from "@/lib/difficulty-table";
import { tileTint } from "@/lib/progress";
import { foldRange, layoutTiles, markIntroPlayed, wasIntroPlayed, type TileOrder } from "@/lib/table-tiles";
import { clearTableReturn, readTableReturn, rememberTableReturn } from "@/lib/table-view-state";
import { useMediaQuery } from "@/lib/use-media-query";
import { useTranslations } from "next-intl";

/** 타일 하나가 그리는 값: 기준 난이도와 내 기록 수/전체(필터를 적용한 값). */
export interface TierTile {
  tier: number;
  total: number;
  recorded: number;
}

/** 배경/윤곽 색: 테마 변수(color)에 진하기(퍼센트)만 섞는다. 색 값은 컴포넌트에 없다(홈 칸 지도 ProgressTiles의 mix와 같은 방식). */
function mix(token: string, percent: number): string {
  return `color-mix(in srgb, var(${token}) ${percent}%, transparent)`;
}

/**
 * 서열표 첫 화면의 난이도 타일 격자(4열, 360px 미만 3열). 타일 하나가 난이도 하나이고 누르면 그 난이도 폴더(/table/folder/{tier})로 간다.
 * - 타일에는 난이도 숫자와 `기록/전체`만 둔다. 진행 정도는 타일이 진해지는 것으로만 보여 준다(홈 칸 지도와 같은 tileTint 규칙).
 * - 다 채운 타일(n/n)은 초록 색조. `n/n` 숫자가 같이 있어 색만으로 구분하지 않고, 화면 읽기용 숨은 글자 `완료`도 붙는다.
 * - 기록이 0인 타일은 점선 윤곽 + 흐린 글자(투명도를 낮추면 글자 대비가 깨져서 글자 색 토큰으로 흐리게 한다).
 * - 평균 타일: 주황 윤곽(--weak-line)과 숨은 글자 `내 평균 난이도`. 이 탭에서 처음 들어올 때만 1.1초 빛남 ×3회 하고(globals.css tile-glow),
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
    <ul aria-label={label} className="grid grid-cols-3 gap-2 min-[360px]:grid-cols-4">
      {range ? (
        <li className="col-span-full">
          <button
            type="button"
            aria-expanded={unfolded}
            onClick={() => setUnfolded((v) => !v)}
            className="min-h-11 w-full rounded-lg border border-dashed border-ctl px-3 text-left text-[13px] text-fg-sub hover:bg-table-head"
          >
            <span aria-hidden="true">{unfolded ? "▴ " : "▸ "}</span>
            {unfolded ? t("tilesFoldClose") : foldText}
          </button>
        </li>
      ) : null}
      {ordered.map((tile) => {
        if (hidden?.has(tile)) return null;
        const done = tile.total > 0 && tile.recorded >= tile.total;
        const isAverage = tile.tier === averageTier;
        const tint = tileTint(tile.recorded, tile.total);
        const token = done ? "--done" : "--stage-ss-bar";
        return (
          <li key={tile.tier} data-done={done ? "true" : undefined}>
            <Link
              ref={isAverage ? averageRef : undefined}
              href={folderHref(tile.tier)}
              onClick={() => rememberTableReturn({ query: returnQuery, scrollY: window.scrollY, unfolded })}
              data-average={isAverage ? "true" : undefined}
              // 평균 타일은 주황 윤곽(2px)으로 윤곽 색이 달라서 tile-line을 쓰지 않는다. 빛남 막(::after)이 position 기준이 되도록 relative
              className={`relative flex min-h-14 flex-col items-center justify-center rounded-xl px-1 py-2 [background:var(--tile-bg)] hover:opacity-90 ${
                isAverage
                  ? `border-2 border-weak ${intro && !reduced ? "tile-glow" : ""}`
                  : `border [border-color:var(--tile-line)] ${tile.recorded === 0 ? "border-dashed" : ""}`
              }`}
              style={{ "--tile-bg": mix(token, tint.fill), "--tile-line": mix(token, tint.line) } as CSSProperties}
            >
              <span className={`font-num text-lg font-bold leading-none ${done ? "text-done-text" : tile.recorded === 0 ? "text-fg-dim" : "text-fg"}`}>
                {tile.tier.toFixed(1)}
              </span>
              {/* 숫자 사이의 공백: 화면 배치에는 영향이 없고, 읽기 프로그램·접근성 이름이 `5.8 4/10`으로 나뉘어 읽히게 한다 */}
              {" "}
              <span className="mt-1 font-num text-[11px] leading-none text-fg-dim">
                {tile.recorded}/{tile.total}
              </span>
              {done ? <span className="sr-only">{" "}{t("tilesDone")}</span> : null}
              {isAverage ? <span className="sr-only">{" "}{t("tilesMyAverage")}</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
