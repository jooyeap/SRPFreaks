"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { PlayerDetailView } from "@/components/players/PlayerDetailView";
import { parseId } from "@/lib/songs";

/**
 * 유저 상세 화면: /players/{유저 id}. 주소의 값은 사용자가 바꿀 수 있으므로 올바른 숫자인지 먼저 검사한다.
 * 숫자라도 공개하지 않았거나 없는 유저면 서버가 404를 준다.
 */
export default function PlayerDetailPage() {
  const params = useParams<{ userId: string }>();
  const { status, user } = useAuth();

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">불러오는 중입니다.</p>;
  }
  if (status === "anonymous" || !user) {
    return (
      <section className="flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold text-fg">유저 상세</h1>
        <p className="text-sm text-fg-sub">유저의 레이팅을 보려면 로그인해 주세요.</p>
        <Link href="/login" className="rounded-full border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head">
          로그인
        </Link>
      </section>
    );
  }
  const playerId = parseId(params.userId);
  if (playerId === null) {
    return <p role="alert" className="text-sm text-fg">유저를 찾을 수 없습니다.</p>;
  }
  return <PlayerDetailView viewerId={user.id} playerId={playerId} />;
}
