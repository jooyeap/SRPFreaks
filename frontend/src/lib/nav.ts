/** 메뉴 아이콘 이름. 그림은 components/NavIcon.tsx가 이름으로 찾아 그린다. */
export type NavIconName = "songs" | "table" | "rating" | "players" | "guide" | "notices" | "admin";

/** 주 메뉴 항목. 모든 화면 폭에서 슬라이드 메뉴(MobileMenu)가 이 목록을 쓴다. `관리`는 역할에 따라 보이므로 AdminNavLink가 따로 맡는다. */
export const NAV_ITEMS: readonly { href: string; label: string; icon: NavIconName }[] = [
  { href: "/songs", label: "곡 목록", icon: "songs" },
  { href: "/table", label: "서열표", icon: "table" },
  { href: "/rating", label: "레이팅", icon: "rating" },
  { href: "/players", label: "유저", icon: "players" },
  { href: "/guide", label: "설명서", icon: "guide" },
  { href: "/notices", label: "공지", icon: "notices" },
];
