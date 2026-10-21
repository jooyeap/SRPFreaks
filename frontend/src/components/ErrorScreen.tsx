"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/**
 * 404·오류 화면이 같이 쓰는 모양. 제목, 안내 한 줄, 버튼 자리만 있다.
 * 오류 내용(메시지·스택)은 사용자에게 보여 주지 않는다 (값이나 내부 정보가 섞일 수 있어서). 원인은 서버 로그로 본다.
 */
export function ErrorScreen({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <section role="alert" className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-fg">{title}</h1>
      <p className="text-sm text-fg-sub">{body}</p>
      <div className="flex gap-2">{children}</div>
    </section>
  );
}

/** 홈으로 가는 버튼 모양 링크 (두 화면에서 같이 쓴다). */
export function HomeLink() {
  const t = useTranslations("ErrorPage");
  return (
    <Link
      href="/"
      className="rounded-md border border-line bg-card px-4 py-2 text-sm text-fg hover:bg-table-head"
    >
      {t("goHome")}
    </Link>
  );
}
