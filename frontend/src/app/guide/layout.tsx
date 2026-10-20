import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

/**
 * 설명서 화면의 탭 제목. 제목은 요청한 사람의 언어로 정해야 해서 서버에서 번역한다(page.tsx는 화면만 그린다).
 * 화면 본문은 page.tsx가 `useTranslations`로 번역한다.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("Guide.metaTitle") };
}

export default function GuideLayout({ children }: { children: ReactNode }) {
  return children;
}
