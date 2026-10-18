"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { ImportTokenPanel } from "@/components/settings/ImportTokenPanel";
import { IMPORT_FEATURE_ENABLED } from "@/lib/features";

/** 최근 플레이 가져오기 설정 화면(D34): 가져오기 토큰 발급·폐기와 사용 안내. 로그인이 필요하다. */
export default function ImportSettingsPage() {
  const { status, user } = useAuth();

  if (!IMPORT_FEATURE_ENABLED) {
    return (
      <section className="flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold text-fg">최근 플레이 가져오기</h1>
        <p className="text-sm text-fg-sub">이 기능은 아직 준비 중입니다.</p>
        <Link href="/settings" className="text-sm text-fg-sub hover:text-fg">
          &#9666; 설정
        </Link>
      </section>
    );
  }

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">불러오는 중입니다.</p>;
  }
  if (status === "anonymous" || !user) {
    return (
      <section className="flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold text-fg">최근 플레이 가져오기</h1>
        <p className="text-sm text-fg-sub">가져오기 토큰을 만들려면 로그인해 주세요.</p>
        <Link href="/login" className="min-h-11 rounded-lg border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head">
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
        <h1 className="text-xl font-semibold text-fg">최근 플레이 가져오기</h1>
      </div>
      <ImportTokenPanel userId={user.id} />
    </section>
  );
}
