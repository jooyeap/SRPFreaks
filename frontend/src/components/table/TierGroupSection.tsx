import { EntryCard } from "@/components/table/EntryCard";
import { EntryRow, TableHeadRow } from "@/components/table/EntryRow";
import { groupAverage } from "@/lib/difficulty-table";
import { EMPTY_MARK, formatTier } from "@/lib/format";
import type { TableEntryResponse, TierGroupResponse } from "@/lib/api-types";
import type { AchievementStage } from "@/lib/types";

interface ChipSpec {
  key: string;
  label: string;
  count: number;
  /** 단계 색(글자)을 쓸 단계. "S 미만"은 A/B/C를 합친 것이라 색을 따로 두지 않는다. */
  stage: AchievementStage | null;
}

/** 묶음 머리의 달성 현황 칩: EXC / FC / SS / S / S 미만 (DESIGN-UI 3장, D24). */
function chipsOf(group: TierGroupResponse): ChipSpec[] {
  return [
    { key: "EXC", label: "EXC", count: group.exc, stage: "EXC" },
    { key: "FC", label: "FC", count: group.fc, stage: "FC" },
    { key: "SS", label: "SS", count: group.ss, stage: "SS" },
    { key: "S", label: "S", count: group.s, stage: "S" },
    { key: "BELOW_S", label: "S 미만", count: group.belowS, stage: null },
  ];
}

/** 평균 표기. 소수 둘째 자리 + %. 기록이 없어 평균이 없으면 `–`. */
function formatAverage(value: number | null): string {
  return value === null ? EMPTY_MARK : `${value.toFixed(2)}%`;
}

/**
 * 기준 난이도 하나의 묶음. 제목 `5.8  48개`, 달성 현황 칩, `기록 43/48`, 평균을 머리에 두고 아래에 채보 목록을 둔다.
 * 0개인 칩은 흐리게 하되 글자는 그대로 둔다(색만으로 의미를 전달하지 않는다).
 * 칩과 평균은 서버가 계산한 값을 그대로 보여 준다. 화면에서 다시 세지 않는다.
 */
export function TierGroupSection({
  group,
  includeZero,
  onRecord,
}: {
  group: TierGroupResponse;
  includeZero: boolean;
  onRecord?: (entry: TableEntryResponse) => void;
}) {
  const title = formatTier(group.tier);
  return (
    <section aria-label={`기준 난이도 ${title}`} className="overflow-hidden rounded-[14px] border border-line bg-card">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3">
        <h2 className="font-num text-lg font-semibold text-fg">
          {title} <span className="ml-1 text-sm font-normal text-fg-sub">{group.total}개</span>
        </h2>
        <ul className="flex flex-wrap items-center gap-1.5" aria-label="내 달성 현황">
          {chipsOf(group).map((chip) => (
            <li
              key={chip.key}
              data-stage={chip.stage ?? undefined}
              className={`rounded-full border border-chip-line px-2 py-0.5 text-xs ${
                chip.count === 0 ? "text-fg-faint" : chip.stage ? "stage-text" : "text-fg-sub"
              }`}
            >
              {chip.label} <span className="font-num">{chip.count}</span>
            </li>
          ))}
        </ul>
        <p className="ml-auto flex items-baseline gap-2 text-sm text-fg-sub">
          <span className="text-xs text-fg-dim">
            기록 {group.recorded}/{group.total}
          </span>
          <span>
            평균 <span className="font-num font-semibold text-fg">{formatAverage(groupAverage(group, includeZero))}</span>
          </span>
        </p>
      </header>

      <TableHeadRow />
      {/* 모바일: 4열 카드 격자 / 데스크톱: 표 (각 항목이 md 기준으로 서로를 숨긴다) */}
      <ul className="grid grid-cols-4 gap-2 px-3 pb-3 md:block md:p-0">
        {group.entries.map((entry) => (
          <EntryCard key={`card-${entry.entryId}`} entry={entry} onRecord={onRecord} />
        ))}
        {group.entries.map((entry) => (
          <EntryRow key={`row-${entry.entryId}`} entry={entry} onRecord={onRecord} />
        ))}
      </ul>
    </section>
  );
}
