"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AdminMenuIcon } from "@/components/admin/AdminMenuIcon";
import { hasRoleAtLeast, visibleAdminMenuGroups } from "@/lib/admin";
import type { Role } from "@/lib/api-types";
import { fetchReceivedCount, suggestionKeys } from "@/lib/suggestions";

/** 배지에 보이는 개수의 상한. 이보다 많으면 `99+`로 줄인다(줄 안에 들어가게). 화면 읽기 프로그램에는 실제 개수를 읽어 준다. */
const BADGE_MAX = 99;

/**
 * 관리 메뉴(D78). 콘텐츠 / 운영 / 시스템 세 묶음으로 나누고, 역할에 맞는 항목만 보여 준다.
 * 보일 항목이 없는 묶음은 통째로 빠진다(ADMIN에게는 시스템 묶음이 없다). 휴대폰은 1열, 1024px 이상은 묶음마다 한 열(최대 3열)이다.
 * 건의 관리 줄에는 접수 대기 개수 배지가 붙는다(기존 `GET /admin/suggestions/received-count`, 건의 관리 화면과 같은 캐시를 쓴다).
 * 이 화면은 보이게 하는 조건일 뿐이고 권한은 서버가 API마다 다시 검사한다.
 */
export function AdminMenu({ role, viewerId }: { role: Role; viewerId: number }) {
  const t = useTranslations();
  const groups = visibleAdminMenuGroups(role);
  // 건의 관리가 보이는 역할(ADMIN 이상)에게만 개수를 받는다. 개수를 못 받아도 메뉴는 그대로 보인다(배지만 없다).
  const countQuery = useQuery({
    queryKey: suggestionKeys.receivedCount(viewerId),
    queryFn: ({ signal }) => fetchReceivedCount(signal),
    enabled: hasRoleAtLeast(role, "ADMIN"),
  });
  const received = countQuery.data?.received ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-fg">{t("Admin.title")}</h1>
      <nav aria-label={t("Admin.menuAria")} className="grid gap-5 lg:grid-cols-3 lg:items-start">
        {groups.map((group) => {
          const headingId = `admin-group-${group.id}`;
          return (
            <section key={group.id} aria-labelledby={headingId} className="flex min-w-0 flex-col gap-2">
              {/* 높이를 고정한다: ROOT 칩이 있는 제목만 높아져서 3열에서 카드가 어긋나 보이지 않게 */}
              <h2 id={headingId} className="flex h-6 items-center gap-2 px-1 text-xs font-bold text-fg-sub">
                {t(group.titleKey)}
                {group.rootChip ? (
                  // 역할 이름 그대로(ROOT). 이 묶음의 항목은 모두 ROOT만 볼 수 있다는 표시다. 글자가 있어서 색만으로 뜻을 전하지 않는다.
                  <span className="rounded-full border border-chip-line px-2 py-0.5 text-[11px] font-bold leading-none text-fg-sub">ROOT</span>
                ) : null}
              </h2>
              <ul className="flex flex-col gap-2">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 hover:bg-table-head"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-table-head text-fg-sub">
                        <AdminMenuIcon name={item.icon} />
                      </span>
                      {/* 설명은 한 줄이고 길면 말줄임(…)이다. 전체 글은 title로도 볼 수 있다. */}
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-sm font-bold text-fg">{t(item.titleKey)}</span>
                        <span className="truncate text-xs text-fg-sub" title={t(item.descriptionKey)}>
                          {t(item.descriptionKey)}
                        </span>
                      </span>
                      {item.href === "/admin/suggestions" && received > 0 ? (
                        <span className="shrink-0">
                          <span
                            aria-hidden="true"
                            className="inline-flex min-w-6 items-center justify-center rounded-full bg-chip-on-bg px-2 py-0.5 text-xs font-bold leading-none text-chip-on-fg font-num"
                          >
                            {received > BADGE_MAX ? `${BADGE_MAX}+` : received}
                          </span>
                          {/* 접수 대기 개수를 글자로도 전한다(기존 문구 Admin.receivedCount 재사용) */}
                          <span className="sr-only">{t.markup("Admin.receivedCount", { count: received, n: (chunks) => chunks })}</span>
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </nav>
    </div>
  );
}
