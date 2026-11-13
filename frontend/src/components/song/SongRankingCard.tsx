"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ErrorRetry } from "@/components/ErrorRetry";
import { StageBadge } from "@/components/table/StageBadge";
import { fetchSongRanking, myRankOf, rankingRateText, songRankingKeys, SUMMARY_SIZE, type SongRankingItem } from "@/lib/song-ranking";
import type { AchievementStage } from "@/lib/types";

/**
 * 곡 상세의 `곡별 순위` 요약 카드 (D74). 내 기록 카드 아래에 둔다. 로그인한 사용자만 그린다(호출하는 쪽에서 거른다. 서버도 비로그인은 401).
 *
 * 숫자(순위, 인원, 달성률, 단계)는 모두 서버(GET /difficulties/{id}/ranking?size=3)가 계산한 값이고, 여기서는 아무것도 계산하지 않는다.
 * 순위와 인원은 서버가 **공개 유저끼리만** 계산해서 주기 때문에, 화면에는 비공개 유저를 짐작하게 하는 문구를 쓰지 않는다.
 *
 * 상태 (인원 기준이 없어서 1명이어도 보인다, D74 (3)):
 * - 공개 유저가 0명: `아직 순위에 오른 기록이 없어요`
 * - 순위에 있음: `내 순위 N위 / 기록한 공개 유저 M명` + 상위 3줄(내가 그 안이면 그 줄만 강조), 4위 이하면 아래에 내 줄을 따로
 * - 공개인데 이 채보 기록이 없음(me = null): 인원 + 상위 3줄 + 안내 한 줄
 * - 내가 비공개(me.inRanking = false): 상위 3줄은 보이고 내 줄 대신 `공개로 바꾸면 순위에 참여할 수 있어요` + 설정 링크 (순위는 볼 수 있고 내 줄은 없다, D74 (6))
 *
 * 불러오는 중에는 아무것도 그리지 않는다(틀을 먼저 그리면 카드가 나타났다 사라지며 화면이 흔들린다, 컷라인·같은 티어 카드와 같은 이유).
 * 실패했을 때만 이 카드 안에서 안내와 다시 시도를 보여 준다(곡 상세의 나머지는 그대로 쓸 수 있다).
 * `전체 순위` 링크는 기록한 공개 유저가 1명 이상일 때 맨 아래에 둔다(전체 순위 화면 /songs/{곡 id}/ranking?chart={채보 id}, D74 구현 PR 3번). 0명이면 보여 줄 순위가 없어서 링크도 없다.
 *
 * 개인정보: 서버가 준 값만 보인다. 닉네임은 글자로만 그리고(HTML 해석 없음) userId는 유저 상세 링크에만 쓴다. 이메일·역할은 응답에 없다.
 */
export function SongRankingCard({ songId, chartId, userId }: { songId: number; chartId: number; userId: number }) {
  const t = useTranslations("SongRanking");
  const query = useQuery({
    queryKey: songRankingKeys.summary(userId, chartId),
    queryFn: ({ signal }) => fetchSongRanking(chartId, 0, SUMMARY_SIZE, signal),
    staleTime: 60_000,
  });

  if (query.isPending) {
    return null;
  }
  if (query.isError) {
    return (
      <section aria-label={t("title")} className="flex flex-col gap-2.5 rounded-2xl border border-line bg-card px-4 py-3.5">
        <h2 className="text-[13px] font-bold text-fg">{t("title")}</h2>
        <ErrorRetry onRetry={() => void query.refetch()} retrying={query.isFetching}>
          {t("loadFailed")}
        </ErrorRetry>
      </section>
    );
  }

  const data = query.data;
  const mine = myRankOf(data.me);
  // 내가 상위 3 안에 있으면 그 줄이 이미 강조되므로 아래에 내 줄을 또 그리지 않는다
  const mineInTop = mine !== null && data.items.some((item) => item.isMe);

  return (
    <section aria-label={t("title")} className="flex flex-col gap-2.5 rounded-2xl border border-line bg-card px-4 py-3.5">
      <h2 className="text-[13px] font-bold text-fg">{t("title")}</h2>
      {data.players === 0 ? (
        <p className="text-[13px] text-fg-sub">{t("empty")}</p>
      ) : (
        <>
          <p className="font-num text-xs text-fg-dim">
            {mine ? t("summary", { rank: mine.rank, players: data.players }) : t("playersOnly", { players: data.players })}
          </p>
          <ol className="flex flex-col gap-1.5">
            {data.items.map((item) => (
              <RankRow key={item.userId} item={item} />
            ))}
          </ol>
          {mine && !mineInTop ? (
            <div className="flex items-center gap-2 rounded-lg border border-line bg-table-head px-2.5 py-2 text-[13px]" data-testid="my-ranking-row">
              <span className="font-num w-9 shrink-0 font-bold text-fg">{t("rank", { rank: mine.rank })}</span>
              <span className="min-w-0 flex-1 truncate font-bold text-fg">{t("me")}</span>
              <RateAndStage rate={mine.rate} stage={mine.stage} />
            </div>
          ) : null}
          {data.me === null ? <p className="text-xs text-fg-dim">{t("noRecord")}</p> : null}
          {data.me !== null && !data.me.inRanking ? (
            <p className="text-xs text-fg-dim">
              {t("notPublic")}{" "}
              <Link href="/settings" className="inline-flex min-h-11 items-center font-semibold text-fg underline underline-offset-2">
                {t("settings")}
              </Link>
            </p>
          ) : null}
          <Link
            href={`/songs/${songId}/ranking?chart=${chartId}`}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-ctl px-3 text-[13px] font-semibold text-fg hover:bg-table-head"
          >
            {t("all")}
          </Link>
        </>
      )}
    </section>
  );
}

/** 순위 한 줄. 전체 순위 화면(SongRankingView)도 같은 줄을 쓴다. */
export function RankRow({ item }: { item: SongRankingItem }) {
  const t = useTranslations("SongRanking");
  return (
    <li
      aria-current={item.isMe ? "true" : undefined}
      data-me={item.isMe ? "true" : undefined}
      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] ${item.isMe ? "border border-line bg-table-head" : ""}`}
    >
      <span className="font-num w-9 shrink-0 font-bold text-fg">{t("rank", { rank: item.rank })}</span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <Link
          href={`/players/${item.userId}`}
          className="inline-flex min-h-11 min-w-0 items-center font-bold text-fg underline-offset-2 hover:underline"
        >
          {/* 말줄임(truncate)은 안쪽 글자 칸에만 둔다: 링크에 overflow:hidden이 있으면 높은 티어의 빛(drop-shadow)이 링크 상자에서 잘려 네모난 얼룩이 된다.
              티어가 있으면 닉네임 글자에 티어 색(globals.css의 data-tier + tier-score, 유저 목록의 총점 글자와 같은 방식). 없으면 기본 글자색.
              색은 장식이다: 순위·달성률·단계가 글자로 있고 티어 이름은 이 줄에 따로 보이지 않으므로 색만으로 전달되는 정보는 없다 */}
          <span data-tier={item.tier?.key} className={item.tier ? "tier-score truncate" : "truncate"}>{item.nickname}</span>
        </Link>
        {/* 내 줄은 색만이 아니라 글자로도 알린다 */}
        {item.isMe ? <span className="shrink-0 rounded-full border border-line px-1.5 text-[11px] font-bold text-fg-sub">{t("me")}</span> : null}
      </span>
      <RateAndStage rate={item.achievementRate} stage={item.stage} />
    </li>
  );
}

export function RateAndStage({ rate, stage }: { rate: number; stage: AchievementStage | null }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span className="font-num font-bold text-fg">{rankingRateText(rate)}</span>
      {stage ? <StageBadge stage={stage} /> : null}
    </span>
  );
}
