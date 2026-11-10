"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/components/AuthProvider";
import { RivalPatternDetailView } from "@/components/rivals/RivalPatternDetailView";
import { detailFilterParam, isPatternKey, parseDetailFilter, parseTab } from "@/lib/rival-dashboard";
import { parseId } from "@/lib/songs";
import { useTranslations } from "next-intl";

/**
 * 라이벌 대시보드의 속성 상세: /players/{유저 id}/compare/{속성 키} (D67). 비교 화면과 같은 규칙이다 — 로그인이 필요하고(서버도 401),
 * 숫자가 아닌 id·나 자신·허용 밖의 속성 키는 찾을 수 없다고 안내한다(서버는 허용 밖 키에 400을 준다).
 * 필터와 쪽은 주소(`?filter=lose&page=2`)에 남아 새로고침·뒤로가기에서도 그대로다. `?from=`은 돌아갈 때 대시보드 탭을 되살리는 값이다.
 */
function DetailContent() {
  const t = useTranslations();
  const params = useParams<{ userId: string; key: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { status, user } = useAuth();

  if (status === "loading") {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  if (status === "anonymous" || !user) {
    return (
      <section className="flex min-h-[40svh] flex-col items-start justify-center gap-3">
        <h1 className="text-xl font-semibold text-fg">{t("Rival.compareTitle")}</h1>
        <p className="text-sm text-fg-sub">{t("Rival.loginLead")}</p>
        <Link href="/login" className="min-h-11 rounded-lg border border-ctl px-4 py-1.5 text-sm text-fg hover:bg-table-head">
          {t("Nav.login")}
        </Link>
      </section>
    );
  }
  const targetId = parseId(params.userId);
  const key = params.key.toUpperCase();
  if (targetId === null || targetId === user.id || !isPatternKey(key)) {
    return <p role="alert" className="text-sm text-fg">{t("Players.notFound")}</p>;
  }

  const filter = parseDetailFilter(searchParams.get("filter"));
  const pageValue = Number(searchParams.get("page"));
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 0;
  const fromParam = searchParams.get("from");
  const from = fromParam === null ? null : parseTab(fromParam);

  /** 주소의 필터·쪽만 바꾼다(다른 값은 그대로). 기록이 쌓이지 않게 replace로 바꾼다. */
  function update(next: { filter?: string; page?: number }) {
    const query = new URLSearchParams(searchParams.toString());
    if (next.filter !== undefined) query.set("filter", next.filter);
    if (next.page !== undefined) {
      if (next.page > 0) query.set("page", String(next.page));
      else query.delete("page");
    }
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  }

  return (
    <RivalPatternDetailView
      viewerId={user.id}
      targetId={targetId}
      patternKey={key}
      filter={filter}
      page={page}
      from={from}
      onFilterChange={(next) => update({ filter: detailFilterParam(next), page: 0 })}
      onPageChange={(next) => update({ page: next })}
    />
  );
}

export default function CompareDetailPage() {
  return (
    <Suspense fallback={null}>
      <DetailContent />
    </Suspense>
  );
}
