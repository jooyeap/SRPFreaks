"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { TierFolderView } from "@/components/table/TierFolderView";

/** 서열표 묶음 화면: /table/folder/{기준 난이도 | undecided}. 내 기록을 함께 보여 주므로 로그인이 필요하다. */
export default function TierFolderPage() {
  const params = useParams<{ tier: string }>();
  const { status, user } = useAuth();

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">불러오는 중입니다.</p>;
  }
  if (status === "anonymous" || !user) {
    return (
      <section className="flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold text-fg">서열표 묶음</h1>
        <p className="text-sm text-fg-sub">내 기록과 함께 보려면 로그인해 주세요.</p>
        <Link href="/login" className="rounded-full border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head">
          로그인
        </Link>
      </section>
    );
  }
  // 주소의 값은 사용자가 바꿀 수 있으므로 그대로 비교만 한다(숫자로 해석하지 않는다). 없는 값이면 "묶음을 찾을 수 없습니다."
  return <TierFolderView userId={user.id} param={decodeURIComponent(params.tier)} />;
}
