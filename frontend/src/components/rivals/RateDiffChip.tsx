import { formatRateGap } from "@/lib/rivals";
import { useTranslations } from "next-intl";

/**
 * 달성률 차 칩(D65·D66·D67 개정, 2026-11-09. 예전 `ScoreDiffChip`의 점수 차를 달성률 차로 바꿨다). 비교 줄과 `따라잡을 곡` 줄, 대시보드 곡 미리보기가 함께 쓴다.
 * 값은 `내 달성률 − 상대 달성률`(둘째 자리): 앞이면 `+1.84%`(초록), 뒤면 `−2.10%`(주황), 같으면 `±0.00%`, 내 기록이 없으면 `내 기록 없음`.
 * 부호가 글자로 보이므로 색만으로 앞뒤를 구분하지 않는다. 칩의 글자는 읽기 프로그램에도 `상대와의 달성률 차 …`로 읽힌다. 모양(테두리·색·크기)은 점수 차 칩과 같다.
 * 승·무·패 판정과 정렬은 점수 기준이라(서버) 이 칩의 값과 어긋날 수 있다.
 */
export function RateDiffChip({ myRate, rate }: { myRate: number | null; rate: number | null }) {
  const t = useTranslations("Rival");
  const formatted = formatRateGap(myRate, rate);
  const tone =
    formatted?.sign === "up"
      ? "border-done text-done-text"
      : formatted?.sign === "down"
        ? "border-weak text-weak-text"
        : formatted
          ? "border-chip-line text-fg-sub"
          : "border-line text-fg-dim";
  return (
    <span
      aria-label={formatted ? t("rateDiffAria", { diff: formatted.text }) : undefined}
      className={`whitespace-nowrap rounded border px-1.5 font-num text-[11px] font-bold leading-4 ${tone}`}
    >
      {formatted ? formatted.text : t("diffNone")}
    </span>
  );
}
