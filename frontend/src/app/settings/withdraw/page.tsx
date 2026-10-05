"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { WithdrawForm } from "@/components/settings/WithdrawForm";

/** 회원 탈퇴 확인 화면. 내 계정을 지우는 화면이므로 로그인이 필요하다. */
export default function WithdrawPage() {
  const { status, user } = useAuth();

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">불러오는 중입니다.</p>;
  }
  if (status === "anonymous" || !user) {
    return (
      <section className="flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold text-fg">회원 탈퇴</h1>
        <p className="text-sm text-fg-sub">탈퇴하려면 로그인해 주세요.</p>
        <Link href="/login" className="rounded-full border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head">
          로그인
        </Link>
      </section>
    );
  }
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="text-sm text-fg-sub hover:text-fg">
          &#9666; 설정
        </Link>
        <h1 className="text-xl font-semibold text-fg">회원 탈퇴</h1>
      </div>
      <WithdrawForm />
    </section>
  );
}
