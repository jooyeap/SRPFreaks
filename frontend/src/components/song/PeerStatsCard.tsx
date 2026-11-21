"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ErrorRetry } from "@/components/ErrorRetry";
import { HelpTip } from "@/components/HelpTip";
import { formatRate, formatScore } from "@/lib/format";
import { fetchPeerStats, findPeerStat, hasExpectedGain, peerStatsKeys, shortfallKind, type PeerStatsResponse } from "@/lib/peer-stats";

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
 * - 서버가 표시 기준(구간 인원, 채보 인원)에 못 미치면 이 채보를 응답에서 뺀다. 그때는 값 대신 `같은 티어 유저가 적어 표시하지 않습니다(기준 N명)` 한 줄만 보인다(D98:
 *   카드가 통째로 사라지면 왜 안 보이는지 알 수 없어서). 티어를 모르는 경우(응답의 tierName이 null)만 카드를 그리지 않는다.
 * - 달성률은 **중앙값**이다. 라벨에 그렇게 쓰고, 어느 티어 구간(점수 범위)의 유저인지와 `?` 설명을 머리에 둔다(D98).
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
  if (query.isPending || (query.isSuccess && stat === null && query.data.tierName === null)) {
    return null;
  }

  return (
    <section aria-label={t("title")} className="flex flex-col gap-2.5 rounded-2xl border border-line bg-card px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-bold text-fg">{t("title")}</h2>
        {query.data?.tierName ? (
          <HelpTip
            title={t("helpTitle")}
            ariaLabel={t("helpAria")}
            body={t("helpBody", { band: query.data.minBandUsers, chart: query.data.minChartUsers })}
          />
        ) : null}
      </div>
      {query.data?.tierName ? <p className="break-keep text-xs text-fg-sub">{bandText(query.data, t)}</p> : null}
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
      ) : query.data ? (
        <p className="break-keep text-xs text-fg-dim">
          {shortfallKind(query.data) === "band"
            ? t("lowBand", { min: query.data.minBandUsers })
            : t("lowChart", { min: query.data.minChartUsers })}
        </p>
      ) : null}
    </section>
  );
}

/** `SS 3 구간 · 5,000점 이상 5,500점 미만`. 최고 티어는 상한이 없어 `이상`만 쓴다. 범위를 모르면 티어 이름만. */
function bandText(data: PeerStatsResponse, t: ReturnType<typeof useTranslations>): string {
  const tier = data.tierName ?? "";
  if (data.bandMinScore === null) {
    return t("bandName", { tier });
  }
  const min = data.bandMinScore.toLocaleString("en-US");
  if (data.bandNextMinScore === null) {
    return t("bandOpen", { tier, min });
  }
  return t("bandRange", { tier, min, max: data.bandNextMinScore.toLocaleString("en-US") });
}

function Row({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-fg-dim">{label}</dt>
      <dd className={`font-num font-bold ${emphasize ? "text-done-text" : "text-fg"}`}>{value}</dd>
    </div>
  );
}
