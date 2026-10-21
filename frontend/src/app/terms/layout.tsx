import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

/** 약관 화면의 탭 제목(요청한 사람의 언어). 본문은 page.tsx가 번역한다. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("Terms.metaTitle") };
}

export default function TermsLayout({ children }: { children: ReactNode }) {
  return children;
}
