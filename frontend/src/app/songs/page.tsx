"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import { LoginBanner } from "@/components/LoginBanner";
import { SongTabs } from "@/components/songs/SongTabs";
import { SongListView } from "@/components/songs/SongListView";
import { filtersFromParams, filtersToQuery, type SongListFilters } from "@/lib/song-list";
import { ANONYMOUS_VIEWER_ID } from "@/lib/viewer";
import { useTranslations } from "next-intl";

/**
 * 곡 목록 화면. 검색·필터 조건은 주소 쿼리(`/songs?q=…&part=G&diff=MAS`)에 두어 새로고침, 뒤로 가기, 링크 공유가 같은 화면을 만든다.
 * useSearchParams는 Suspense 안에서 써야 해서(Next.js 정적 빌드 규칙) 본문을 따로 나눴다.
 */
function SongsContent() {
  const t = useTranslations();
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => filtersFromParams(new URLSearchParams(searchParams.toString())), [searchParams]);

  // 조건을 바꿀 때마다 기록(history)을 쌓지 않도록 replace를 쓴다. 스크롤은 그대로 둔다.
  const onFiltersChange = useCallback(
    (next: SongListFilters) => {
      const query = filtersToQuery(next);
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [router, pathname],
  );

  if (status === "loading") {
    return (
      <>
        <SongTabs current="songs" />
        <p className="text-sm text-fg-sub">{t("Common.loading")}</p>
      </>
    );
  }
  return (
    <>
      <SongTabs current="songs" />
      {user ? null : <LoginBanner />}
      <SongListView
        userId={user?.id ?? ANONYMOUS_VIEWER_ID}
        filters={filters}
        onFiltersChange={onFiltersChange}
        canRegister={user !== null && user.role !== "USER"}
      />
    </>
  );
}

export default function SongsPage() {
  const t = useTranslations();
  return (
    <Suspense fallback={<p className="text-sm text-fg-sub">{t("Common.loading")}</p>}>
      <SongsContent />
    </Suspense>
  );
}
