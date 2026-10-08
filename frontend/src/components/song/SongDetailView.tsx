"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RecordDialog } from "@/components/record/RecordDialog";
import { MyRecordCard } from "@/components/song/MyRecordCard";
import { SongHeader } from "@/components/song/SongHeader";
import { TableEntryEditDialog, type TableEntryTarget } from "@/components/song/TableEntryEditDialog";
import { InfoCards, LevelTable } from "@/components/song/SongInfo";
import { GroupSongList, OtherCharts, TableInfoCard } from "@/components/song/TableContext";
import { ApiError } from "@/lib/api";
import { allGroupsKey, fetchAllTierGroups, fetchDifficultyTables, pickRatingTable, tableKeys } from "@/lib/difficulty-table";
import { formatTier } from "@/lib/format";
import { fetchBestRecord, recordKeys } from "@/lib/records";
import { entriesOfSong, fetchSongDetail, findChart, resolveChart, songKeys, type SongDetailOrigin } from "@/lib/songs";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.status === 404 ? "곡을 찾을 수 없습니다." : error.message;
  }
  return "곡 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

/**
 * 곡 상세. 어디서 들어왔는지(origin)에 따라 구성이 다르다 (DESIGN-UI 6장).
 *  - table: 서열표 정보, 속성 칩, 이 곡의 다른 채보, 같은 묶음의 곡 목록
 *  - songs: 정보 카드(BPM·노트 수·버전), 레벨 정보 표 (속성은 표시하지 않는다)
 * 서열표 전체는 한 번만 받아서(묶음 단위 페이지를 이어 붙임) 기준 난이도, 추천, 내 기록, 묶음 통계를 모두 여기서 꺼낸다.
 * 서열표를 못 받아도(서열표가 없거나 오류) 곡 정보와 기록 등록은 그대로 쓸 수 있게, 서열표 쪽 칸만 비워 둔다.
 */
export function SongDetailView({
  songId,
  chartId,
  origin,
  userId,
  canEditTable = false,
}: {
  songId: number;
  chartId: number | null;
  origin: SongDetailOrigin;
  userId: number;
  /** ROOT·ADMIN이면 true. 서열표 값(기준 난이도·추천도·속성) 수정 버튼을 보여 준다. 서버도 권한을 다시 검사한다. */
  canEditTable?: boolean;
}) {
  const router = useRouter();
  const [recordOpen, setRecordOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TableEntryTarget | null>(null);

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

  const best = useQuery({
    queryKey: recordKeys.bestOfChart(userId, chart?.id ?? 0),
    queryFn: ({ signal }) => fetchBestRecord(chart?.id ?? 0, signal),
    enabled: chart !== null,
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
        className="rounded-full border border-chip-line px-3 py-1 text-sm text-fg-sub hover:text-fg"
      >
        뒤로
      </button>
      <span className="text-sm font-semibold text-fg">곡 상세</span>
      {origin === "table" && found ? (
        <span className="rounded-full border border-chip-line px-2 py-0.5 text-xs text-fg-sub">
          SRN+ 서열표 · <span className="font-num">{formatTier(found.group.tier)}</span>
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
        <p className="text-sm text-fg-sub">불러오는 중입니다.</p>
      </div>
    );
  }
  if (song.isError) {
    return (
      <div className="flex flex-col gap-4">
        {backBar}
        <p role="alert" className="text-sm text-fg">
          {errorMessage(song.error)}
        </p>
      </div>
    );
  }

  const data = song.data;
  const isTable = origin === "table";
  // 서열표에서 들어왔는데 이 채보가 서열표에 없다면 곡 목록 구성처럼 보여 주지 않고, 서열표 쪽 칸에 안내만 둔다
  const myRecord = (
    <MyRecordCard
      mine={found?.entry.mine ?? null}
      best={best.data ?? null}
      chart={chart ? { part: chart.instrumentPart, difficulty: chart.difficultyType, level: chart.level } : null}
      emphasizeSrn={isTable}
      onRecord={() => setRecordOpen(true)}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {backBar}
      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <div className="flex flex-col gap-4">
          <SongHeader song={data} chart={chart} pattern={isTable ? (found?.entry.pattern ?? null) : null} />
          {canShowTableEdit ? (
            <button
              type="button"
              onClick={openTableEdit}
              className="self-start rounded-full border border-chip-line px-3 py-1 text-sm text-fg-sub hover:text-fg"
            >
              {found ? "서열표 값 수정" : "서열표에 추가"}
            </button>
          ) : null}
          {isTable ? (
            <>
              {found ? (
                <TableInfoCard group={found.group} entry={found.entry} />
              ) : (
                <p className="rounded-lg border border-line bg-card p-4 text-sm text-fg-sub">
                  {groupsQuery.isPending && tableId !== null
                    ? "서열표 정보를 불러오는 중입니다."
                    : "이 채보는 서열표에 없습니다."}
                </p>
              )}
              {groups ? <OtherCharts charts={entriesOfSong(groups, data.id).filter((e) => e.songDifficultyId !== chart?.id)} /> : null}
            </>
          ) : (
            <>
              <InfoCards song={data} chart={chart} />
              <LevelTable song={data} selectedId={chart?.id ?? null} groups={groups} />
            </>
          )}
        </div>
        <div className="flex flex-col gap-4">
          {myRecord}
          {isTable && found ? <GroupSongList group={found.group} index={found.index} /> : null}
        </div>
      </div>

      <RecordDialog
        chart={
          recordOpen && chart
            ? {
                songDifficultyId: chart.id,
                title: data.title,
                part: chart.instrumentPart,
                difficulty: chart.difficultyType,
                level: chart.level,
              }
            : null
        }
        onClose={() => setRecordOpen(false)}
      />
      <TableEntryEditDialog target={editTarget} onClose={() => setEditTarget(null)} />
    </div>
  );
}
