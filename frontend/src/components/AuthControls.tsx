"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

/** 헤더 오른쪽: 로그인 여부에 따라 로그인 링크 / 닉네임(또는 이메일)과 로그아웃 버튼. */
export function AuthControls() {
  const { status, user, logout } = useAuth();

  if (status === "loading") {
    return null; // 복구 중에 "로그인" 버튼이 잠깐 보였다 사라지는 깜빡임을 막는다
  }
  if (status === "anonymous" || !user) {
    return (
      <Link href="/login" className="rounded-full border border-chip-line px-3 py-1 text-sm text-fg-sub hover:text-fg">
        로그인
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="max-w-[10rem] truncate text-sm text-fg-sub">{user.nickname ?? user.email}</span>
      <button
        type="button"
        onClick={() => void logout()}
        className="rounded-full border border-chip-line px-3 py-1 text-sm text-fg-sub hover:text-fg"
      >
        로그아웃
      </button>
    </div>
  );
}
