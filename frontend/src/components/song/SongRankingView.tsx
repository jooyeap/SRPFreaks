"use client";

import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { BACK_BUTTON_CLASS, BackArrow } from "@/components/BackArrow";
import { BackLink } from "@/components/BackLink";
import { ErrorRetry } from "@/components/ErrorRetry";
import { Pager } from "@/components/Pager";
import { RankRow } from "@/components/song/SongRankingCard";
import { SongHeader } from "@/components/song/SongHeader";
import { ApiError } from "@/lib/api";
import { fetchSongDetail, resolveChart, songKeys } from "@/lib/songs";
import { fetchSongRanking, myRankOf, RANKING_PAGE_SIZE, songRankingKeys, type SongRankingResponse } from "@/lib/song-ranking";

/**
 * 전체 순위 화면 (D74 구현 PR 3번): /songs/{곡 id}/ranking?chart={채보 id}&page={쪽, 0부터}.
 * 곡 상세(/songs/{곡 id}?chart=)와 같은 주소 규칙 아래에 둔다. 순위는 채보 하나(곡 + 난이도 + 파트) 단위라 chart가 필요하고, 없거나 이 곡의 채보가
 * 아니면 곡 상세와 같이 가장 레벨이 높은 채보로 본다(resolveChart). 로그인한 사용자만 들어올 수 있고(호출하는 page.tsx가 비로그인을 거른다. 서버도 401),
 * 숫자(순위·인원·달성률·단계)는 모두 서버가 **공개 유저끼리만** 계산한 값이다. 화면에는 계산이 없다.
 *
 * 쪽 이동은 부모가 주소(?page=)로 쥐고 replace로 바꾼다(기록이 쌓이지 않아 뒤로 가기는 들어온 곳으로 간다, 비교 화면과 같다).
 * 쪽을 넘길 때는 이전 쪽 목록을 그대로 두고(keepPreviousData) 새 쪽이 오면 바꿔서 화면이 깜빡이지 않게 한다.
 *
 * 개인정보: 서버가 준 값만 보인다. 닉네임은 글자로만 그리고(HTML 해석 없음) userId는 유저 상세 링크에만 쓴다. 이메일·역할은 응답에 없다.
 * 인원 기준이 없어서 1명이어도 보인다(D74 (3)). 내가 비공개이면 순위는 보이고 내 줄은 없으며 공개 안내를 보인다(D74 (6)).
 */
export function SongRankingView({
  songId,
  chartId,
  userId,
  page,
  onPageChange,
}: {
  songId: number;
  chartId: number | null;
  userId: number;
  /** 지금 쪽(0부터). 주소에서 읽어 온 값 */
  page: number;
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations();
  const song = useQuery({
    queryKey: songKeys.detail(songId),
    queryFn: ({ signal }) => fetchSongDetail(songId, signal),
  });
  const chart = song.data ? resolveChart(song.data.difficulties, chartId) : null;
  const detailHref = `/songs/${songId}${chart ? `?chart=${chart.id}` : ""}`;

  const ranking = useQuery({
    queryKey: songRankingKeys.page(userId, chart?.id ?? 0, page, RANKING_PAGE_SIZE),
    queryFn: ({ signal }) => fetchSongRanking(chart?.id ?? 0, page, RANKING_PAGE_SIZE, signal),
    enabled: chart !== null,
    placeholderData: keepPreviousData,
    retry: false, // 없는 채보(404)를 여러 번 다시 묻지 않는다
  });

  const backBar = (
    <div className="flex items-center justify-between gap-3">
      <BackLink fallbackHref={detailHref} ariaLabel={t("SongRanking.backAria")} className={BACK_BUTTON_CLASS}>
        <BackArrow />
      </BackLink>
      <span className="text-sm font-semibold text-fg">{t("SongRanking.all")}</span>
      <span aria-hidden="true" className="w-12" />
    </div>
  );

  if (song.isPending) {
    return (
      <div className="flex flex-col gap-4">
        {backBar}
        <p className="text-sm text-fg-sub">{t("Common.loading")}</p>
      </div>
    );
  }
  if (song.isError) {
    return (
      <div className="flex flex-col gap-4">
        {backBar}
        <ErrorRetry onRetry={() => void song.refetch()} retrying={song.isFetching}>
          {song.error instanceof ApiError && song.error.status === 404 ? t("Songs.notFoundSong") : t("Song.loadFailed")}
        </ErrorRetry>
      </div>
    );
  }
  // 채보가 하나도 없는 곡이면 순위를 낼 채보가 없다
  if (!chart) {
    return (
      <div className="flex flex-col gap-4">
        {backBar}
        <p role="alert" className="text-sm text-fg">{t("Songs.notFoundSong")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {backBar}
      <SongHeader song={song.data} chart={chart} />
      <section aria-label={t("SongRanking.all")} aria-busy={ranking.isPlaceholderData} className="flex flex-col gap-2.5 rounded-2xl border border-line bg-card px-4 py-3.5">
        <RankingBody ranking={ranking} page={page} onPageChange={onPageChange} />
      </section>
    </div>
  );
}

function RankingBody({
  ranking,
  page,
  onPageChange,
}: {
  ranking: UseQueryResult<SongRankingResponse>;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations("SongRanking");
  const root = useTranslations();
  if (ranking.isPending) {
    return <p className="text-sm text-fg-sub">{root("Common.loading")}</p>;
  }
  if (ranking.isError) {
    const notFound = ranking.error instanceof ApiError && ranking.error.status === 404;
    return (
      <ErrorRetry onRetry={() => void ranking.refetch()} retrying={ranking.isFetching}>
        {notFound ? root("Songs.notFoundSong") : t("loadFailed")}
      </ErrorRetry>
    );
  }

  const data = ranking.data;
  if (data.players === 0) {
    return <p className="text-[13px] text-fg-sub">{t("empty")}</p>;
  }
  const mine = myRankOf(data.me);
  // 내 순위가 이 쪽에 없으면 그 쪽으로 갈 수 있게 한다(D74 18.2.2 `내 순위로 이동`). 쪽 번호는 서버가 준 쪽 크기로 계산한다
  const mineOnThisPage = data.items.some((item) => item.isMe);
  const minePage = mine ? Math.floor((mine.rank - 1) / data.size) : null;

  return (
    <>
      <p className="font-num text-xs text-fg-dim">
        {mine ? t("summary", { rank: mine.rank, players: data.players }) : t("playersOnly", { players: data.players })}
      </p>
      {data.items.length === 0 ? (
        // 주소를 고쳐서 마지막 쪽 뒤로 갔을 때. 서버는 오류 없이 빈 목록을 준다
        <div className="flex flex-col items-start gap-2">
          <p className="text-[13px] text-fg-sub">{t("emptyPage")}</p>
          <button type="button" onClick={() => onPageChange(0)} className="min-h-11 rounded-lg border border-ctl px-3 text-[13px] font-semibold text-fg hover:bg-table-head">
            {t("firstPage")}
          </button>
        </div>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {data.items.map((item) => (
            <RankRow key={item.userId} item={item} />
          ))}
        </ol>
      )}
      {mine && !mineOnThisPage && minePage !== null && minePage !== page ? (
        <button type="button" onClick={() => onPageChange(minePage)} className="min-h-11 self-start rounded-lg border border-ctl px-3 text-[13px] font-semibold text-fg hover:bg-table-head">
          {t("goMine")}
        </button>
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
      <Pager page={page} totalPages={data.totalPages} onChange={onPageChange} />
    </>
  );
}
