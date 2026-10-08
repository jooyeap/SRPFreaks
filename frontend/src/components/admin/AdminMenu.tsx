import Link from "next/link";

/** 관리 메뉴. 새 관리 화면이 생기면 여기에 한 줄 추가한다. */
const ITEMS: { href: string; title: string; description: string }[] = [
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
