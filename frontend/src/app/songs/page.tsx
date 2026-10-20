"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import { SongTabs } from "@/components/songs/SongTabs";
import { SongListView } from "@/components/songs/SongListView";
import { filtersFromParams, filtersToQuery, type SongListFilters } from "@/lib/song-list";
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
  if (status === "anonymous" || !user) {
    return (
      <>
        <SongTabs current="songs" />
        <section className="flex flex-col items-start gap-3">
          <h1 className="text-xl font-semibold text-fg">{t("Home.songsTitle")}</h1>
          <p className="text-sm text-fg-sub">{t("Songs.loginToSeeRecords")}</p>
          <Link href="/login" className="min-h-11 rounded-lg border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head">
            {t("Nav.login")}
          </Link>
        </section>
      </>
    );
  }
  return (
    <>
      <SongTabs current="songs" />
      <SongListView userId={user.id} filters={filters} onFiltersChange={onFiltersChange} canRegister={user.role !== "USER"} />
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
