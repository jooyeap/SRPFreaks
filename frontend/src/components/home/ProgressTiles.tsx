import Link from "next/link";
import { StageBar } from "@/components/table/StageBar";
import { chipsOf } from "@/components/table/TierGroupSection";
import type { ProgressGroup } from "@/lib/difficulty-table";
import { percentOf, tileTint } from "@/lib/progress";

/** 전체가 있고 기록이 모두 채워졌으면 완료. 완료한 칸은 막대 테두리와 이름 글자 색이 달라진다(`n/n` 숫자가 같이 보여 색만으로 구분하지 않는다). */
function isDone(recorded: number, total: number): boolean {
  return total > 0 && recorded >= total;
}

/** 배경/테두리 색: 단계 SS 막대 색(--stage-ss-bar)에 진하기(퍼센트)만 섞는다. 색 값은 컴포넌트에 없고 테마 변수만 쓴다. */
function mix(percent: number): string {
  return `color-mix(in srgb, var(--stage-ss-bar) ${percent}%, transparent)`;
}

/**
 * 칸 지도: 묶음(서열표는 기준 난이도, 곡 목록은 레벨 폴더) 하나가 한 칸이다. 칸마다 기록 퍼센트, `기록/전체`,
 * 단계 비율 막대가 있고, 많이 채울수록 칸이 진해진다.
 * 칸 전체가 링크라서 누르면 그 묶음으로 간다 (터치 영역이 넉넉하다).
 * 넓은 화면(lg, 1024px 이상)에서는 칸이 2열로 넓어지고, 퍼센트·개수 바로 옆에 EXC / FC / SS / S / S 미만 개수 칩이 이어지고 막대는 칸 아래에 전체 폭으로 깔린다(넓어져 비는 자리를 채운다).
 * 모바일은 3열이라 칸이 좁아서 칩을 숨긴다. 칩은 글자가 같이 있어 색만으로 구분하지 않는다.
 */
export function ProgressTiles({ groups, label }: { groups: readonly ProgressGroup[]; label: string }) {
  return (
    <ul aria-label={label} className="grid grid-cols-3 gap-2 lg:grid-cols-2">
      {groups.map((g) => {
        const done = isDone(g.recorded, g.total);
        const tint = tileTint(g.recorded, g.total);
        return (
          <li key={g.key} data-done={done ? "true" : undefined}>
            <Link
              href={g.href}
              className="flex h-full flex-col gap-1.5 rounded-[10px] border p-2 hover:opacity-90 lg:gap-2 lg:p-3"
              style={{ background: mix(tint.fill), borderColor: mix(tint.line) }}
            >
              {/* 위줄: 왼쪽 이름·퍼센트·기록/전체, 데스크톱에서는 그 바로 옆(막대 위)에 단계 칩이 이어진다. 막대는 아래에 전체 폭 */}
              <span className="flex flex-col gap-1.5 lg:flex-row lg:items-center lg:gap-6">
                <span className="flex flex-col gap-1.5 lg:w-24 lg:shrink-0">
                  <span className={`truncate font-num text-xs font-semibold ${done ? "text-done-text" : "text-fg-sub"}`}>{g.label}</span>
                  <span className="font-num text-xl font-bold leading-none text-fg">
                    {percentOf(g.recorded, g.total)}
                    <span className="text-[10px] font-medium text-fg-dim">%</span>
                  </span>
                  <span className="font-num text-[11px] text-fg-dim">
                    {g.recorded}/{g.total}
                  </span>
                </span>
                <span className="hidden min-w-0 flex-1 flex-wrap gap-1 lg:flex">
                  {chipsOf(g).map((chip) => (
                    <span
                      key={chip.key}
                      data-stage={chip.stage ?? undefined}
                      className={`rounded-md border border-chip-line px-1.5 py-px text-[11px] ${
                        chip.count === 0 ? "text-fg-faint" : chip.stage ? "stage-text" : "text-fg-sub"
                      }`}
                    >
                      {chip.label} <span className="font-num">{chip.count}</span>
                    </span>
                  ))}
                </span>
              </span>
              <StageBar counts={g} total={g.total} className="h-1" done={done} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
