"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/components/AuthProvider";
import { RivalCompareView } from "@/components/rivals/RivalCompareView";
import { parseChart, parseTab, type DashChart, type DashTab } from "@/lib/rival-dashboard";
import { parseId } from "@/lib/songs";
import { useTranslations } from "next-intl";

/**
 * 라이벌 비교: /players/{유저 id}/compare (D56). 공개 유저의 곡별 기록을 보므로 로그인이 필요하다(서버도 401).
 * `?view=charts`면 곡별 승패부터 연다(알림에서 들어올 때). 대시보드(D67)의 차트·탭은 주소(`?chart=bar&tab=weak`)에 남아 새로고침·뒤로가기에서도 그대로다.
 * useSearchParams는 Suspense 안에서 쓴다(Next.js 정적 빌드 규칙).
 */
function CompareContent() {
  const t = useTranslations();
  const params = useParams<{ userId: string }>();
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
  if (targetId === null || targetId === user.id) {
    return <p role="alert" className="text-sm text-fg">{t("Players.notFound")}</p>;
  }
  /** 주소의 차트·탭만 바꾼다(다른 값은 그대로). 기록이 쌓이지 않게 replace로 바꾼다. */
  function update(name: "chart" | "tab", value: string) {
    const query = new URLSearchParams(searchParams.toString());
    query.set(name, value);
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  }

  return (
    <RivalCompareView viewerId={user.id} targetId={targetId}
                      initialView={searchParams.get("view") === "charts" ? "charts" : "rating"}
                      tab={parseTab(searchParams.get("tab"))} onTabChange={(next: DashTab) => update("tab", next)}
                      chart={parseChart(searchParams.get("chart"))} onChartChange={(next: DashChart) => update("chart", next)} />
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={null}>
      <CompareContent />
    </Suspense>
  );
}
