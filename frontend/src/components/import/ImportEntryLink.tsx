import Link from "next/link";
import { useTranslations } from "next-intl";

/**
 * 최근 플레이 가져오기(/import)로 바로 가는 안내 카드. 홈과 마이페이지에서 같이 쓴다.
 * 눈에 띄되 레이팅 등 주요 칸을 밀어내지 않도록 한 줄 요약 + 이동 링크만 둔다.
 */
export function ImportEntryLink() {
  const t = useTranslations();
  return (
    <Link
      href="/import"
      className="flex items-center justify-between gap-3 rounded-2xl border border-chip-line bg-card p-4 hover:bg-table-head"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-bold text-fg">{t("Import.title")}</span>
        <span className="text-xs text-fg-sub">{t("Import.entryLead")}</span>
      </span>
      <span aria-hidden="true" className="shrink-0 text-sm font-bold text-fg">→</span>
    </Link>
  );
}
