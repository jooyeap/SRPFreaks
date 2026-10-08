import Link from "next/link";

/** 관리 메뉴. 새 관리 화면이 생기면 여기에 한 줄 추가한다. */
const ITEMS: { href: string; title: string; description: string }[] = [
  { href: "/admin/users", title: "사용자", description: "사용자 목록을 보고 관리자(ADMIN) 역할을 지정하거나 해제합니다." },
  { href: "/admin/settings", title: "설정", description: "레이팅 계수, 재킷 표시, 연락처를 바꿉니다." },
  { href: "/admin/audit-logs", title: "감사 로그", description: "관리 작업 기록을 최근 순으로 봅니다." },
];

export function AdminMenu() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-fg">관리</h1>
      <ul aria-label="관리 메뉴" className="flex flex-col gap-2">
        {ITEMS.map((item) => (
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
