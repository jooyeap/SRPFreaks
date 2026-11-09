import { formatScoreDiff } from "@/lib/rivals";
import { useTranslations } from "next-intl";

/**
 * 점수 차 칩(D65, 비교 줄과 `따라잡을 곡` 줄(D66)이 함께 쓴다). 값은 `내 점수 - 상대 점수`:
 * 앞이면 `+2.28`(초록), 뒤면 `−4.37`(주황), 같으면 `±0.00`, 내 기록이 없으면 `내 기록 없음`.
 * 부호가 글자로 보이므로 색만으로 앞뒤를 구분하지 않는다. 칩의 글자는 읽기 프로그램에도 `상대와의 점수 차 …`로 읽힌다.
 */
export function ScoreDiffChip({ diff }: { diff: number | null }) {
  const t = useTranslations("Rival");
  const formatted = formatScoreDiff(diff);
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
      aria-label={formatted ? t("diffAria", { diff: formatted.text }) : undefined}
      className={`whitespace-nowrap rounded border px-1.5 font-num text-[11px] font-bold leading-4 ${tone}`}
    >
      {formatted ? formatted.text : t("diffNone")}
    </span>
  );
}
