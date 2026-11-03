"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RecordDialog } from "@/components/record/RecordDialog";
import { SetlistAddButton } from "@/components/setlist/SetlistAddButton";
import { ChartAddDialog } from "@/components/song/ChartAddDialog";
import { SongEditDialog, type SongEditTarget } from "@/components/song/SongEditDialog";
import { SongManageDialog } from "@/components/song/SongManageDialog";
import { JacketUploadDialog } from "@/components/song/JacketUploadDialog";
import { useJackets } from "@/lib/jackets";
import { MyRecordCard } from "@/components/song/MyRecordCard";
import { RivalRecordsCard } from "@/components/rivals/RivalRecordsCard";
import { PeerStatsCard } from "@/components/song/PeerStatsCard";
import { TierHistorySection } from "@/components/song/TierHistorySection";
import { SongHeader } from "@/components/song/SongHeader";
import { TableEntryEditDialog, type TableEntryTarget } from "@/components/song/TableEntryEditDialog";
import { InfoCards, LevelTable } from "@/components/song/SongInfo";
import { GroupSongList, OtherCharts, TableInfoCard } from "@/components/song/TableContext";
import { ApiError } from "@/lib/api";
import { allGroupsKey, fetchAllTierGroups, fetchDifficultyTables, pickRatingTable, tableKeys } from "@/lib/difficulty-table";
import { difficultyLabel, formatTier, partLabel } from "@/lib/format";
import { availableCombos } from "@/lib/song-admin";
import { fetchBestRecord, recordKeys } from "@/lib/records";
import { entriesOfSong, fetchSongDetail, findChart, resolveChart, songKeys, type SongDetailOrigin } from "@/lib/songs";
import { ErrorRetry } from "@/components/ErrorRetry";
import { isLoggedInViewer } from "@/lib/viewer";
import { useTranslations } from "next-intl";
import type { Translator } from "@/i18n/translator";
import { BACK_BUTTON_CLASS, BackArrow } from "@/components/BackArrow";

function errorMessage(error: unknown, t: Translator): string {
  if (error instanceof ApiError) {
    return error.status === 404 ? t("Songs.notFoundSong") : error.message;
  }
  return t("Song.loadFailed");
}

/**
 * 곡 상세. 어디서 들어왔는지(origin)에 따라 구성이 다르다 (DESIGN-UI 6장).
 *  - table: 서열표 정보, 속성 칩, 이 곡의 다른 채보, 같은 난이도의 곡 목록
 *  - songs: 정보 카드(버전), 레벨 정보 표 (속성은 표시하지 않는다)
 * 서열표 전체는 한 번만 받아서(묶음 단위 페이지를 이어 붙임) 기준 난이도, 추천, 내 기록, 묶음 통계를 모두 여기서 꺼낸다.
 * 서열표를 못 받아도(서열표가 없거나 오류) 곡 정보와 기록 등록은 그대로 쓸 수 있게, 서열표 쪽 칸만 비워 둔다.
 */
export function SongDetailView({
  songId,
  chartId,
  origin,
  userId,
  canEditTable = false,
  canEditJacket = false,
}: {
  songId: number;
  chartId: number | null;
  origin: SongDetailOrigin;
  userId: number;
  /** ROOT·ADMIN이면 true. 서열표 값(기준 난이도·추천도·속성) 수정 버튼을 보여 준다. 서버도 권한을 다시 검사한다. */
  canEditTable?: boolean;
  /** ROOT면 true. `관리`에 `재킷 바꾸기`를 보여 준다(공식 목록에 없는 곡의 재킷을 직접 넣는다). 서버도 권한을 다시 검사한다 */
  canEditJacket?: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [recordOpen, setRecordOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TableEntryTarget | null>(null);
  const [songEdit, setSongEdit] = useState<SongEditTarget | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [chartAddOpen, setChartAddOpen] = useState(false);
  const [jacketOpen, setJacketOpen] = useState(false);
  const { urlOf: jacketUrlOf } = useJackets();

  const song = useQuery({
    queryKey: songKeys.detail(songId),
    queryFn: ({ signal }) => fetchSongDetail(songId, signal),
  });

  const tables = useQuery({
    queryKey: tableKeys.list,
    queryFn: ({ signal }) => fetchDifficultyTables(signal),
    select: pickRatingTable,
  });
  const tableId = tables.data?.id ?? null;
  const groupsQuery = useQuery({
    queryKey: allGroupsKey(userId, tableId ?? 0),
    queryFn: ({ signal }) => fetchAllTierGroups(tableId ?? 0, signal),
    enabled: tableId !== null,
  });
  const groups = groupsQuery.data ?? null;

  const chart = song.data ? resolveChart(song.data.difficulties, chartId) : null;
  const found = chart && groups ? findChart(groups, chart.id) : null;

  const loggedIn = isLoggedInViewer(userId);
  const best = useQuery({
    queryKey: recordKeys.bestOfChart(userId, chart?.id ?? 0),
    queryFn: ({ signal }) => fetchBestRecord(chart?.id ?? 0, signal),
    enabled: chart !== null && loggedIn, // 비로그인(D43)은 내 기록이 없으므로 /records를 부르지 않는다(401 방지)
  });

  // 서열표를 받은 뒤에만 수정할 수 있다 (표 id와 현재 값이 필요하다). 표에 없는 채보는 "추가"가 된다.
  const openTableEdit = () => {
    if (!chart || !song.data || tableId === null) {
      return;
    }
    setEditTarget({
      tableId,
      songDifficultyId: chart.id,
      title: song.data.title,
      part: chart.instrumentPart,
      difficulty: chart.difficultyType,
      level: chart.level,
      tier: found?.group.tier ?? null,
      entry: found?.entry ?? null,
    });
  };
  // isSuccess: 서열표를 못 받았을 때(오류)는 found가 null이라 "추가"로 보이는데, 저장하면 이미 있는 줄을 빈 값으로 덮어쓸 수 있어서 숨긴다.
  const canShowTableEdit = canEditTable && chart !== null && tableId !== null && groupsQuery.isSuccess;

  const backBar = (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => router.back()}
        aria-label={t("Song.back")}
        title={t("Song.back")}
        className={BACK_BUTTON_CLASS}
      >
        <BackArrow />
      </button>
      <span className="text-sm font-semibold text-fg">{t("Songs.detailTitle")}</span>
      {origin === "table" && found ? (
        <span className="rounded-lg border border-ctl px-2 py-0.5 text-xs text-fg-sub">
          {t.rich("Song.tableHeading", { tier: formatTier(found.group.tier, t), num: (chunks) => <span className="font-num">{chunks}</span> })}
        </span>
      ) : (
        <span aria-hidden="true" className="w-12" />
      )}
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
          {errorMessage(song.error, t)}
        </ErrorRetry>
      </div>
    );
  }

  const data = song.data;
  const isTable = origin === "table";
  // 서열표에서 들어왔는데 이 채보가 서열표에 없다면 곡 목록 구성처럼 보여 주지 않고, 서열표 쪽 칸에 안내만 둔다
  const myRecord = loggedIn ? (
    <MyRecordCard
      mine={found?.entry.mine ?? null}
      best={best.data ?? null}
      chart={chart ? { part: chart.instrumentPart, difficulty: chart.difficultyType, level: chart.level } : null}
      emphasizeSrn={isTable}
      onRecord={() => setRecordOpen(true)}
    />
  ) : (
    // 비로그인 방문자(D43): 곡 정보는 보이지만 내 기록은 로그인해야 입력·표시된다
    <section aria-label={t("Song.myRecord")} className="flex flex-col items-start gap-3 rounded-lg border border-line bg-card p-4">
      <h2 className="text-sm font-semibold text-fg-sub">{t("Song.myRecord")}</h2>
      <p className="text-sm text-fg-sub">{t("Songs.loginToRecord")}</p>
      <Link href="/login" className="min-h-9 rounded-lg border border-ctl px-3 py-1 text-sm text-fg hover:bg-table-head">
        {t("Nav.login")}
      </Link>
    </section>
  );

  return (
    <div className="flex flex-col gap-4">
      {backBar}
      {/*
        모바일(한 열)은 곡 정보 → 내 기록(기록 등록 버튼) → 나머지 정보 → 같은 난이도의 곡 순서로 보인다.
        기록 등록이 이 화면의 가장 큰 목적인데, 예전에는 서열표 정보·다른 채보 아래에 있어 한참 내려가야 했다.
        그래서 두 열(md 이상) 껍데기는 모바일에서 `contents`로 없애고, 네 덩어리에 order를 줘서 순서를 바꾼다.
        md 이상에서는 order가 풀려(md:order-none) 예전처럼 왼쪽 열(정보) / 오른쪽 열(내 기록 + 같은 난이도의 곡)이다.
      */}
      <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:items-start">
        <div className="contents md:flex md:flex-col md:gap-4">
          <div className="order-1 flex flex-col gap-4 md:order-none">
            <SongHeader
              song={data}
              chart={chart}
              pattern={isTable ? (found?.entry.pattern ?? null) : null}
              action={
                // 세트리스트 담기(로그인했을 때만 그려진다)와 ROOT·ADMIN의 `관리`가 곡명 오른쪽에 나란히 놓인다
                <div className="flex items-center gap-2">
                  {chart ? <SetlistAddButton songDifficultyId={chart.id} title={data.title} /> : null}
                  {canEditTable ? (
                    <button
                      type="button"
                      onClick={() => setManageOpen(true)}
                      className="min-h-9 rounded-lg border border-ctl px-3 py-1 text-sm text-fg-sub hover:text-fg"
                    >
                      {t("Song.manage")}
                    </button>
                  ) : null}
                </div>
              }
            />
          </div>
          <div className="order-3 flex flex-col gap-4 md:order-none">
            {isTable ? (
              <>
                {found ? (
                  <>
                    <TableInfoCard group={found.group} entry={found.entry} />
                    {/* 같은 티어 유저 기록(D53): 로그인했을 때만. 기준 인원에 못 미치면 카드가 스스로 사라진다 */}
                    {chart && loggedIn ? <PeerStatsCard chartId={chart.id} userId={userId} /> : null}
                  </>
                ) : (
                  <p className="rounded-lg border border-line bg-card p-4 text-sm text-fg-sub">
                    {groupsQuery.isPending && tableId !== null
                      ? t("Song.tableLoading")
                      : t("Song.notInTable")}
                  </p>
                )}
                {groups ? <OtherCharts charts={entriesOfSong(groups, data.id).filter((e) => e.songDifficultyId !== chart?.id)} /> : null}
              </>
            ) : (
              <>
                <InfoCards song={data} />
                <LevelTable song={data} selectedId={chart?.id ?? null} groups={groups} />
                {chart && loggedIn ? <PeerStatsCard chartId={chart.id} userId={userId} /> : null}
              </>
            )}
          </div>
        </div>
        <div className="contents md:flex md:flex-col md:gap-4">
          <div className="order-2 flex flex-col gap-4 md:order-none">
            {myRecord}
            {/* 라이벌 기록(D56): 로그인 + 라이벌이 있을 때만. 없으면 카드가 스스로 그리지 않는다 */}
            {chart && loggedIn ? <RivalRecordsCard viewerId={userId} songDifficultyId={chart.id} /> : null}
          </div>
          {isTable && found ? (
            <div className="order-4 md:order-none">
              <GroupSongList group={found.group} index={found.index} />
            </div>
          ) : null}
        </div>
      </div>

      <TierHistorySection songId={data.id} />

      <RecordDialog
        chart={
          recordOpen && chart
            ? {
                songDifficultyId: chart.id,
                songId: data.id,
                title: data.title,
                part: chart.instrumentPart,
                difficulty: chart.difficultyType,
                level: chart.level,
                tier: found ? found.group.tier : null, // 서열표에 있는 채보면 입력 중 점수를 바로 계산한다
                pattern: found?.entry.pattern ?? null,
                ratingEnabled: found?.entry.ratingEnabled,
              }
            : null
        }
        onClose={() => setRecordOpen(false)}
      />
      <TableEntryEditDialog target={editTarget} onClose={() => setEditTarget(null)} />
      <SongEditDialog target={songEdit} onClose={() => setSongEdit(null)} />
      {canEditTable ? (
        <ChartAddDialog
          open={chartAddOpen}
          songId={data.id}
          existing={data.difficulties}
          // 서열표를 받은 상태에서만 서열표 값 칸을 보여 준다 (못 받았으면 채보만 추가하고 서열표는 나중에 `서열표에 추가`로)
          tableId={canShowTableEdit ? tableId : null}
          onClose={() => setChartAddOpen(false)}
        />
      ) : null}
      {canEditJacket ? (
        <JacketUploadDialog
          open={jacketOpen}
          onClose={() => setJacketOpen(false)}
          songId={data.id}
          songTitle={data.title}
          hasJacket={jacketUrlOf(data.id) !== null}
        />
      ) : null}
      {canEditTable ? (
        <SongManageDialog
          open={manageOpen}
          onClose={() => setManageOpen(false)}
          tableEditLabel={canShowTableEdit ? (found ? t("Song.editTableEntry") : t("Song.addToTable")) : null}
          onEditTable={openTableEdit}
          onEditSong={() => setSongEdit({ kind: "song", song: data })}
          onEditChart={chart ? () => setSongEdit({ kind: "chart", song: data, chart }) : null}
          onAddChart={availableCombos(data.difficulties).length > 0 ? () => setChartAddOpen(true) : null}
          onEditJacket={canEditJacket ? () => setJacketOpen(true) : null}
          songId={data.id}
          songTitle={data.title}
          chartId={chart?.id ?? null}
          chartLabel={chart ? `${partLabel(chart.instrumentPart)} ${difficultyLabel(chart.difficultyType)}` : null}
          onDeleted={(target) => {
            // 곡을 지웠으면 곡 상세는 더 볼 수 없으므로 목록으로, 채보만 지웠으면 같은 곡의 남은 채보로 (기록을 쌓지 않게 replace)
            router.replace(target === "song" ? (isTable ? "/table" : "/songs") : `/songs/${data.id}?from=${origin}`);
          }}
        />
      ) : null}
    </div>
  );
}
