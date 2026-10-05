import { StageBadge } from "@/components/table/StageBadge";
import { EMPTY_MARK, formatPlayedDate, formatRate, partLabel, difficultyLabel, formatLevel } from "@/lib/format";
import type { MyRecord } from "@/lib/api-types";
import type { RecordResponse } from "@/lib/records";
import type { DifficultyType, InstrumentPart } from "@/lib/types";

/**
 * 내 기록: SRN+ 최고 기록 1줄 (D25: 옵션별 5줄은 쓰지 않는다). 기록이 없으면 `–`.
 * 달성률과 단계는 서버가 계산한 최고 기록(mine)을, 날짜는 달성률이 가장 높은 기록(best)의 날짜를 쓴다.
 * FC/EXC는 서열표와 같은 그라데이션을 쓴다: 달성률 숫자는 그라데이션 글자, 줄 왼쪽에 막대. S/SS는 숫자를 기본 글자색으로 둔다.
 */
export function MyRecordCard({
  mine,
  best,
  chart,
  emphasizeSrn,
  onRecord,
}: {
  mine: MyRecord | null;
  best: RecordResponse | null;
  chart: { part: InstrumentPart; difficulty: DifficultyType; level: number } | null;
  /** 서열표에서 들어온 화면: SRN+ 줄을 강조하고 "서열표는 SRN+ 기준"이라고 적는다 */
  emphasizeSrn: boolean;
  onRecord: () => void;
}) {
  const stage = mine?.stage ?? null;
  const fancy = stage === "FC" || stage === "EXC";
  return (
    <section aria-label="내 기록" className="flex flex-col gap-3 rounded-lg border border-line bg-card p-4">
      <h2 className="text-sm font-semibold text-fg-sub">
        내 기록
        {chart ? (
          <span className="ml-2 font-normal text-fg-dim">
            {partLabel(chart.part)} {difficultyLabel(chart.difficulty)} {formatLevel(chart.level)} 기준
          </span>
        ) : null}
      </h2>

      <div
        data-stage={stage ?? undefined}
        className={`relative flex items-center gap-3 overflow-hidden rounded border px-4 py-3 ${
          emphasizeSrn ? "border-chip-line" : "border-line"
        } ${stage ? "stage-tint" : ""}`}
      >
        {fancy ? <span className="stage-bar absolute inset-y-0 left-0 w-1" aria-hidden="true" /> : null}
        {emphasizeSrn ? <span className="text-xs font-semibold text-fg">SRN+</span> : null}
        <span
          className={`font-num text-2xl font-semibold ${
            fancy ? "stage-grad-text" : mine ? "text-fg" : "text-fg-faint"
          }`}
        >
          {formatRate(mine?.rate)}
        </span>
        {stage ? <StageBadge stage={stage} /> : null}
        <span className="ml-auto font-num text-xs text-fg-dim">
          {best ? formatPlayedDate(best.playedAt) : EMPTY_MARK}
        </span>
      </div>

      {emphasizeSrn ? <p className="text-xs text-fg-dim">서열표는 SRN+ 기준입니다.</p> : null}

      <button
        type="button"
        onClick={onRecord}
        disabled={!chart}
        className="h-11 w-full rounded-xl bg-chip-on-bg text-sm font-extrabold text-chip-on-fg disabled:opacity-50"
      >
        기록 등록
      </button>
    </section>
  );
}
