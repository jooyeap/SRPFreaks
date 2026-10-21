import type { MetadataRoute } from "next";
import { PUBLIC_PATHS, siteUrl } from "@/lib/site";

/** 검색엔진에 알려 줄 공개 화면 목록. 로그인해야 보는 화면과 곡·유저 상세는 넣지 않는다. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PUBLIC_PATHS.map((path) => ({ url: path === "/" ? base : `${base}${path}` }));
}
