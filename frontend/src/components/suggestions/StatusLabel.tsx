import type { SuggestionStatus } from "@/lib/api-types";
import { STATUS_LABELS } from "@/lib/suggestions";
import { useTranslations } from "next-intl";

/** 처리 상태 표시. 색만으로 구분하지 않고 항상 글자를 같이 보여 준다. */
export function StatusLabel({ status }: { status: SuggestionStatus }) {
  const t = useTranslations();
  return (
    <span className="shrink-0 rounded-full border border-chip-line px-2 py-0.5 text-xs text-fg-sub">
      {t(STATUS_LABELS[status])}
    </span>
  );
}
