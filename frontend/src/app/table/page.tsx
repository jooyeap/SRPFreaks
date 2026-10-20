"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import { SongTabs } from "@/components/songs/SongTabs";
import { DifficultyTableView } from "@/components/table/DifficultyTableView";
import { viewStateFromParams, viewStateToQuery, type TableViewState } from "@/lib/table-view-state";

/**
 * 서열표 화면. 내 기록을 함께 보여 주므로 로그인이 필요하다.
 * 필터·정렬·평균 계산·페이지는 주소 쿼리(`/table?part=B&pat=단일&page=3`)에 둔다: 곡 상세로 갔다가 뒤로 와도, 새로고침해도,
 * 링크를 공유해도 같은 화면이 나온다(곡 목록과 같은 방식). useSearchParams는 Suspense 안에서 써야 해서(Next.js 정적 빌드 규칙) 본문을 따로 나눴다.
 */
function TableContent() {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const state = useMemo(() => viewStateFromParams(new URLSearchParams(searchParams.toString())), [searchParams]);

  // 바꿀 때마다 기록(history)을 쌓지 않도록 replace를 쓰고, 화면 스크롤은 그대로 둔다(페이지 이동의 맨 위 올리기는 화면이 따로 한다)
  const onStateChange = useCallback(
    (next: TableViewState) => {
      const query = viewStateToQuery(next);
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [router, pathname],
  );

  if (status === "loading") {
    return (
      <>
        <SongTabs current="table" />
        <p className="text-sm text-fg-sub">불러오는 중입니다.</p>
      </>
    );
  }
  if (status === "anonymous" || !user) {
    return (
      <>
        <SongTabs current="table" />
        <section className="flex flex-col items-start gap-3">
          <h1 className="text-xl font-semibold text-fg">서열표</h1>
          <p className="text-sm text-fg-sub">내 기록과 함께 보려면 로그인해 주세요.</p>
          <Link href="/login" className="min-h-11 rounded-lg border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head">
            로그인
          </Link>
        </section>
      </>
    );
  }
  return (
    <>
      <SongTabs current="table" />
      <DifficultyTableView userId={user.id} canRegister={user.role !== "USER"} state={state} onStateChange={onStateChange} />
    </>
  );
}

export default function TablePage() {
  return (
    <Suspense fallback={<p className="text-sm text-fg-sub">불러오는 중입니다.</p>}>
      <TableContent />
    </Suspense>
  );
}
