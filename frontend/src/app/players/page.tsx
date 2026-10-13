"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { PlayerListView } from "@/components/players/PlayerListView";

/** 유저 목록 화면. 로그인한 사용자만 볼 수 있다(공개를 선택한 유저의 정보이므로). */
export default function PlayersPage() {
  const { status, user } = useAuth();

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">불러오는 중입니다.</p>;
  }
  if (status === "anonymous" || !user) {
    return (
      <section className="flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold text-fg">유저 목록</h1>
        <p className="text-sm text-fg-sub">유저 목록을 보려면 로그인해 주세요.</p>
        <Link href="/login" className="rounded-full border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head">
          로그인
        </Link>
      </section>
    );
  }
  return <PlayerListView viewerId={user.id} />;
}
