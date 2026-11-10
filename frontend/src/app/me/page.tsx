"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import { MyPageView } from "@/components/mypage/MyPageView";
import { myPageStateFromParams, myPageStateToQuery, type MyPageState } from "@/lib/my-page";
import { useTranslations } from "next-intl";

/**
 * 마이페이지(예전 레이팅 화면). 내 기록으로 계산하므로 로그인이 필요하다. 옛 주소 /rating은 next.config의 redirect가 여기로 보낸다.
 * 선택한 탭과 통계 기준은 주소 쿼리(`/me?tab=stats&axis=tier`)에 둔다. useSearchParams는 Suspense 안에서 써야 해서(Next.js 정적 빌드 규칙) 본문을 따로 나눴다.
 */
function MyPageContent() {
  const t = useTranslations();
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const state = useMemo(() => myPageStateFromParams(new URLSearchParams(searchParams.toString())), [searchParams]);

  // 탭·기준을 바꿀 때마다 기록(history)을 쌓지 않도록 replace를 쓰고, 화면 스크롤은 그대로 둔다
  const onStateChange = useCallback(
    (next: MyPageState) => {
      const query = myPageStateToQuery(next);
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  if (status === "anonymous" || !user) {
    return (
      <section className="flex min-h-[40svh] flex-col items-start justify-center gap-3">
        <h1 className="text-xl font-semibold text-fg">{t("Nav.myPage")}</h1>
        <p className="text-sm text-fg-sub">{t("Pages.meLead")}</p>
        <Link href="/login" className="min-h-11 rounded-lg border border-ctl px-4 py-1.5 text-sm text-fg hover:bg-table-head">
          {t("Nav.login")}
        </Link>
      </section>
    );
  }
  return <MyPageView userId={user.id} state={state} onStateChange={onStateChange} />;
}

export default function MyPage() {
  const t = useTranslations();
  return (
    <Suspense fallback={<p className="text-sm text-fg-sub">{t("Common.loading")}</p>}>
      <MyPageContent />
    </Suspense>
  );
}
