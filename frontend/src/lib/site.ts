/**
 * 사이트 주소(robots·sitemap에 쓴다). 기본값은 운영 주소이고, 다른 주소에서 띄울 때만 NEXT_PUBLIC_SITE_URL로 바꾼다.
 * 끝의 슬래시는 지운다. (process.env.NEXT_PUBLIC_... 를 이 이름 그대로 써야 Next가 빌드 때 값으로 바꿔 넣는다)
 */
export function siteUrl(): string {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (value || "https://srpfreaks.com").replace(/\/+$/, "");
}

/** 검색에 보여도 되는 공개 화면. 로그인해야 쓰는 화면은 넣지 않는다. */
export const PUBLIC_PATHS = ["/", "/guide", "/privacy", "/terms"] as const;

/** 로그인 뒤에 쓰는 화면과 API. 검색엔진이 들어오지 않게 robots.txt에서 막는다. */
export const PRIVATE_PATHS = [
  "/admin",
  "/api",
  "/import",
  "/me",
  "/notices",
  "/players",
  "/settings",
  "/songs",
  "/suggestions",
  "/table",
] as const;
