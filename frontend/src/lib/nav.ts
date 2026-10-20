/** 메뉴 아이콘 이름. 그림은 components/NavIcon.tsx가 이름으로 찾아 그린다. */
export type NavIconName =
  "home" | "songs" | "table" | "rating" | "players" | "guide" | "notices" | "suggestions" | "admin" | "more" | "import";

/** "곡" 메뉴가 담당하는 경로. 이 아래의 어느 화면에서도 곡 메뉴가 강조된다. */
export const SONG_PATHS: readonly string[] = ["/songs", "/table"];

/**
 * 데스크톱(lg 이상) 헤더의 가로 메뉴 항목. 순서는 시안을 따른다(홈 · 곡 · 유저 · 공지 · 건의 · 설명서 … 마이페이지).
 * `관리`는 역할에 따라 보이므로 DesktopNav가 마이페이지 앞에 AdminNavLink로 따로 넣는다.
 */
export const DESKTOP_NAV_ITEMS: readonly {
  href: string;
  label: string;
  match?: readonly string[];
}[] = [
  { href: "/", label: "홈" },
  // 곡 목록과 서열표는 한 메뉴(곡)로 합쳤다. 두 화면(과 곡 상세·서열표 폴더) 모두에서 이 메뉴가 강조된다
  { href: "/table", label: "곡", match: SONG_PATHS },
  { href: "/players", label: "유저" },
  { href: "/notices", label: "공지" },
  { href: "/suggestions", label: "건의" },
  { href: "/guide", label: "설명서" },
];

/** 가로 메뉴 맨 끝의 마이페이지 */
export const MY_PAGE_ITEM = { href: "/me", label: "마이페이지" } as const;

/**
 * lg 미만 화면 하단 탭바의 링크 항목(홈 · 곡 · 마이). 네 번째 칸 `더보기`는 링크가 아니라 시트를 여는 버튼이라 MobileTabBar가 따로 그린다.
 * label은 탭에 보이는 짧은 글자, name은 화면 읽기 프로그램용 전체 이름이다(보이는 글자가 name에 들어 있다).
 */
export const TAB_ITEMS: readonly {
  href: string;
  label: string;
  name: string;
  icon: NavIconName;
  match?: readonly string[];
}[] = [
  { href: "/", label: "홈", name: "홈", icon: "home" },
  { href: "/table", label: "곡", name: "곡", icon: "songs", match: SONG_PATHS },
  { href: "/me", label: "마이", name: "마이페이지", icon: "rating" },
];

/** 하단 탭바 `더보기` 시트의 항목. 자주 쓰지 않는 화면을 모았다. */
export const MORE_ITEMS: readonly {
  href: string;
  label: string;
  badge?: string;
}[] = [
  { href: "/import", label: "최근 플레이 가져오기", badge: "추천" },
  { href: "/notices", label: "공지" },
  { href: "/players", label: "유저" },
  { href: "/suggestions", label: "건의" },
  { href: "/guide", label: "설명서" },
  { href: "/settings", label: "설정" },
];

/** 주 메뉴 항목. lg 미만 화면의 슬라이드 메뉴(MobileMenu)가 이 목록을 쓴다. `관리`는 역할에 따라 보이므로 AdminNavLink가 따로 맡는다. */
export const NAV_ITEMS: readonly {
  href: string;
  label: string;
  icon: NavIconName;
  match?: readonly string[];
}[] = [
  { href: "/table", label: "곡", icon: "songs", match: SONG_PATHS },
  { href: "/me", label: "마이페이지", icon: "rating" },
  { href: "/players", label: "유저", icon: "players" },
  { href: "/guide", label: "설명서", icon: "guide" },
  { href: "/notices", label: "공지", icon: "notices" },
  { href: "/suggestions", label: "건의", icon: "suggestions" },
];
