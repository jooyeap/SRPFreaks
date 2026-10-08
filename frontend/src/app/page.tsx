"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { HomeDashboard } from "@/components/home/HomeDashboard";

/**
 * 홈. 로그인하지 않았으면 서비스 소개와 로그인 안내, 로그인했으면 내 요약(레이팅·서열표 진행도)을 보여 준다.
 * 서열표/레이팅 등 개별 화면은 로그인이 필요하며, 로그인하지 않았으면 각 화면이 로그인 안내를 보여 준다.
 */
export default function Home() {
  const { status, user } = useAuth();

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">불러오는 중입니다.</p>;
  }
  if (status === "authenticated" && user) {
    return <HomeDashboard userId={user.id} name={user.nickname ?? "플레이어"} />;
  }
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-line bg-card p-4">
        <h1 className="font-num text-xl font-semibold">SRPFreaks</h1>
        <p className="mt-2 text-sm text-fg-sub">
          GITADORA 플레이 기록을 SRN+ 옵션으로 저장하고, 레이팅 목록을 계산합니다.
        </p>
        <p className="mt-2 text-xs text-fg-dim">로그인은 Google 계정으로만 합니다. 기록은 직접 입력하며, 본인만 볼 수 있습니다.</p>
        <Link
          href="/login"
          className="mt-3 inline-block rounded-full border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head"
        >
          로그인
        </Link>
      </section>

      <ul className="grid gap-3 md:grid-cols-3">
        <li className="rounded-lg border border-line bg-card p-4">
          <p className="text-base font-semibold text-fg">서열표</p>
          <p className="mt-1 text-sm text-fg-sub">기준 난이도별로 채보를 보고, 내 기록과 달성 현황을 확인합니다.</p>
        </li>
        <li className="rounded-lg border border-line bg-card p-4">
          <p className="text-base font-semibold text-fg">레이팅</p>
          <p className="mt-1 text-sm text-fg-sub">SRN+ 기록으로 레이팅 합계와 플레이어 티어를 계산합니다.</p>
        </li>
        <li className="rounded-lg border border-line bg-card p-4">
          <p className="text-base font-semibold text-fg">기록 입력</p>
          <p className="mt-1 text-sm text-fg-sub">플레이 기록을 한 건씩 직접 입력합니다.</p>
        </li>
      </ul>
    </div>
  );
}
