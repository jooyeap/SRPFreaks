"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { NoticeDetailView } from "@/components/notices/NoticeDetailView";
import { canSeeAdminMenu } from "@/lib/admin";
import { parseId } from "@/lib/songs";

/** 공지 상세 화면: /notices/{id}. 주소의 값은 사용자가 바꿀 수 있으므로 올바른 숫자인지 먼저 검사한다. */
export default function NoticeDetailPage() {
  const params = useParams<{ id: string }>();
  const { status, user } = useAuth();

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">불러오는 중입니다.</p>;
  }
  if (status === "anonymous" || !user) {
    return (
      <section className="flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold text-fg">공지사항</h1>
        <p className="text-sm text-fg-sub">공지사항을 보려면 로그인해 주세요.</p>
        <Link href="/login" className="min-h-11 rounded-lg border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head">
          로그인
        </Link>
      </section>
    );
  }
  const noticeId = parseId(params.id);
  if (noticeId === null) {
    return <p role="alert" className="text-sm text-fg">공지사항을 찾을 수 없습니다.</p>;
  }
  return <NoticeDetailView viewerId={user.id} noticeId={noticeId} canWrite={canSeeAdminMenu(user.role)} />;
}
