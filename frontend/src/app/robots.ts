import type { MetadataRoute } from "next";
import { PRIVATE_PATHS, siteUrl } from "@/lib/site";

/** 공개 화면만 검색에 허용하고, 로그인 뒤 화면은 막는다. (robots.txt는 안내일 뿐 접근 제어는 아니다. 접근 제어는 로그인과 서버 권한이 한다.) */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...PRIVATE_PATHS] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
