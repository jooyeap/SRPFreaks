import type { RivalPatternSummary } from "@/lib/api-types";
import { patternLabel } from "@/lib/chart-labels";
import { winRate } from "@/lib/rival-charts";
import { formatRateDiff } from "@/lib/rivals";
import { useTranslations } from "next-intl";

/**
 * 점 분포·레이더의 값을 읽기 프로그램용 표로 한 번 더 준다(화면에서는 숨김, 감싼 상자가 sr-only).
 * 도형(SVG)은 role="img" 하나로 읽히므로, 속성별 숫자는 이 표로 읽는다. 값은 서버가 센 승·무·패·접전·평균 달성률 차 그대로(판정은 달성률 차 기준, D67 개정)이고 승률만 승 ÷ 공유 곡이다.
 */
export function RivalChartTable({ patterns }: { patterns: readonly RivalPatternSummary[] }) {
  const t = useTranslations();
  // 표 자체에 sr-only를 주면 표가 글자 폭만큼 펴져 화면 밖으로 삐져나와 가로 스크롤이 생긴다(측정으로 확인). 1px 상자로 감싸 잘라 낸다.
  return (
    <div className="sr-only">
    <table>
      <caption>{t("Rival.tableCaption")}</caption>
      <thead>
        <tr>
          <th scope="col">{t("Rival.colPattern")}</th>
          <th scope="col">{t("Rival.colWin")}</th>
          <th scope="col">{t("Rival.colTie")}</th>
          <th scope="col">{t("Rival.colLose")}</th>
          <th scope="col">{t("Rival.colClose")}</th>
          <th scope="col">{t("Rival.colSum")}</th>
          <th scope="col">{t("Rival.colShared")}</th>
          <th scope="col">{t("Rival.colRate")}</th>
        </tr>
      </thead>
      <tbody>
        {patterns.map((p) => {
          const rate = winRate(p);
          return (
            <tr key={p.key}>
              <th scope="row">{patternLabel(p.pattern, t)}</th>
              <td>{p.wins}</td>
              <td>{p.ties}</td>
              <td>{p.losses}</td>
              <td>{p.closeCount}</td>
              <td>{p.sharedCount === 0 ? "–" : (formatRateDiff(p.rateDiffAvg) ?? "–")}</td>
              <td>{p.sharedCount}</td>
              <td>{rate === null ? "–" : `${Math.round(rate * 100)}%`}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}
