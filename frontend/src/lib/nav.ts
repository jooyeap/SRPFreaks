/** 메뉴 아이콘 이름. 그림은 components/NavIcon.tsx가 이름으로 찾아 그린다. */
export type NavIconName = "home" | "songs" | "table" | "rating" | "players" | "guide" | "notices" | "suggestions" | "admin";

/**
 * 데스크톱(lg 이상) 헤더의 가로 메뉴 항목. 순서는 시안을 따른다(홈 · 곡 목록 · 서열표 · 유저 · 공지 · 건의 · 설명서 … 마이페이지).
 * `관리`는 역할에 따라 보이므로 DesktopNav가 마이페이지 앞에 AdminNavLink로 따로 넣는다.
 */
export const DESKTOP_NAV_ITEMS: readonly { href: string; label: string }[] = [
  { href: "/", label: "홈" },
  { href: "/songs", label: "곡 목록" },
  { href: "/table", label: "서열표" },
  { href: "/players", label: "유저" },
  { href: "/notices", label: "공지" },
  { href: "/suggestions", label: "건의" },
  { href: "/guide", label: "설명서" },
];

/** 가로 메뉴 맨 끝의 마이페이지 */
export const MY_PAGE_ITEM = { href: "/me", label: "마이페이지" } as const;

/**
 * lg 미만 화면 하단 탭바 항목(홈 · 곡 · 서열표 · 마이). 자주 쓰는 네 곳만 두고 나머지는 ☰ 슬라이드 메뉴에 남긴다.
 * label은 탭에 보이는 짧은 글자, name은 화면 읽기 프로그램용 전체 이름이다(보이는 글자가 name에 들어 있다).
 */
export const TAB_ITEMS: readonly { href: string; label: string; name: string; icon: NavIconName }[] = [
  { href: "/", label: "홈", name: "홈", icon: "home" },
  { href: "/songs", label: "곡", name: "곡 목록", icon: "songs" },
  { href: "/table", label: "서열표", name: "서열표", icon: "table" },
  { href: "/me", label: "마이", name: "마이페이지", icon: "rating" },
];

/** 주 메뉴 항목. lg 미만 화면의 슬라이드 메뉴(MobileMenu)가 이 목록을 쓴다. `관리`는 역할에 따라 보이므로 AdminNavLink가 따로 맡는다. */
export const NAV_ITEMS: readonly { href: string; label: string; icon: NavIconName }[] = [
  { href: "/songs", label: "곡 목록", icon: "songs" },
  { href: "/table", label: "서열표", icon: "table" },
  { href: "/me", label: "마이페이지", icon: "rating" },
  { href: "/players", label: "유저", icon: "players" },
  { href: "/guide", label: "설명서", icon: "guide" },
  { href: "/notices", label: "공지", icon: "notices" },
  { href: "/suggestions", label: "건의", icon: "suggestions" },
];
