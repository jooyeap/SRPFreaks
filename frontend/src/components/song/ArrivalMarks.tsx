import { useTranslations } from "next-intl";

/**
 * 서열표 변경 알림(D61)에서 곡 상세로 왔을 때 값 옆에 붙는 표시.
 * 색만으로 전달하지 않도록 이전 값은 취소선 + 화면 읽기용 "이전 값", 칩은 `변경` 글자를 쓴다.
 */
export function ArrivalBefore({ text }: { text: string }) {
  const t = useTranslations();
  return (
    <>
      <span aria-hidden="true" className="text-[13px] font-semibold text-fg-faint line-through">
        {text}
      </span>
      <span className="sr-only">{t("Song.arriveBefore", { value: text })}</span>
    </>
  );
}

export function ArrivalChip() {
  const t = useTranslations();
  return (
    <span className="ml-1 rounded border border-arrive-ring bg-arrive-bg px-1.5 py-px font-sans text-[10px] font-bold leading-4 text-arrive-fg">
      {t("Song.arriveChanged")}
    </span>
  );
}
