import { chartTierAttrs, chartTierStart, GLOW_2_FROM, GLOW_3_FROM, PLAYER_TIER_MINS } from "@/lib/chart-tier";
import { chartScore, guideRows, GUIDE_RATES } from "@/lib/rating-guide";

/**
 * 레이팅 상수표: 기준 난이도(행) × 달성률(열)의 채보 점수. 칸 색은 점수에 따른 그라데이션이다.
 * 숫자는 항상 칸 안에 글자로 있으므로 색만으로 값을 전달하지 않는다. 칸의 배경·글자색은 점수로 계산한 값이라
 * 테마(다크/라이트)와 무관하다(글자색은 배경 밝기에 맞춰 검정/흰색, 대비 4.5 이상).
 * 서버 컴포넌트다: 계산은 빌드/요청 시 한 번 하고, 브라우저에는 완성된 표만 간다.
 */
export function ConstantTable() {
  const rows = guideRows();
  return (
    <div className="space-y-3 rounded-xl border border-line bg-card px-2 py-3">
      <table className="w-full table-fixed border-separate border-spacing-0.5 text-center">
        <caption className="sr-only">레이팅 상수표: 슈랜플 난이도와 달성률별 채보 점수</caption>
        <colgroup>
          <col className="w-11" />
          <col className="w-9" />
          {GUIDE_RATES.map((rate) => (
            <col key={rate} />
          ))}
        </colgroup>
        <thead>
          <tr className="text-[11px] font-normal leading-tight text-fg-dim">
            <th scope="col" className="pb-1.5 font-normal">
              슈랜플
              <br />
              난이도
            </th>
            <th scope="col" className="pb-1.5 font-normal">
              내부
              <br />
              상수
            </th>
            {GUIDE_RATES.map((rate) => (
              <th key={rate} scope="col" className="pb-1.5 font-normal">
                {rate}%
                {rate === 80 ? (
                  <>
                    <br />
                    (S)
                  </>
                ) : null}
                {rate === 95 ? (
                  <>
                    <br />
                    (SS)
                  </>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.tier}>
              <th scope="row" className="font-num text-[13px] font-bold text-fg">
                {row.tier}
              </th>
              <td className="font-num text-[11px] text-fg-sub">{row.constant}</td>
              {row.cells.map((cell) => (
                // 색은 반올림 전 점수로 정한다(표에는 정수로 반올림한 값이 보이지만 서버 비교는 소수 그대로다)
                <td
                  key={cell.rate}
                  {...chartTierAttrs(chartScore(Math.round(Number(row.tier) * 10), cell.rate))}
                  className="chart-cell font-num py-1.5 text-xs font-semibold"
                >
                  {cell.score}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="space-y-2 px-1">
        <p className="text-[11px] text-fg-dim">칸 색 기준 · 곡 점수 (플레이어 티어 최소 점수 ÷ 40)</p>
        <ul className="grid grid-cols-5 gap-x-1 gap-y-1.5">
          {PLAYER_TIER_MINS.map((tier) => (
            <li key={tier.key} className="flex flex-col items-center gap-0.5">
              <span aria-hidden="true" data-tier={tier.key} className="chart-swatch block h-3 w-full max-w-9 rounded-sm" />
              <span className="font-num text-[10px] text-fg-dim">
                {chartTierStart(tier.min)}
                {tier.key === "HASUBONG" ? "~" : ""}
              </span>
              <span className="sr-only">{tier.name}</span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] leading-relaxed text-fg-dim">
          하수봉 기준({chartTierStart(9500)}점)을 넘으면 빛이 생기고, {GLOW_2_FROM}점부터 더 강해지고, {GLOW_3_FROM}점부터 가장 강해집니다(테두리 추가).
        </p>
      </div>
    </div>
  );
}
