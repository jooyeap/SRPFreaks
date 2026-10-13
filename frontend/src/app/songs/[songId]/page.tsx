"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/components/AuthProvider";
import { SongDetailView } from "@/components/song/SongDetailView";
import { parseId, parseOrigin } from "@/lib/songs";

/**
 * 곡 상세 화면: /songs/{곡 id}?from=table|songs&chart={채보 id}
 * 주소의 값은 사용자가 바꿀 수 있으므로 검사해서 쓴다: 곡 id가 올바른 숫자가 아니면 안내만 보여 주고,
 * from은 table만 인정하며(나머지는 곡 목록), chart는 이 곡의 채보인지 SongDetailView가 다시 확인한다.
 * useSearchParams는 빌드 때 Suspense 경계가 필요해서 안쪽 컴포넌트로 나눴다.
 */
function SongDetailPage() {
  const params = useParams<{ songId: string }>();
  const search = useSearchParams();
  const { status, user } = useAuth();

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">불러오는 중입니다.</p>;
  }
  if (status === "anonymous" || !user) {
    return (
      <section className="flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold text-fg">곡 상세</h1>
        <p className="text-sm text-fg-sub">곡 정보와 내 기록을 보려면 로그인해 주세요.</p>
        <Link href="/login" className="rounded-full border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head">
          로그인
        </Link>
      </section>
    );
  }

  const songId = parseId(params.songId);
  if (songId === null) {
    return <p role="alert" className="text-sm text-fg">곡을 찾을 수 없습니다.</p>;
  }
  return (
    <SongDetailView
      songId={songId}
      chartId={parseId(search.get("chart"))}
      origin={parseOrigin(search.get("from"))}
      userId={user.id}
      canEditTable={user.role !== "USER"}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-fg-sub">불러오는 중입니다.</p>}>
      <SongDetailPage />
    </Suspense>
  );
}
