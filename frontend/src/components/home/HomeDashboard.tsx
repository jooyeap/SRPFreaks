"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { NavIcon } from "@/components/NavIcon";
import { Skeleton } from "@/components/Skeleton";
import { ImportEntryLink } from "@/components/import/ImportEntryLink";
import { WelcomeGuide } from "@/components/home/WelcomeGuide";
import { HomeNotices } from "@/components/home/HomeNotices";
import { PlayersPreview } from "@/components/home/PlayersPreview";
import { ProgressCard, type ProgressPanel } from "@/components/home/ProgressCard";
import { RatingSummary } from "@/components/rating/RatingSummary";
import { HomeSnapshotLine } from "@/components/home/HomeSnapshotLine";
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
import { fetchMyPlayLevel, fetchMySkill, skillKeys } from "@/lib/rating";
import { fetchChartFolders, songListKeys } from "@/lib/song-list";
import { useWelcomeHidden } from "@/lib/welcome-guide";
import { ErrorRetry } from "@/components/ErrorRetry";
import { useTranslations } from "next-intl";

// 아이콘은 헤더 메뉴·하단 탭바와 같은 것을 쓴다(lib/nav.ts): 곡 목록 = songs, 서열표 = table, 마이페이지 = rating
const SHORTCUTS = [
  { href: "/songs", title: "songsTitle", icon: "songs", description: "songsDesc" },
  { href: "/table", title: "tableTitle", icon: "table", description: "tableDesc" },
  { href: "/me", title: "myTitle", icon: "rating", description: "myDesc" },
] as const;

/**
 * 로그인한 사용자의 홈: 내 레이팅 요약, 진행도(서열표·곡 목록 탭), (새 공지가 있으면) 공지, 유저 목록 미리보기, 바로가기(넓은 화면만).
 * 각 칸은 따로 불러와서 한쪽이 실패(또는 서열표 없음)해도 나머지는 그대로 보여 준다.
 * 서열표 쿼리 키는 곡 상세·묶음 페이지와 같고(allGroupsKey), 곡 목록은 곡 목록 화면의 "필터 없음" 폴더 키와 같아서 캐시를 함께 쓴다.
 */
export function HomeDashboard({ userId, name }: { userId: number; name: string }) {
  const t = useTranslations("Home");
  // 서열표 진행도 같은 공용 계산 함수는 전체 경로(`Ns.key`) 번역기를 받는다
  const tRoot = useTranslations();
  const skill = useQuery({
    queryKey: skillKeys.me(userId),
    queryFn: ({ signal }) => fetchMySkill(signal),
  });
  // 내 평균 난이도: 진행도 카드의 `가장 비어 있는 구간`을 평균 ±0.1로 좁힌다. 못 받거나 READY가 아니면 예전처럼 전체에서 고른다
  const playLevel = useQuery({
    queryKey: skillKeys.playLevel(userId),
    queryFn: ({ signal }) => fetchMyPlayLevel(signal),
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

  // 시작 안내: 레이팅 목록이 비어 있고(= 레이팅에 반영되는 기록이 아직 없고) 숨기지 않았을 때만. 기록이 생기면 저절로 사라진다
  const welcomeHidden = useWelcomeHidden();
  const showWelcome = !welcomeHidden && skill.data !== undefined && skill.data.single.length + skill.data.other.length === 0;

  const tablePanel: ProgressPanel = groups.data
    // 기준 난이도가 없는 `미정` 묶음은 서열표 화면과 같이 홈 서열표 진행도에서도 뺀다(합계·칸 지도 모두)
    ? { kind: "ready", progress: tableProgress(decidedGroups(groups.data), tRoot) }
    : groups.isError || tables.isError
      ? { kind: "error" }
      : tables.isSuccess && tableId === null
        ? { kind: "empty", message: t("tableEmpty") }
        : { kind: "loading" };
  const songsPanel: ProgressPanel = folders.data
    ? { kind: "ready", progress: folderProgress(folders.data.folders) }
    : folders.isError
      ? { kind: "error" }
      : { kind: "loading" };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-fg">
        {t.rich("greeting", { name, num: (chunks) => <span className="font-num">{chunks}</span> })}
      </h1>

      {showWelcome ? <WelcomeGuide /> : null}

      {skill.data ? (
        <Link href="/me" className="block rounded-2xl hover:opacity-95" aria-label={t("toMyPage")}>
          <RatingSummary skill={skill.data} />
        </Link>
      ) : skill.isError ? (
        <ErrorRetry onRetry={() => void skill.refetch()} retrying={skill.isFetching}>
          {t("ratingLoadFailed")}
        </ErrorRetry>
      ) : (
        <Skeleton label={t("ratingLoading")} className="h-[7.5rem]" />
      )}
      {/* 레이팅 기록 한 줄(점수가 바뀌었을 때만 보인다). 레이팅을 불러온 뒤에만 그린다 */}
      {skill.data ? <HomeSnapshotLine userId={userId} /> : null}

      <ProgressCard table={tablePanel} songs={songsPanel} average={playLevel.data?.status === "READY" ? playLevel.data.tier : null} skill={skill.data ?? null} />

      {/* 시작 안내에 가져오기 카드가 이미 있으면 중복이라 뺀다 */}
      {showWelcome ? null : <ImportEntryLink />}

      {/* 새 공지(최근 7일)가 있을 때만 그려진다. 예전에는 맨 위였지만 레이팅·진행도가 홈의 주인공이라 아래로 내렸다(2026-11-02) */}
      <HomeNotices viewerId={userId} />

      <PlayersPreview viewerId={userId} />

      {/* 바로가기는 하단 탭바·더보기와 겹쳐서 모바일(md 미만)에서는 숨긴다. 넓은 화면에서는 그대로 둔다(2026-11-02) */}
      <ul className="hidden gap-3 md:grid md:grid-cols-3">
        {SHORTCUTS.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="flex h-full flex-col gap-1 rounded-lg border border-line bg-card p-4 hover:bg-table-head">
              <span className="flex items-center gap-2 text-base font-semibold text-fg">
                <NavIcon name={item.icon} />
                {t(item.title)}
              </span>
              <span className="text-sm text-fg-sub">{t(item.description)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
