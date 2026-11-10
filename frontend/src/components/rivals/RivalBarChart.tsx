import type { RivalDetailTier, RivalPatternSummary } from "@/lib/api-types";
import { patternLabel } from "@/lib/chart-labels";
import { barPercent, isSmallSample } from "@/lib/rival-dashboard";
import { formatRateDiff } from "@/lib/rivals";
import { useTranslations } from "next-intl";

/** 막대 한 줄의 재료. 속성 줄과 난이도대 줄이 같은 모양을 쓰도록 공통 모양으로 맞춘다. */
interface BarRow {
  key: string;
  label: string;
  wins: number;
  losses: number;
  sharedCount: number;
  rateDiffAvg: number | null | undefined;
  small: boolean;
}

/** 맨 오른쪽 값: 평균 달성률 차(`+1.8%`, 부호 글자). 공유 곡이 0이면 null(`–`로 보인다). */
function rateText(row: BarRow): string | null {
  return row.sharedCount === 0 ? null : formatRateDiff(row.rateDiffAvg);
}

/**
 * 속성별 승패 막대(D67, 6단계): 속성마다 한 줄. 가운데 선을 기준으로 왼쪽 `패 N`(주황) · 오른쪽 `승 N`(초록), 맨 오른쪽에 평균 달성률 차(%, 부호 포함. 2026-11-09: 예전에는 점수 차 합계). 라벨 `평균 달성률 차`는 아래 안내 한 줄이 설명하고 읽기 프로그램에는 숨김 글자로 붙인다.
 * 길이는 모든 속성 중 가장 큰 승·패 수에 비례하고(한쪽 절반 안의 %), 0보다 크면 글자가 들어가도록 최소 38px을 둔다.
 * 막대 안 글자는 줄바꿈하지 않는다(whitespace-nowrap). 색만으로 전달하지 않는다: 막대 안에 `패`/`승` 글자와 숫자가 있고 맨 오른쪽 값은 +/−/±와 % 글자다.
 * 공유 곡이 5곡 미만인 속성은 줄 아래에 `※ 5곡 미만이라 참고용`을 적는다. 도형은 장식이 아니라 값이 글자로 모두 있으므로 읽기 프로그램은 줄의 글자를 읽는다.
 */
function BarList({ rows, ariaLabel }: { rows: readonly BarRow[]; ariaLabel: string }) {
  const t = useTranslations();
  const max = rows.reduce((m, r) => Math.max(m, r.wins, r.losses), 0);
  return (
    <ul aria-label={ariaLabel} className="flex flex-col gap-2.5">
      {rows.map((p) => {
        const lose = barPercent(p.losses, max);
        const win = barPercent(p.wins, max);
        return (
          <li key={p.key} data-key={p.key}>
            <div className="flex items-center gap-2">
              <span className="w-[64px] shrink-0 text-xs text-fg">{p.label}</span>
              <div className="relative flex h-6 min-w-0 flex-1 items-center">
                <div className="flex h-full w-1/2 justify-end">
                  {p.losses > 0 ? (
                    <span
                      style={{ width: `${lose}%` }}
                      className="flex h-full min-w-[38px] items-center justify-end whitespace-nowrap rounded-l border border-weak bg-weak-tint px-1.5 font-num text-[11px] font-bold text-fg"
                    >
                      {t("Rival.barLose", { n: p.losses })}
                    </span>
                  ) : null}
                </div>
                <span className="h-full w-px shrink-0 bg-chip-line" aria-hidden="true" />
                <div className="flex h-full w-1/2 justify-start">
                  {p.wins > 0 ? (
                    <span
                      style={{ width: `${win}%` }}
                      className="flex h-full min-w-[38px] items-center justify-start whitespace-nowrap rounded-r border border-done bg-done-tint px-1.5 font-num text-[11px] font-bold text-fg"
                    >
                      {t("Rival.barWin", { n: p.wins })}
                    </span>
                  ) : null}
                </div>
              </div>
              <span className="w-[60px] shrink-0 text-right font-num text-xs font-bold tabular-nums text-fg">
                {rateText(p) === null ? (
                  "–"
                ) : (
                  <>
                    <span className="sr-only">{t("Rival.rateDiffLabel")} </span>
                    {rateText(p)}
                  </>
                )}
              </span>
            </div>
            {p.small ? <p className="ml-[72px] mt-0.5 text-[11px] text-fg-dim">{t("Rival.smallSample")}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

export function RivalBarChart({ patterns }: { patterns: readonly RivalPatternSummary[] }) {
  const t = useTranslations();
  const rows: BarRow[] = patterns.map((p) => ({
    key: p.key,
    label: patternLabel(p.pattern, t),
    wins: p.wins,
    losses: p.losses,
    sharedCount: p.sharedCount,
    rateDiffAvg: p.rateDiffAvg,
    small: isSmallSample(p),
  }));
  return <BarList rows={rows} ariaLabel={t("Rival.barAria")} />;
}

/**
 * 속성 상세의 난이도대별 막대(2026-11-10): 서열표 기준 난이도(0.1 단위) 한 줄씩, 속성 막대(RivalBarChart)와 같은 모양을 그대로 쓴다.
 * 줄 이름은 난이도(`5.6`), 공유 곡이 없는 난이도는 막대 없이 맨 오른쪽이 `–`. `5곡 미만` 참고 표시는 속성 줄에만 있다.
 */
export function RivalTierBars({ tiers }: { tiers: readonly RivalDetailTier[] }) {
  const t = useTranslations();
  const rows: BarRow[] = tiers.map((x) => ({
    key: x.tier.toFixed(1),
    label: x.tier.toFixed(1),
    wins: x.wins,
    losses: x.losses,
    sharedCount: x.sharedCount,
    rateDiffAvg: x.rateDiffAvg,
    small: false,
  }));
  return <BarList rows={rows} ariaLabel={t("Rival.tierBarAria")} />;
}
