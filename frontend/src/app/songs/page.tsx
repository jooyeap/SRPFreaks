"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import { SongListView } from "@/components/songs/SongListView";
import { filtersFromParams, filtersToQuery, type SongListFilters } from "@/lib/song-list";

/**
 * 곡 목록 화면. 검색·필터 조건은 주소 쿼리(`/songs?q=…&part=G&diff=MAS`)에 두어 새로고침, 뒤로 가기, 링크 공유가 같은 화면을 만든다.
 * useSearchParams는 Suspense 안에서 써야 해서(Next.js 정적 빌드 규칙) 본문을 따로 나눴다.
 */
function SongsContent() {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => filtersFromParams(new URLSearchParams(searchParams.toString())), [searchParams]);

  // 조건을 바꿀 때마다 기록(history)을 쌓지 않도록 replace를 쓴다. 스크롤은 그대로 둔다.
  const onFiltersChange = useCallback(
    (next: SongListFilters) => {
      const query = filtersToQuery(next);
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">불러오는 중입니다.</p>;
  }
  if (status === "anonymous" || !user) {
    return (
      <section className="flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold text-fg">곡 목록</h1>
        <p className="text-sm text-fg-sub">내 기록과 함께 보려면 로그인해 주세요.</p>
        <Link href="/login" className="rounded-full border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head">
          로그인
        </Link>
      </section>
    );
  }
  return <SongListView userId={user.id} filters={filters} onFiltersChange={onFiltersChange} />;
}

export default function SongsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-fg-sub">불러오는 중입니다.</p>}>
      <SongsContent />
    </Suspense>
  );
}
