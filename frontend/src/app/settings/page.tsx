"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { NicknameForm } from "@/components/settings/NicknameForm";

/** 설정 화면: 계정 정보, 닉네임, 로그아웃, 탈퇴로 가는 링크. 내 정보이므로 로그인이 필요하다. */
export default function SettingsPage() {
  const { status, user, logout } = useAuth();

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
  const card = "flex flex-col gap-3 rounded-[14px] border border-line bg-card p-4";
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-3">
      <h1 className="text-xl font-semibold text-fg">설정</h1>
      <section aria-label="계정" className={card}>
        <h2 className="text-xs font-bold text-fg-sub">계정</h2>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-fg-sub">로그인 방식</span>
          <span className="font-bold text-fg">Google</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="shrink-0 text-fg-sub">이메일</span>
          <span className="min-w-0 truncate font-bold text-fg">{user.email}</span>
        </div>
        <p className="text-xs leading-relaxed text-fg-dim">비밀번호는 저장하지 않습니다. 로그인은 Google 계정으로만 합니다.</p>
      </section>
      <section aria-label="닉네임 설정" className={card}>
        <NicknameForm initialNickname={user.nickname} />
      </section>
      <section aria-label="로그인 상태" className={card}>
        <h2 className="text-xs font-bold text-fg-sub">로그인 상태</h2>
        <button
          type="button"
          onClick={() => void logout()}
          className="h-11 rounded-xl border border-chip-line text-sm font-bold text-fg-sub hover:text-fg"
        >
          로그아웃
        </button>
      </section>
      <section aria-label="회원 탈퇴" className="flex flex-col gap-3 rounded-[14px] border border-danger bg-card p-4">
        <h2 className="text-xs font-bold text-danger">회원 탈퇴</h2>
        <p className="text-xs leading-relaxed text-fg-sub">탈퇴하면 계정과 모든 기록이 바로 삭제되고 되돌릴 수 없습니다.</p>
        <Link
          href="/settings/withdraw"
          className="flex h-11 items-center justify-center rounded-xl border border-danger text-sm font-extrabold text-danger hover:bg-table-head"
        >
          탈퇴하기
        </Link>
      </section>
    </section>
  );
}
