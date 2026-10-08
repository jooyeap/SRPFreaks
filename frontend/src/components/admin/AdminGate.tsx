"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "@/components/AuthProvider";

/**
 * 관리 화면 공통 문지기: 불러오는 중 / 로그인 안 함 / ROOT가 아님을 걸러 내고, 통과하면 보는 사람의 id를 넘긴다.
 * 이 검사는 화면을 숨기는 용도일 뿐이고, 실제 권한은 서버가 API마다 다시 검사한다(ROOT가 아니면 403).
 */
export function AdminGate({ title, children }: { title: string; children: (viewerId: number) => ReactNode }) {
  const { status, user } = useAuth();

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">불러오는 중입니다.</p>;
  }
  if (status === "anonymous" || !user) {
    return (
      <section className="flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold text-fg">{title}</h1>
        <p className="text-sm text-fg-sub">관리 화면을 보려면 로그인해 주세요.</p>
        <Link href="/login" className="rounded-full border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head">
          로그인
        </Link>
      </section>
    );
  }
  if (user.role !== "ROOT") {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-fg">{title}</h1>
        <p role="alert" className="text-sm text-fg">
          권한이 없습니다.
        </p>
      </section>
    );
  }
  return <>{children(user.id)}</>;
}
