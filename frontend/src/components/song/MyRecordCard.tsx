import { StageBadge } from "@/components/table/StageBadge";
import { EMPTY_MARK, formatPlayedDate, formatRate, formatScore, partLabel, difficultyLabel, formatLevel } from "@/lib/format";
import type { MyRecord } from "@/lib/api-types";
import type { RecordResponse } from "@/lib/records";
import type { DifficultyType, InstrumentPart } from "@/lib/types";
import { useTranslations } from "next-intl";
import { ArrivalBefore, ArrivalChip } from "@/components/song/ArrivalMarks";
import { formatScoreDiff } from "@/components/NotificationBell";
import type { TierArrival } from "@/lib/tier-arrival";

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
  arrival = null,
  onRecord,
}: {
  mine: MyRecord | null;
  best: RecordResponse | null;
  chart: { part: InstrumentPart; difficulty: DifficultyType; level: number } | null;
  /** 서열표에서 들어온 화면: SRN+ 줄을 강조하고 "서열표는 SRN+, Premium Free 기준"이라고 적는다 */
  emphasizeSrn: boolean;
  /** 서열표 변경 알림(D61)에서 왔을 때: 카드를 잠깐 강조하고 알림의 내 점수 전 → 후(차이)를 한 줄 보여 준다 */
  arrival?: TierArrival | null;
  onRecord: () => void;
}) {
  const t = useTranslations();
  const scoreChanged = arrival !== null && arrival.beforeScore !== arrival.afterScore;
  const stage = mine?.stage ?? null;
  const fancy = stage === "FC" || stage === "EXC";
  return (
    <section
      aria-label={t("Song.myRecord")}
      className={`flex flex-col gap-3 rounded-lg border border-line bg-card p-4 ${scoreChanged ? "arrive-glow" : ""}`}
    >
      <h2 className="text-sm font-semibold text-fg-sub">
        {t("Song.myRecord")}
        {chart ? (
          <span className="ml-2 font-normal text-fg-dim">
            {t("Chart.chartBasis", { chart: `${partLabel(chart.part)} ${difficultyLabel(chart.difficulty)} ${formatLevel(chart.level)}` })}
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

      {scoreChanged ? <ArrivalScore before={arrival.beforeScore} after={arrival.afterScore} /> : null}

      {emphasizeSrn ? <p className="text-xs text-fg-dim">{t("Song.tableBasis")}</p> : null}

      <button
        type="button"
        onClick={onRecord}
        disabled={!chart}
        className="h-11 w-full rounded-xl bg-chip-on-bg text-sm font-extrabold text-chip-on-fg disabled:opacity-50"
      >
        {t("Song.addRecord")}
      </button>
    </section>
  );
}

/**
 * 알림에 있던 내 점수 전 → 후. 미정(기준 난이도 없음)이면 `미정`으로 쓰고 차이는 둘 다 있을 때만.
 * 오르내림은 색과 함께 `+`/`-` 글자로도 보인다(색만으로 전달하지 않는다).
 */
function ArrivalScore({ before, after }: { before: number | null; after: number | null }) {
  const t = useTranslations();
  const text = (v: number | null) => (v === null ? t("Common.undecided") : formatScore(v));
  const diff = before !== null && after !== null ? after - before : null;
  return (
    <div className="flex items-center gap-1.5 text-xs text-fg-dim">
      <span>{t("Song.arriveScore")}</span>
      <span className="ml-auto flex items-baseline gap-1 font-num">
        <ArrivalBefore text={text(before)} />
        <span className="text-base font-bold text-fg">{text(after)}</span>
        {diff !== null ? (
          <span className={`text-xs font-bold ${diff >= 0 ? "text-done-text" : "text-danger"}`}>{formatScoreDiff(diff)}</span>
        ) : null}
        <ArrivalChip />
      </span>
    </div>
  );
}
