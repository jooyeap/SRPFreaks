"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

/**
 * 가입 직후(닉네임이 아직 없을 때) 설정을 안내하는 한 줄. 안내만 하고 다른 화면을 막지 않는다 (docs/DESIGN.md "닉네임 규칙").
 * 이미 설정 화면에 있으면 보이지 않는다.
 */
export function NicknameNotice() {
  const { status, user } = useAuth();
  const pathname = usePathname();

  if (status !== "authenticated" || !user || user.nickname || pathname === "/settings") {
    return null;
  }
  return (
    <p className="border-b border-line bg-table-head px-4 py-2 text-center text-sm text-fg-sub">
      닉네임을 설정해 주세요.{" "}
      <Link href="/settings" className="font-semibold text-fg underline">
        설정하기
      </Link>
    </p>
  );
}
