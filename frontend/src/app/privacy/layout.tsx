import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

/** 처리방침 화면의 탭 제목(요청한 사람의 언어). 본문은 page.tsx가 번역한다. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("Privacy.metaTitle") };
}

export default function PrivacyLayout({ children }: { children: ReactNode }) {
  return children;
}
