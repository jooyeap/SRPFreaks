import { useId } from "react";
import { StageBadge } from "@/components/table/StageBadge";
import { percentOf, type ProgressSummary } from "@/lib/progress";

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * 호(arc) 하나. EXC/FC는 그라데이션이 필요한데 SVG 선은 CSS 그라데이션 값을 못 쓰므로
 * <linearGradient>의 끝점 색을 CSS 변수(--ring-*)로 받는다. 나머지 단계는 단계 막대와 같은 색(--st-bar)이다.
 */
interface Arc {
  stage: "EXC" | "FC" | "SS" | "S" | "A";
  count: number;
}

/**
 * 진행도 도넛: 전체 채보 중 EXC/FC/SS/S/S 미만이 차지하는 비율을 호로 보여 주고(남은 부분 = 기록 없음 = 바탕색),
 * 가운데에 기록 퍼센트와 `기록/전체`를 글자로 둔다. 호는 장식(aria-hidden)이고 같은 숫자가 글자 범례로 따로 있다 (색만으로 전달하지 않는다).
 * 호 하나는 stroke-dasharray로 "내 길이만 그리고 나머지는 비움", stroke-dashoffset으로 "앞 호들이 차지한 길이만큼 뒤로 밀기"를 해서 이어 붙인다.
 */
export function ProgressDonut({ progress }: { progress: ProgressSummary }) {
  const uid = useId().replace(/:/g, ""); // url(#id)에 콜론이 들어가면 곤란해서 뺀다
  const arcs: Arc[] = [
    { stage: "EXC", count: progress.exc },
    { stage: "FC", count: progress.fc },
    { stage: "SS", count: progress.ss },
    { stage: "S", count: progress.s },
    { stage: "A", count: progress.belowS }, // S 미만(A/B/C 합)은 A 색
  ];
  let consumed = 0;
  const circles = arcs.map((arc) => {
    const length = progress.total > 0 ? (arc.count / progress.total) * CIRCUMFERENCE : 0;
    const offset = -consumed;
    consumed += length;
    return { ...arc, length, offset };
  });
  const legend = [
    { stage: "EXC", count: progress.exc },
    { stage: "FC", count: progress.fc },
    { stage: "SS", count: progress.ss },
    { stage: "S", count: progress.s },
  ] as const;

  return (
    <div className="flex items-center gap-4">
      <div className="relative size-[132px] shrink-0">
        <svg viewBox="0 0 100 100" className="size-full" aria-hidden="true" data-donut="">
          <defs>
            <linearGradient id={`${uid}-exc`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" style={{ stopColor: "var(--ring-exc-1)" }} />
              <stop offset="0.5" style={{ stopColor: "var(--ring-exc-2)" }} />
              <stop offset="1" style={{ stopColor: "var(--ring-exc-3)" }} />
            </linearGradient>
            <linearGradient id={`${uid}-fc`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" style={{ stopColor: "var(--ring-fc-1)" }} />
              <stop offset="1" style={{ stopColor: "var(--ring-fc-2)" }} />
            </linearGradient>
          </defs>
          {/* 12시 방향에서 시작하도록 -90도 돌린다 */}
          <g transform="rotate(-90 50 50)">
            <circle cx="50" cy="50" r={RADIUS} fill="none" strokeWidth="12" className="stroke-table-head" />
            {circles.map((c) =>
              c.count > 0 ? (
                <circle
                  key={c.stage}
                  data-stage={c.stage}
                  data-arc={c.stage}
                  cx="50"
                  cy="50"
                  r={RADIUS}
                  fill="none"
                  strokeWidth="12"
                  strokeDasharray={`${c.length} ${CIRCUMFERENCE - c.length}`}
                  strokeDashoffset={c.offset}
                  style={{ stroke: c.stage === "EXC" ? `url(#${uid}-exc)` : c.stage === "FC" ? `url(#${uid}-fc)` : "var(--st-bar)" }}
                />
              ) : null,
            )}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-num text-[28px] font-bold leading-none text-fg">
            {percentOf(progress.recorded, progress.total)}
            <span className="text-[13px] font-medium">%</span>
          </span>
          <span className="mt-1 font-num text-xs text-fg-dim">
            <span className="sr-only">기록 </span>
            {progress.recorded}/{progress.total}
          </span>
        </div>
      </div>

      <ul className="flex min-w-0 flex-1 flex-col gap-1.5" aria-label="전체 달성 현황">
        {legend.map((l) => (
          <li key={l.stage} className={`flex items-center justify-between gap-2 ${l.count === 0 ? "opacity-60" : ""}`}>
            {/* 단계 배지는 글자가 같이 있으므로 색만으로 구분하지 않는다 */}
            <StageBadge stage={l.stage} />
            <span className="font-num text-sm text-fg">{l.count}</span>
          </li>
        ))}
        <li className="flex items-center justify-between gap-2 text-xs text-fg-dim">
          <span>S 미만</span>
          <span className="font-num text-sm text-fg-sub">{progress.belowS}</span>
        </li>
        <li className="flex items-center justify-between gap-2 text-xs text-fg-dim">
          <span>기록 없음</span>
          <span className="font-num text-sm text-fg-sub">{progress.total - progress.recorded}</span>
        </li>
      </ul>
    </div>
  );
}
