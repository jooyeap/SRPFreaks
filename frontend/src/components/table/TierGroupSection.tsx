import { EntryCard } from "@/components/table/EntryCard";
import { EntryRow, TableHeadRow } from "@/components/table/EntryRow";
import { groupAverage } from "@/lib/difficulty-table";
import { DEFAULT_SORT, sortEntries, type TableSort } from "@/lib/table-sort";
import { EMPTY_MARK, formatTier } from "@/lib/format";
import type { TableEntryResponse, TierGroupResponse } from "@/lib/api-types";
import type { AchievementStage } from "@/lib/types";

/** 칩과 묶음 단계 판정에 필요한 개수. 서열표 묶음과 곡 목록의 레벨 폴더가 같은 모양이라 함께 쓴다. */
export type StageCounts = Pick<TierGroupResponse, "total" | "exc" | "fc" | "ss" | "s" | "belowS">;

export interface ChipSpec {
  key: string;
  label: string;
  count: number;
  /** 단계 색(글자)을 쓸 단계. "S 미만"은 A/B/C를 합친 것이라 색을 따로 두지 않는다. */
  stage: AchievementStage | null;
}

/** 묶음 머리의 달성 현황 칩: EXC / FC / SS / S / S 미만 (DESIGN-UI 3장, D24). */
export function chipsOf(group: StageCounts): ChipSpec[] {
  return [
    { key: "EXC", label: "EXC", count: group.exc, stage: "EXC" },
    { key: "FC", label: "FC", count: group.fc, stage: "FC" },
    { key: "SS", label: "SS", count: group.ss, stage: "SS" },
    { key: "S", label: "S", count: group.s, stage: "S" },
    { key: "BELOW_S", label: "S 미만", count: group.belowS, stage: null },
  ];
}

/**
 * 묶음 전체가 도달한 단계. 묶음 안 모든 채보가 같은 단계 "이상"일 때만 그 단계를 돌려준다.
 * 서버가 준 칩 개수(exc/fc/ss/s)로 판정하므로 화면에서 채보를 다시 세지 않는다.
 * 예) 48개 중 EXC 3 + FC 10 + SS 35 = 48 → "SS"(모두 SS 이상). 한 곡이라도 S 미만이면 null.
 * S 미만은 A/B/C가 합쳐진 값이라 단계를 정할 수 없으므로 효과를 주지 않는다.
 */
export function groupStage(group: StageCounts): AchievementStage | null {
  if (group.total === 0) return null;
  const steps: Array<[AchievementStage, number]> = [
    ["EXC", group.exc],
    ["FC", group.fc],
    ["SS", group.ss],
    ["S", group.s],
  ];
  // 위(EXC)에서 아래로 누적한다. 누적이 처음 전체와 같아지는 단계가 "모두가 이상인 가장 낮은 단계"다.
  // (이후 단계는 개수가 0이라 누적이 그대로여서, 계속 돌면 낮은 단계로 잘못 덮어쓴다 → 바로 반환)
  let cumulative = 0;
  for (const [stage, count] of steps) {
    cumulative += count;
    if (cumulative === group.total) return stage;
  }
  return null;
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
  sort = DEFAULT_SORT,
  onRecord,
}: {
  group: TierGroupResponse;
  includeZero: boolean;
  /** 묶음 안 채보의 정렬 기준. 기본은 서버 순서(레벨 높은 순) */
  sort?: TableSort;
  /** 기록 입력 버튼을 눌렀을 때. 묶음의 레이팅 상수 난이도(미정이면 null)를 함께 넘겨 입력창이 점수를 바로 계산하게 한다 */
  onRecord?: (entry: TableEntryResponse, tier: number | null) => void;
}) {
  const entries = sortEntries(group.entries, sort);
  const title = formatTier(group.tier);
  const reached = groupStage(group);
  return (
    <section aria-label={`레이팅 상수 난이도 ${title}`} className="overflow-hidden rounded-[14px] border border-line bg-card">
      {/* 묶음 전체가 한 단계 이상이면 곡 카드와 같은 왼쪽 막대와 배경을 머리에 준다. 단계 글자는 칩이 이미 보여 준다 */}
      <header
        data-stage={reached ?? undefined}
        data-group-stage={reached ?? undefined}
        className={`relative flex flex-wrap items-center gap-x-3 gap-y-2 py-3 pl-4 pr-3 ${reached ? "stage-tint" : ""}`}
      >
        {reached && <span className="stage-bar absolute inset-y-0 left-0 w-1" aria-hidden="true" />}
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
      {/* 모바일: 한 줄 행(EntryCard) / 데스크톱: 표(EntryRow). 각 항목이 md 기준으로 서로를 숨긴다 */}
      <ul>
        {entries.map((entry) => (
          <EntryCard key={`card-${entry.entryId}`} entry={entry} onRecord={onRecord && ((e) => onRecord(e, group.tier))} />
        ))}
        {entries.map((entry) => (
          <EntryRow key={`row-${entry.entryId}`} entry={entry} onRecord={onRecord && ((e) => onRecord(e, group.tier))} />
        ))}
      </ul>
    </section>
  );
}
