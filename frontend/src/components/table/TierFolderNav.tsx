"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { folderHref, tierParam } from "@/lib/difficulty-table";
import { formatTier } from "@/lib/format";
import type { TierGroupResponse } from "@/lib/api-types";

/**
 * 서열표 묶음 화면 상단의 난이도 이동 막대. 두 가지를 함께 쓴다.
 * 1) `‹ 5.6 · 5.7 · 5.8 ›`: 지금 묶음의 바로 아래/위 난이도로 한 번에 간다.
 * 2) 칩 띠: 모든 난이도를 가로로 늘어놓고 지금 것을 강조한다(내 기록 `n/전체`). 열 때 지금 칩이 보이는 자리로 맞춘다.
 *
 * 이동은 모두 `replace`다. push로 가면 5.7 → 5.8 → 5.9를 누를 때마다 기록이 쌓여서 뒤로 가기를 여러 번 눌러야 서열표로 돌아간다
 * ("위에 쌓이는 느낌"). replace는 지금 주소를 갈아 끼우므로 뒤로 가기 한 번이 곧 서열표/곡 상세다.
 * groups는 서버 순서(높은 난이도 먼저)이고, 화면은 왼쪽이 낮은 난이도, 오른쪽이 높은 난이도(숫자가 커지는 방향)다.
 */
export function TierFolderNav({ groups, currentTier }: { groups: readonly TierGroupResponse[]; currentTier: number | null }) {
  const currentRef = useRef<HTMLAnchorElement>(null);
  const index = groups.findIndex((g) => g.tier === currentTier);

  // 칩 띠가 가로로 길어서(약 20개) 지금 칩이 화면 밖일 수 있다. 가운데로 맞춘다.
  // scrollIntoView는 jsdom(테스트)에 없어서 있을 때만 부른다. 세로 스크롤은 건드리지 않게 block: "nearest".
  useEffect(() => {
    currentRef.current?.scrollIntoView?.({ inline: "center", block: "nearest" });
  }, [currentTier]);

  if (index < 0) {
    return null;
  }
  const higher = index > 0 ? groups[index - 1] : null; // 서버 순서에서 앞 = 더 높은 난이도
  const lower = index < groups.length - 1 ? groups[index + 1] : null;
  const current = groups[index];

  return (
    <div className="flex flex-col gap-2">
      <nav aria-label="이웃 난이도" className="flex items-stretch justify-between gap-2">
        <StepLink group={lower} direction="prev" />
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl border border-line bg-card px-3 py-1.5">
          <span aria-current="page" className="font-num text-lg font-semibold text-fg">
            {formatTier(current.tier)}
          </span>
          <span className="font-num text-[11px] text-fg-dim">
            기록 {current.recorded}/{current.total}
          </span>
        </div>
        <StepLink group={higher} direction="next" />
      </nav>

      <nav aria-label="난이도 목록">
        <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
          {[...groups].reverse().map((g) => {
            const here = g.tier === currentTier;
            const done = g.total > 0 && g.recorded >= g.total;
            return (
              <li key={tierParam(g.tier)} className="shrink-0" data-done={done ? "true" : undefined}>
                <Link
                  ref={here ? currentRef : undefined}
                  href={folderHref(g.tier)}
                  replace
                  aria-current={here ? "page" : undefined}
                  // 지금 난이도는 배경으로 강조하고, 완료는 글자 색으로 구분한다(숫자 n/n이 같이 있어 색만으로 구분하지 않는다)
                  className={`flex min-w-[3.25rem] flex-col items-center rounded-xl border px-2 py-1 ${
                    here ? "border-transparent bg-chip-on-bg text-chip-on-fg" : "border-chip-line hover:bg-table-head"
                  }`}
                >
                  <span className={`font-num text-sm font-bold ${here ? "" : done ? "text-done-text" : "text-fg"}`}>{formatTier(g.tier)}</span>
                  <span className={`font-num text-[10px] ${here ? "" : "text-fg-dim"}`}>
                    {g.recorded}/{g.total}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** 이전(낮은)/다음(높은) 난이도 버튼. 끝이라 갈 곳이 없으면 눌리지 않는 자리 표시만 둔다(막대 폭이 흔들리지 않게). */
function StepLink({ group, direction }: { group: TierGroupResponse | null; direction: "prev" | "next" }) {
  const arrow = direction === "prev" ? "‹" : "›";
  const base = "flex w-20 flex-col items-center justify-center rounded-xl border px-2 py-1.5";
  if (!group) {
    return (
      <span aria-hidden="true" className={`${base} border-line text-disabled`}>
        <span className="text-lg leading-none">{arrow}</span>
      </span>
    );
  }
  const label = formatTier(group.tier);
  return (
    <Link
      href={folderHref(group.tier)}
      replace
      aria-label={`${direction === "prev" ? "이전" : "다음"} 난이도 ${label}`}
      className={`${base} border-chip-line text-fg hover:bg-table-head`}
    >
      <span aria-hidden="true" className="font-num text-sm font-semibold">
        {direction === "prev" ? `${arrow} ${label}` : `${label} ${arrow}`}
      </span>
    </Link>
  );
}
