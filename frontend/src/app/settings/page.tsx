"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { NicknameForm } from "@/components/settings/NicknameForm";

/** 설정 화면. 지금은 닉네임만 바꿀 수 있다. 내 정보이므로 로그인이 필요하다. */
export default function SettingsPage() {
  const { status, user } = useAuth();

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">불러오는 중입니다.</p>;
  }
  if (status === "anonymous" || !user) {
    return (
      <section className="flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold text-fg">설정</h1>
        <p className="text-sm text-fg-sub">설정을 바꾸려면 로그인해 주세요.</p>
        <Link href="/login" className="rounded-full border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head">
          로그인
        </Link>
      </section>
    );
  }
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-5">
      <h1 className="text-xl font-semibold text-fg">설정</h1>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-fg">이메일</span>
        <span className="text-sm text-fg-sub">{user.email}</span>
      </div>
      <NicknameForm initialNickname={user.nickname} />
    </section>
  );
}
