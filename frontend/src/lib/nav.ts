/** 주 메뉴 항목. 데스크톱 헤더와 모바일 슬라이드 메뉴가 같은 목록을 쓴다(한쪽만 고쳐 어긋나는 일을 막는다). `관리`는 역할에 따라 보이므로 AdminNavLink가 따로 맡는다. */
export const NAV_ITEMS = [
  { href: "/songs", label: "곡 목록" },
  { href: "/table", label: "서열표" },
  { href: "/rating", label: "레이팅" },
  { href: "/players", label: "유저" },
] as const;
