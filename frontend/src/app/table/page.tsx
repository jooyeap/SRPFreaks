"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import { LoginBanner } from "@/components/LoginBanner";
import { SongTabs } from "@/components/songs/SongTabs";
import { DifficultyTableView } from "@/components/table/DifficultyTableView";
import { viewStateFromParams, viewStateToQuery, type TableViewState } from "@/lib/table-view-state";
import { ANONYMOUS_VIEWER_ID } from "@/lib/viewer";
import { useTranslations } from "next-intl";

/**
 * 서열표 화면. 로그인 없이도 볼 수 있고(D43), 로그인하면 내 기록을 함께 보여 준다.
 * 필터·정렬·평균 계산·페이지는 주소 쿼리(`/table?part=B&pat=단일&page=3`)에 둔다: 곡 상세로 갔다가 뒤로 와도, 새로고침해도,
 * 링크를 공유해도 같은 화면이 나온다(곡 목록과 같은 방식). useSearchParams는 Suspense 안에서 써야 해서(Next.js 정적 빌드 규칙) 본문을 따로 나눴다.
 */
function TableContent() {
  const t = useTranslations();
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
        <p className="text-sm text-fg-sub">{t("Common.loading")}</p>
      </>
    );
  }
  return (
    <>
      <SongTabs current="table" />
      {user ? null : <LoginBanner />}
      <DifficultyTableView userId={user?.id ?? ANONYMOUS_VIEWER_ID} canRegister={user !== null && user.role !== "USER"} state={state} onStateChange={onStateChange} />
    </>
  );
}

export default function TablePage() {
  const t = useTranslations();
  return (
    <Suspense fallback={<p className="text-sm text-fg-sub">{t("Common.loading")}</p>}>
      <TableContent />
    </Suspense>
  );
}
