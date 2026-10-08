import Link from "next/link";
import { ADMIN_MENU_ITEMS, hasRoleAtLeast } from "@/lib/admin";
import type { Role } from "@/lib/api-types";

/** 관리 메뉴. 역할에 맞는 항목만 보여 준다(ADMIN: 곡·서열표 관리, ROOT: 거기에 사용자·설정·감사 로그). */
export function AdminMenu({ role }: { role: Role }) {
  const items = ADMIN_MENU_ITEMS.filter((item) => hasRoleAtLeast(role, item.minRole));
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-fg">관리</h1>
      <ul aria-label="관리 메뉴" className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="flex flex-col gap-0.5 rounded-[14px] border border-line bg-card px-4 py-3 hover:bg-table-head">
              <span className="text-sm font-bold text-fg">{item.title}</span>
              <span className="text-xs text-fg-sub">{item.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
