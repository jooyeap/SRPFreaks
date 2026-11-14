import type { AdminMenuIconName } from "@/lib/admin";

/** 관리 메뉴 줄의 24x24 선 아이콘(외부 라이브러리 없이 직접 그린다). 글자 옆 장식이라 화면 읽기 프로그램에는 숨긴다(aria-hidden). */
const PATHS: Record<AdminMenuIconName, string> = {
  songs: "M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z",
  table: "M3 3h18v18H3zM3 9h18M3 15h18M9 3v18",
  chartStats: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  songImport: "M12 3v12M7 10l5 5 5-5M5 21h14",
  suggestions: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  users: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8",
  settings: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  auditLogs: "M9 3h6a1 1 0 011 1v2H8V4a1 1 0 011-1zM8 5H6a1 1 0 00-1 1v14a1 1 0 001 1h12a1 1 0 001-1V6a1 1 0 00-1-1h-2M9 12h6M9 16h6",
};

export function AdminMenuIcon({ name, className = "h-5 w-5" }: { name: AdminMenuIconName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
