"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { NoticesView } from "@/components/notices/NoticesView";
import { canSeeAdminMenu } from "@/lib/admin";

/** 공지사항 화면: /notices. 로그인한 사용자만 읽고, ADMIN·ROOT는 쓰기·고치기·삭제도 한다. */
export default function NoticesPage() {
  const { status, user } = useAuth();

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">불러오는 중입니다.</p>;
  }
  if (status === "anonymous" || !user) {
    return (
      <section className="flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold text-fg">공지사항</h1>
        <p className="text-sm text-fg-sub">공지사항을 보려면 로그인해 주세요.</p>
        <Link href="/login" className="rounded-full border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head">
          로그인
        </Link>
      </section>
    );
  }
  return <NoticesView viewerId={user.id} canWrite={canSeeAdminMenu(user.role)} />;
}
