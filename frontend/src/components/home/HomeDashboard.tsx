"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { NavIcon } from "@/components/NavIcon";
import { Skeleton } from "@/components/Skeleton";
import { HomeNotices } from "@/components/home/HomeNotices";
import { PlayersPreview } from "@/components/home/PlayersPreview";
import { ProgressCard, type ProgressPanel } from "@/components/home/ProgressCard";
import { RatingSummary } from "@/components/rating/RatingSummary";
import {
  allGroupsKey,
  fetchAllTierGroups,
  fetchDifficultyTables,
  pickRatingTable,
  tableKeys,
  decidedGroups,
  tableProgress,
} from "@/lib/difficulty-table";
import { folderProgress } from "@/lib/progress";
import { fetchMySkill, skillKeys } from "@/lib/rating";
import { fetchChartFolders, songListKeys } from "@/lib/song-list";

// 아이콘은 헤더 메뉴·하단 탭바와 같은 것을 쓴다(lib/nav.ts): 곡 목록 = songs, 서열표 = table, 마이페이지 = rating
const SHORTCUTS = [
  { href: "/songs", title: "곡 목록", icon: "songs", description: "레벨 폴더별로 전체 곡을 보고 검색합니다." },
  { href: "/table", title: "서열표", icon: "table", description: "레이팅 상수 난이도별로 채보를 보고 기록을 입력합니다." },
  { href: "/me", title: "마이페이지", icon: "rating", description: "내 레이팅(단일 15·복합·이중·삼중 25 목록)과 달성 현황을 확인합니다." },
] as const;

/**
 * 로그인한 사용자의 홈: 내 레이팅 요약, 진행도(서열표·곡 목록 탭), 유저 목록 미리보기, 바로가기.
 * 각 칸은 따로 불러와서 한쪽이 실패(또는 서열표 없음)해도 나머지는 그대로 보여 준다.
 * 서열표 쿼리 키는 곡 상세·묶음 페이지와 같고(allGroupsKey), 곡 목록은 곡 목록 화면의 "필터 없음" 폴더 키와 같아서 캐시를 함께 쓴다.
 */
export function HomeDashboard({ userId, name }: { userId: number; name: string }) {
  const skill = useQuery({
    queryKey: skillKeys.me(userId),
    queryFn: ({ signal }) => fetchMySkill(signal),
  });
  const tables = useQuery({
    queryKey: tableKeys.list,
    queryFn: ({ signal }) => fetchDifficultyTables(signal),
    select: pickRatingTable,
  });
  const tableId = tables.data?.id ?? null;
  const groups = useQuery({
    queryKey: allGroupsKey(userId, tableId ?? 0),
    queryFn: ({ signal }) => fetchAllTierGroups(tableId ?? 0, signal),
    enabled: tableId !== null,
  });
  // 곡 목록 탭: 레벨 폴더별 통계(필터 없음)를 합친다. 두 탭을 모두 미리 불러와 탭을 바꿀 때 기다리지 않게 한다
  const folders = useQuery({
    queryKey: songListKeys.folders(userId),
    queryFn: ({ signal }) => fetchChartFolders(signal),
  });

  const tablePanel: ProgressPanel = groups.data
    // 기준 난이도가 없는 `미정` 묶음은 서열표 화면과 같이 홈 서열표 진행도에서도 뺀다(합계·칸 지도 모두)
    ? { kind: "ready", progress: tableProgress(decidedGroups(groups.data)) }
    : groups.isError || tables.isError
      ? { kind: "error" }
      : tables.isSuccess && tableId === null
        ? { kind: "empty", message: "SRN+ 서열표가 아직 없습니다." }
        : { kind: "loading" };
  const songsPanel: ProgressPanel = folders.data
    ? { kind: "ready", progress: folderProgress(folders.data.folders) }
    : folders.isError
      ? { kind: "error" }
      : { kind: "loading" };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-fg">
        <span className="font-num">{name}</span>님의 홈
      </h1>

      <HomeNotices viewerId={userId} />

      {skill.data ? (
        <Link href="/me" className="block rounded-2xl hover:opacity-95" aria-label="마이페이지로">
          <RatingSummary skill={skill.data} />
        </Link>
      ) : skill.isError ? (
        <p role="alert" className="text-sm text-fg">레이팅을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      ) : (
        <Skeleton label="레이팅을 불러오는 중입니다." className="h-[7.5rem]" />
      )}

      <ProgressCard table={tablePanel} songs={songsPanel} />

      <PlayersPreview viewerId={userId} />

      <ul className="grid gap-3 md:grid-cols-3">
        {SHORTCUTS.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="flex h-full flex-col gap-1 rounded-lg border border-line bg-card p-4 hover:bg-table-head">
              <span className="flex items-center gap-2 text-base font-semibold text-fg">
                <NavIcon name={item.icon} />
                {item.title}
              </span>
              <span className="text-sm text-fg-sub">{item.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
