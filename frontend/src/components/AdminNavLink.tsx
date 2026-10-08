"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { canSeeAdminMenu } from "@/lib/admin";

/** 데스크톱 헤더의 메뉴 글자 모양. 모바일 슬라이드 메뉴는 className으로 자기 모양을 넘긴다. */
export const DESKTOP_LINK_CLASS = "whitespace-nowrap text-sm text-fg-sub hover:text-fg";

/**
 * 헤더 주 메뉴의 `관리` 항목. ADMIN과 ROOT에게만 보이고 USER·비로그인에게는 아무것도 그리지 않는다.
 * 헤더 자체는 서버 컴포넌트라 역할을 알 수 없어서, 역할을 아는 이 작은 조각만 클라이언트 컴포넌트로 뒀다.
 * 화면을 보이게 하는 조건일 뿐이고, 관리 기능의 권한은 서버가 API마다 검사한다.
 */
export function AdminNavLink({ className = DESKTOP_LINK_CLASS, ...rest }: { className?: string; onClick?: () => void }) {
  const { status, user } = useAuth();
  if (status !== "authenticated" || !canSeeAdminMenu(user?.role)) {
    return null;
  }
  return (
    <Link href="/admin" className={className} {...rest}>
      관리
    </Link>
  );
}
