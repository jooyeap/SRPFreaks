"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PlayersPreview } from "@/components/home/PlayersPreview";
import { TableProgressCard } from "@/components/home/TableProgressCard";
import { RatingSummary } from "@/components/rating/RatingSummary";
import {
  allGroupsKey,
  fetchAllTierGroups,
  fetchDifficultyTables,
  pickRatingTable,
  tableKeys,
  tableProgress,
} from "@/lib/difficulty-table";
import { fetchMySkill, skillKeys } from "@/lib/rating";

const SHORTCUTS = [
  { href: "/songs", title: "곡 목록", description: "레벨 폴더별로 전체 곡을 보고 검색합니다." },
  { href: "/table", title: "서열표", description: "기준 난이도별로 채보를 보고 기록을 입력합니다." },
  { href: "/rating", title: "레이팅", description: "단일 15·복합·이중·삼중 25 목록을 확인합니다." },
] as const;

/**
 * 로그인한 사용자의 홈: 내 레이팅 요약, 서열표 진행도, 유저 목록 미리보기, 바로가기.
 * 각 칸은 따로 불러와서 한쪽이 실패(또는 서열표 없음)해도 나머지는 그대로 보여 준다.
 * 서열표 쿼리 키는 곡 상세·묶음 페이지와 같아서(allGroupsKey) 캐시를 함께 쓴다.
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

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-fg">
        <span className="font-num">{name}</span>님의 홈
      </h1>

      {skill.data ? (
        <Link href="/rating" className="block rounded-[14px] hover:opacity-95" aria-label="레이팅 화면으로">
          <RatingSummary skill={skill.data} />
        </Link>
      ) : skill.isError ? (
        <p role="alert" className="text-sm text-fg">레이팅을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      ) : (
        <p className="text-sm text-fg-sub">레이팅을 불러오는 중입니다.</p>
      )}

      {groups.data ? (
        <TableProgressCard progress={tableProgress(groups.data)} />
      ) : groups.isError || tables.isError ? (
        <p role="alert" className="text-sm text-fg">서열표 진행도를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      ) : tables.isSuccess && tableId === null ? (
        <p className="text-sm text-fg-sub">SRN+ 서열표가 아직 없습니다.</p>
      ) : (
        <p className="text-sm text-fg-sub">서열표 진행도를 불러오는 중입니다.</p>
      )}

      <PlayersPreview viewerId={userId} />

      <ul className="grid gap-3 md:grid-cols-3">
        {SHORTCUTS.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="flex h-full flex-col gap-1 rounded-lg border border-line bg-card p-4 hover:bg-table-head">
              <span className="text-base font-semibold text-fg">{item.title}</span>
              <span className="text-sm text-fg-sub">{item.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
