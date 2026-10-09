import {
  guideRows,
  GUIDE_RATES,
  legendGradient,
  legendTicks,
  rgbCss,
  scoreColor,
  textColorOn,
} from "@/lib/rating-guide";

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
              {row.cells.map((cell) => {
                const bg = scoreColor(cell.score);
                return (
                  <td
                    key={cell.rate}
                    style={{ backgroundColor: rgbCss(bg), color: textColorOn(bg) }}
                    className="font-num py-1.5 text-xs font-semibold"
                  >
                    {cell.score}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div aria-hidden="true" className="space-y-1 px-1">
        <span className="block h-2 rounded" style={{ backgroundImage: legendGradient() }} />
        <div className="font-num flex justify-between text-[10px] text-fg-dim">
          {legendTicks().map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
