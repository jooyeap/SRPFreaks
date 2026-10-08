"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { canSeeAdminMenu } from "@/lib/admin";

/**
 * 헤더 주 메뉴의 `관리` 항목. ADMIN과 ROOT에게만 보이고 USER·비로그인에게는 아무것도 그리지 않는다.
 * 헤더 자체는 서버 컴포넌트라 역할을 알 수 없어서, 역할을 아는 이 작은 조각만 클라이언트 컴포넌트로 뒀다.
 * 화면을 보이게 하는 조건일 뿐이고, 관리 기능의 권한은 서버가 API마다 검사한다.
 */
export function AdminNavLink() {
  const { status, user } = useAuth();
  if (status !== "authenticated" || !canSeeAdminMenu(user?.role)) {
    return null;
  }
  return (
    <Link
      href="/admin"
      className="flex-1 whitespace-nowrap rounded-xl border border-line py-1.5 text-center text-sm font-semibold text-fg-sub hover:text-fg sm:flex-none sm:border-0 sm:py-0 sm:font-normal"
    >
      관리
    </Link>
  );
}
