"use client";

import { useTranslations } from "next-intl";
import { useMediaQuery } from "@/lib/use-media-query";

/**
 * 곡 검색창의 안내 글자. sm(640px) 미만에서는 긴 문구 끝이 잘려 `…로마자`처럼 보여서 짧은 문구를 쓴다(2026-10-27).
 * 어떤 글자로 찾을 수 있는지(한글·일본어·로마자)는 넓은 화면의 안내 글자와 서열표 검색창 아래 안내 문장에 남아 있다.
 */
export function useSearchPlaceholder(): string {
  const t = useTranslations("Songs");
  const wide = useMediaQuery("(min-width: 640px)");
  return wide ? t("searchPlaceholder") : t("searchPlaceholderShort");
}
