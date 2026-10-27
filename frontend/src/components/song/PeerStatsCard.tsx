"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ErrorRetry } from "@/components/ErrorRetry";
import { TermHelp } from "@/components/TermHelp";
import { formatRate, formatScore } from "@/lib/format";
import { fetchPeerStats, findPeerStat, hasExpectedGain, peerStatsKeys } from "@/lib/peer-stats";

/** 달성률 표시: 100.00은 `MAX`(그대로), 그 외는 둘째 자리까지 + `%`. */
function rateText(rate: number): string {
  const text = formatRate(rate);
  return text === "MAX" ? text : `${text}%`;
}

/**
 * 곡 상세의 `같은 티어 유저 기록` 카드 (D53). 내 티어와 같은 구간의 공개 유저들이 이 채보를 레이팅에 넣었는지,
 * 넣은 유저들의 달성률 중앙값, 내가 그 달성률로 치면 오르는 레이팅 점수를 보여 준다.
 *
 * - 로그인한 사용자만 부른다(호출하는 쪽에서 거른다). 서버도 비로그인은 401이다.
 * - 서버가 표시 기준(구간 인원, 채보 인원)에 못 미치면 이 채보를 응답에서 빼므로, 그때는 **카드 자체를 그리지 않는다**(빈 카드를 보여 주지 않는다).
 * - 불러오는 중에는 아무것도 그리지 않는다. 데이터가 없는 경우(기준 인원 미달)가 가장 흔해서, 틀을 먼저 그리면 카드가 나타났다 사라지며 화면이 흔들린다.
 *   실패했을 때만 이 카드 안에서 안내와 다시 시도를 보여 준다(곡 상세의 나머지는 그대로 쓸 수 있다).
 * - 이 카드는 "추천"이라는 말을 쓰지 않는다. 서열표의 `추천도`는 운영자가 정한 값이라 둘이 섞이면 헷갈린다.
 */
export function PeerStatsCard({ chartId, userId }: { chartId: number; userId: number }) {
  const t = useTranslations("PeerStats");
  const query = useQuery({
    queryKey: peerStatsKeys.chart(userId, chartId),
    queryFn: ({ signal }) => fetchPeerStats([chartId], signal),
    staleTime: 60_000,
  });

  const stat = query.data ? findPeerStat(query.data, chartId) : null;
  if (query.isPending || (query.isSuccess && stat === null)) {
    return null;
  }

  return (
    <section aria-label={t("title")} className="flex flex-col gap-2.5 rounded-2xl border border-line bg-card px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-bold text-fg">{t("title")}</h2>
        {stat ? <TermHelp term="peerStats" label={t("title")} /> : null}
      </div>
      {query.isError ? (
        <ErrorRetry onRetry={() => void query.refetch()} retrying={query.isFetching}>
          {t("loadFailed")}
        </ErrorRetry>
      ) : stat && query.data ? (
        <dl className="flex flex-col gap-1.5 text-[13px]">
          <Row label={t("users")} value={t("usersValue", { users: stat.users, band: query.data.bandUsers })} />
          <Row label={t("rate")} value={rateText(stat.medianRate)} />
          {stat.inMyList && stat.myRate !== null ? <Row label={t("mine")} value={t("mineValue", { rate: rateText(stat.myRate) })} /> : null}
          {hasExpectedGain(stat) ? (
            <Row label={t("gain")} value={t("gainValue", { value: formatScore(stat.expectedGain) })} emphasize />
          ) : null}
        </dl>
      ) : null}
    </section>
  );
}

function Row({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-fg-dim">{label}</dt>
      <dd className={`font-num font-bold ${emphasize ? "text-done-text" : "text-fg"}`}>{value}</dd>
    </div>
  );
}
