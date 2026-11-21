"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AdminBackLink } from "@/components/admin/AdminBackLink";
import { DashboardSeriesChart, type SeriesDatum } from "@/components/admin/DashboardSeriesChart";
import { ErrorRetry } from "@/components/ErrorRetry";
import { HelpTip } from "@/components/HelpTip";
import { Segment, TierChip } from "@/components/rivals/Segment";
import {
  DASHBOARD_DAYS,
  dashboardKeys,
  dateLabel,
  DEFAULT_DASHBOARD_DAYS,
  fetchDashboard,
  ratioText,
  signedCount,
  type DashboardDays,
  type DashboardResponse,
} from "@/lib/dashboard";
import { STATUS_LABELS } from "@/lib/suggestions";

/**
 * 관리자 대시보드 (D80, ROOT 전용). 가입자·기록·티어·건의 현황을 숫자로만 보여 주는 읽기 전용 화면이다.
 *
 * 개인이 드러나는 값(이메일·닉네임·개인 기록)은 서버가 내보내지 않아 화면에도 없다. 방문자 수·페이지뷰는 수집 장치가 없어서 없다.
 * 판정을 뜻하는 말·색(이상, 경고 등)도 없다: 값은 숫자(+/− 부호 포함)이고 그림은 같은 숫자를 보조한다.
 * 플레이어 티어 분포는 공개 프로필 유저만 센다(비공개 유저의 기록은 읽지 않는다). 화면이 그 기준 인원을 함께 적는다.
 *
 * 배치: 휴대폰은 1열 카드(요약 2칸씩 → 가입자 추이 → 기록 입력 수 → 티어 분포 → 건의 현황), 1024px 이상은 요약 4칸 + 두 열(왼쪽 두 그래프, 오른쪽 티어·건의).
 * 기간 칩(7/30/90일)을 바꾸면 그래프 두 개가 그 기간으로 다시 그려진다. 요약의 가입자 증가분도 그 기간 기준이다.
 */
export function AdminDashboardView({ viewerId }: { viewerId: number }) {
  const t = useTranslations("Dashboard");
  const [days, setDays] = useState<DashboardDays>(DEFAULT_DASHBOARD_DAYS);
  const query = useQuery({
    queryKey: dashboardKeys.dashboard(viewerId, days),
    queryFn: ({ signal }) => fetchDashboard(days, signal),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <AdminBackLink />
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-fg">{t("title")}</h1>
          <HelpTip title={t("helpTitle")} ariaLabel={t("helpAria")} body={t("helpBody")} />
        </div>
        <p className="text-sm text-fg-sub">{t("lead")}</p>
      </div>

      <Segment
        label={t("periodAria")}
        items={DASHBOARD_DAYS.map((value) => ({ value: String(value), text: t("periodDays", { days: value }) }))}
        value={String(days)}
        onChange={(next) => setDays(Number(next) as DashboardDays)}
        nowrap
      />

      {query.isPending ? <p className="text-sm text-fg-sub">{t("loading")}</p> : null}
      {query.isError && !query.data ? (
        <ErrorRetry onRetry={() => void query.refetch()} retrying={query.isFetching}>
          {t("loadFailed")}
        </ErrorRetry>
      ) : null}
      {query.data ? <DashboardBody data={query.data} /> : null}
    </div>
  );
}

function DashboardBody({ data }: { data: DashboardResponse }) {
  const t = useTranslations("Dashboard");
  const tAll = useTranslations();
  const { summary } = data;

  const signupData: SeriesDatum[] = data.signups.map((p) => ({
    date: p.date,
    value: p.totalUsers,
    text: t("signupsSelected", { date: dateLabel(p.date), total: p.totalUsers, added: signedCount(p.newUsers) }),
  }));
  const recordData: SeriesDatum[] = data.records.map((p) => ({
    date: p.date,
    value: p.records,
    text: t("recordsSelected", { date: dateLabel(p.date), n: p.records }),
  }));
  const maxTierUsers = Math.max(...data.tiers.rows.map((r) => r.users), 1);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <SummaryCard label={t("cardTotalUsers")} value={t("usersValue", { n: summary.totalUsers })}>
          {t("growth", { days: data.days, change: signedCount(summary.newUsers) })}
        </SummaryCard>
        <SummaryCard label={t("cardPublic")} value={t("usersValue", { n: summary.publicProfiles })}>
          {t("publicRatio", { ratio: ratioText(summary.publicRatioPercent) })}
        </SummaryCard>
        <SummaryCard label={t("cardRecordsToday")} value={t("recordsValue", { n: summary.recordsToday })}>
          {t("recordsVsYesterday", { yesterday: summary.recordsYesterday, change: signedCount(summary.recordsToday - summary.recordsYesterday) })}
        </SummaryCard>
        <SummaryCard label={t("cardPending")} value={t("suggestionCount", { n: summary.pendingSuggestions })} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
        <div className="flex min-w-0 flex-col gap-3">
          <Card title={t("signupsTitle")}>
            <DashboardSeriesChart key={`signups-${data.days}`} kind="line" data={signupData} ariaLabel={t("signupsAria")} hint={t("chartHint")} />
          </Card>
          <Card title={t("recordsTitle")}>
            <DashboardSeriesChart key={`records-${data.days}`} kind="bar" data={recordData} ariaLabel={t("recordsAria")} hint={t("chartHint")} />
          </Card>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <Card title={t("tiersTitle")}>
            <p className="text-xs text-fg-sub">{t("tiersBasis", { counted: data.tiers.countedUsers, recorded: data.tiers.recordedUsers })}</p>
            {data.tiers.rows.length === 0 ? (
              <p className="text-sm text-fg-sub">{t("tiersEmpty")}</p>
            ) : (
              <ul aria-label={t("tiersAria")} className="flex flex-col gap-2" data-testid="tier-rows">
                {data.tiers.rows.map((row) => (
                  <li key={row.key} className="grid grid-cols-[104px_minmax(0,1fr)_56px] items-center gap-2">
                    <span className="min-w-0">
                      <TierChip tier={{ key: row.key, displayName: row.displayName, minScore: row.minScore, nextDisplayName: null, nextMinScore: null }} />
                    </span>
                    {/* 막대는 장식이다. 인원은 오른쪽 숫자가 전한다. */}
                    <span aria-hidden="true" className="h-2 rounded bg-table-head">
                      <span className="block h-full rounded bg-fg-dim" style={{ width: `${(row.users / maxTierUsers) * 100}%` }} />
                    </span>
                    <span className="text-right font-num text-xs text-fg">{t("usersValue", { n: row.users })}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={t("suggestionsTitle")}>
            <ul className="flex flex-col gap-1.5" data-testid="suggestion-rows">
              {data.suggestions.map((item) => (
                <li key={item.status} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-fg-sub">{tAll(STATUS_LABELS[item.status])}</span>
                  <span className="font-num text-fg">{t("suggestionCount", { n: item.count })}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-0.5 rounded-2xl border border-line bg-card p-3">
      <h2 className="text-xs text-fg-sub">{label}</h2>
      <p className="font-num text-xl font-bold text-fg">{value}</p>
      {children ? <p className="font-num text-[11px] text-fg-dim">{children}</p> : null}
    </section>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-2xl border border-line bg-card p-3">
      <h2 className="text-sm font-bold text-fg">{title}</h2>
      {children}
    </section>
  );
}
