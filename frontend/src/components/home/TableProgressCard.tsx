import Link from "next/link";
import { StageBadge } from "@/components/table/StageBadge";
import { folderHref, type TableProgress } from "@/lib/difficulty-table";
import { formatTier } from "@/lib/format";

/** 0~100 사이 정수 비율. 전체가 0이면 0. */
function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/**
 * 서열표 진행도 카드: 전체 `기록 n/전체`와 막대, EXC/FC/SS/S 개수, 묶음별 진행(누르면 묶음 페이지).
 * 숫자는 서열표 화면의 묶음 통계 합이다(서버 계산). 막대는 장식이고 같은 값이 글자(n/전체, n%)로 있다.
 */
export function TableProgressCard({ progress }: { progress: TableProgress }) {
  const counts = [
    { stage: "EXC", count: progress.exc },
    { stage: "FC", count: progress.fc },
    { stage: "SS", count: progress.ss },
    { stage: "S", count: progress.s },
  ] as const;
  return (
    <section aria-label="서열표 진행도" className="flex flex-col gap-3 rounded-[14px] border border-line bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-num text-[17px] font-bold text-fg">서열표 진행도</h2>
        <Link href="/table" className="text-xs text-fg-sub hover:text-fg">
          서열표 보기
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-sm text-fg-sub">
          기록 <span className="font-num font-semibold text-fg">{progress.recorded}</span>/{progress.total}
          <span className="ml-2 font-num text-xs text-fg-dim">{percent(progress.recorded, progress.total)}%</span>
        </p>
        <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-table-head">
          <div className="h-full rounded-full bg-fg-dim" style={{ width: `${percent(progress.recorded, progress.total)}%` }} />
        </div>
      </div>

      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" aria-label="전체 달성 현황">
        {counts.map((c) => (
          <li key={c.stage} className={c.count === 0 ? "opacity-60" : undefined}>
            {/* 단계 배지는 글자가 같이 있으므로 색만으로 구분하지 않는다 */}
            <StageBadge stage={c.stage} /> <span className="font-num text-fg-sub">{c.count}</span>
          </li>
        ))}
        <li className="text-fg-dim">
          S 미만 <span className="font-num text-fg-sub">{progress.belowS}</span>
        </li>
      </ul>

      <ul aria-label="묶음별 진행" className="grid gap-x-4 gap-y-1 border-t border-row-line pt-2.5 md:grid-cols-2">
        {progress.groups.map((g) => (
          <li key={g.tier ?? "undecided"}>
            <Link href={folderHref(g.tier)} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-table-head">
              <span className="w-10 shrink-0 font-num font-semibold text-fg">{formatTier(g.tier)}</span>
              <span aria-hidden="true" className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-table-head">
                <span className="block h-full rounded-full bg-fg-dim" style={{ width: `${percent(g.recorded, g.total)}%` }} />
              </span>
              <span className="w-14 shrink-0 text-right font-num text-xs text-fg-sub">
                {g.recorded}/{g.total}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
