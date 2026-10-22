import Link from "next/link";
import { ADMIN_MENU_ITEMS, hasRoleAtLeast } from "@/lib/admin";
import type { Role } from "@/lib/api-types";
import { useTranslations } from "next-intl";

/** 관리 메뉴. 역할에 맞는 항목만 보여 준다(ADMIN: 곡·서열표 관리, ROOT: 거기에 사용자·설정·감사 로그). */
export function AdminMenu({ role }: { role: Role }) {
  const t = useTranslations();
  const items = ADMIN_MENU_ITEMS.filter((item) => hasRoleAtLeast(role, item.minRole));
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-fg">{t("Admin.title")}</h1>
      <ul aria-label={t("Admin.menuAria")} className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="flex flex-col gap-0.5 rounded-2xl border border-line bg-card px-4 py-3 hover:bg-table-head">
              <span className="text-sm font-bold text-fg">{t(item.titleKey)}</span>
              <span className="text-xs text-fg-sub">{t(item.descriptionKey)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
