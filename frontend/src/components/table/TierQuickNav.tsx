import Link from "next/link";
import { folderHref } from "@/lib/difficulty-table";
import { formatTier } from "@/lib/format";
import type { TierGroupResponse } from "@/lib/api-types";

/**
 * 서열표 맨 위 "난이도 바로가기": 기준 난이도 칩을 가로로 늘어놓고, 누르면 그 난이도의 묶음 페이지로 바로 간다.
 * 칩마다 내 기록 수/전체를 보여 주고, 전부 기록한 난이도는 글자 색이 완료 색이 된다(`n/n`이 같이 있어 색만으로 구분하지 않는다).
 * 칩 줄은 모바일에서 가로로 넘기며(스크롤바는 숨김), 키보드로도 모두 이동할 수 있게 링크로 만든다.
 */
export function TierQuickNav({ groups }: { groups: readonly TierGroupResponse[] }) {
  if (groups.length === 0) {
    return null;
  }
  return (
    <nav aria-label="난이도 바로가기" className="-mx-4 md:mx-0">
      <ul className="flex gap-2 overflow-x-auto px-4 pb-1.5 pt-0.5 [scrollbar-width:none] md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
        {groups.map((g) => {
          const done = g.total > 0 && g.recorded >= g.total;
          return (
            <li key={g.tier ?? "undecided"} data-done={done ? "true" : undefined} className="shrink-0">
              <Link
                href={folderHref(g.tier)}
                className="flex min-w-14 flex-col items-center rounded-xl border border-chip-line bg-card px-3 py-1.5 hover:bg-table-head"
              >
                <span className={`font-num text-base font-bold ${done ? "text-done-text" : "text-fg"}`}>{formatTier(g.tier)}</span>
                <span className="font-num text-[11px] text-fg-dim">
                  {g.recorded}/{g.total}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
