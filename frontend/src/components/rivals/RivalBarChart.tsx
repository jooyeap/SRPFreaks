import type { RivalPatternSummary } from "@/lib/api-types";
import { patternLabel } from "@/lib/chart-labels";
import { barMax, barPercent, isSmallSample } from "@/lib/rival-dashboard";
import { winRatePercent } from "@/lib/rival-charts";
import { useTranslations } from "next-intl";

/** 맨 오른쪽 값: 승률 %(승 ÷ 공유 곡, 정수). 공유 곡이 0이면 `–`(0%가 아니다). */
function rateText(pattern: RivalPatternSummary): string | null {
  const percent = winRatePercent(pattern);
  return percent === null ? null : `${percent}%`;
}

/**
 * 속성별 승패 막대(D67, 6단계): 속성마다 한 줄. 가운데 선을 기준으로 왼쪽 `패 N`(주황) · 오른쪽 `승 N`(초록), 맨 오른쪽에 승률 %(2026-11-09: 예전에는 점수 차 합계). `승률` 글자는 아래 안내 한 줄이 설명하고 읽기 프로그램에는 숨김 글자로 붙인다.
 * 길이는 모든 속성 중 가장 큰 승·패 수에 비례하고(한쪽 절반 안의 %), 0보다 크면 글자가 들어가도록 최소 38px을 둔다.
 * 막대 안 글자는 줄바꿈하지 않는다(whitespace-nowrap). 색만으로 전달하지 않는다: 막대 안에 `패`/`승` 글자와 숫자가 있고 맨 오른쪽 값은 % 글자다.
 * 공유 곡이 5곡 미만인 속성은 줄 아래에 `※ 5곡 미만이라 참고용`을 적는다. 도형은 장식이 아니라 값이 글자로 모두 있으므로 읽기 프로그램은 줄의 글자를 읽는다.
 */
export function RivalBarChart({ patterns }: { patterns: readonly RivalPatternSummary[] }) {
  const t = useTranslations();
  const max = barMax(patterns);
  return (
    <ul aria-label={t("Rival.barAria")} className="flex flex-col gap-2.5">
      {patterns.map((p) => {
        const lose = barPercent(p.losses, max);
        const win = barPercent(p.wins, max);
        return (
          <li key={p.key} data-key={p.key}>
            <div className="flex items-center gap-2">
              <span className="w-[64px] shrink-0 text-xs text-fg">{patternLabel(p.pattern, t)}</span>
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
                    <span className="sr-only">{t("Rival.colRate")} </span>
                    {rateText(p)}
                  </>
                )}
              </span>
            </div>
            {isSmallSample(p) ? <p className="ml-[72px] mt-0.5 text-[11px] text-fg-dim">{t("Rival.smallSample")}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
