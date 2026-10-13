"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { RatingView } from "@/components/rating/RatingView";

/** 레이팅 화면. 내 기록으로 계산하므로 로그인이 필요하다. */
export default function RatingPage() {
  const { status, user } = useAuth();

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">불러오는 중입니다.</p>;
  }
  if (status === "anonymous" || !user) {
    return (
      <section className="flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold text-fg">레이팅</h1>
        <p className="text-sm text-fg-sub">내 레이팅을 보려면 로그인해 주세요.</p>
        <Link href="/login" className="rounded-full border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head">
          로그인
        </Link>
      </section>
    );
  }
  return <RatingView userId={user.id} />;
}
