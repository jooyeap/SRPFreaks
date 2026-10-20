"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import { FolderBucketView } from "@/components/mypage/FolderBucketView";
import { folderViewFromParams, folderViewToQuery, type FolderViewState } from "@/lib/rate-folders";
import { useTranslations } from "next-intl";

/**
 * 마이페이지 통계 → 폴더·구간의 채보 목록(`/me/folder?axis=level&key=9.50&bucket=R95`). 내 기록을 쓰므로 로그인이 필요하다.
 * 폴더·구간·파트·정렬은 모두 주소에 있어서 새로고침·뒤로가기·링크 공유에도 같은 목록이 나온다(주소가 올바르지 않으면 안내만 보인다).
 */
function FolderContent() {
  const t = useTranslations();
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const state = useMemo(() => folderViewFromParams(new URLSearchParams(searchParams.toString())), [searchParams]);

  // 필터를 바꿀 때마다 기록(history)을 쌓지 않도록 replace를 쓰고, 화면 스크롤은 그대로 둔다
  const onStateChange = useCallback(
    (next: FolderViewState) => {
      router.replace(`${pathname}?${folderViewToQuery(next)}`, { scroll: false });
    },
    [router, pathname],
  );

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  if (status === "anonymous" || !user) {
    return (
      <section className="flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold text-fg">{t("Nav.myPage")}</h1>
        <p className="text-sm text-fg-sub">{t("Pages.folderLead")}</p>
        <Link href="/login" className="min-h-11 rounded-lg border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head">
          {t("Nav.login")}
        </Link>
      </section>
    );
  }
  if (!state) {
    return (
      <section className="flex flex-col items-start gap-3">
        <p role="alert" className="text-sm text-fg">{t("Pages.folderNotFound")}</p>
        <Link href="/me?tab=stats" className="min-h-11 rounded-lg border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head">
          {t("MyPage.backToStats")}
        </Link>
      </section>
    );
  }
  return <FolderBucketView userId={user.id} state={state} onStateChange={onStateChange} />;
}

export default function MyFolderPage() {
  const t = useTranslations();
  return (
    <Suspense fallback={<p className="text-sm text-fg-sub">{t("Common.loading")}</p>}>
      <FolderContent />
    </Suspense>
  );
}
