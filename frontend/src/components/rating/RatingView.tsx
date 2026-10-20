"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/Skeleton";
import { RatingEntryCard } from "@/components/rating/RatingEntryCard";
import { RatingSummary } from "@/components/rating/RatingSummary";
import { SkillSnapshotPanel } from "@/components/rating/SkillSnapshotPanel";
import { ScrollTopButton } from "@/components/ScrollTopButton";
import { TermHelp } from "@/components/TermHelp";
import { RatingInsights } from "@/components/rating/RatingInsights";
import { RatingGoalPlanner } from "@/components/rating/RatingGoalPlanner";
import { RatingTargetPlanner } from "@/components/rating/RatingTargetPlanner";
import { ApiError } from "@/lib/api";
import type { SkillEntryResponse, SkillResponse } from "@/lib/api-types";
import { formatScore } from "@/lib/format";
import { fetchMySkill, skillKeys } from "@/lib/rating";
import { ErrorRetry } from "@/components/ErrorRetry";
import { useTranslations } from "next-intl";

function Group({
  title,
  entries,
  limit,
  score,
  emptyText,
  onDeleteEntry,
}: {
  title: string;
  entries: SkillEntryResponse[];
  limit: number;
  /** 이 구역 채보의 점수 합계 (서버가 계산한 singleScore/otherScore) */
  score: number;
  emptyText: string;
  onDeleteEntry?: (entry: SkillEntryResponse) => void;
}) {
  const t = useTranslations();
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-num text-[17px] font-bold text-fg">
          {title}{" "}
          <TermHelp term={title === t("Chart.patternSingle") ? "single" : "other"} label={title} />{" "}
          <span className="font-num text-sm font-normal text-fg-sub">
            {entries.length}/{limit}
          </span>
        </h2>
        {/* 구역 합산: 위 요약 카드의 단일/복합·이중·삼중 소계와 같은 값이다 */}
        <p className="shrink-0 text-xs text-fg-dim">
          {t.rich("Rating.sectionSum", { n: (c) => <span className="font-num text-sm font-semibold text-fg">{c}</span>, score: formatScore(score) })}
        </p>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-fg-sub">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <RatingEntryCard key={entry.songDifficultyId} entry={entry} onDelete={onDeleteEntry} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * 레이팅 본문(요약 카드 + 단일 / 복합·이중·삼중 목록 + 안내). 내 레이팅 화면과 유저 상세(읽기 전용)가 함께 쓴다.
 * 합계와 목록은 모두 서버가 계산한 값을 그대로 보여 준다 (화면에서 다시 계산하지 않는다).
 * emptyHint: 목록이 모두 비었을 때의 안내. 내 화면은 서열표 링크, 남의 화면은 단순 문구를 넘긴다.
 */
export function RatingBody({
  skill,
  emptyHint,
  onDeleteEntry,
  afterSummary,
  footer,
}: {
  skill: SkillResponse;
  emptyHint: ReactNode;
  /** 요약 카드 바로 아래에 끼워 넣을 것(내 화면의 레이팅 예상 값). 유저 상세(남의 화면)는 넘기지 않는다 */
  afterSummary?: ReactNode;
  /** 목록과 안내 문구 맨 아래에 끼워 넣을 것(내 화면의 레이팅 기록) */
  footer?: ReactNode;
  /** 있으면 카드마다 `삭제` 버튼이 생긴다(유저 상세에서 관리자만, D29) */
  onDeleteEntry?: (entry: SkillEntryResponse) => void;
}) {
  const t = useTranslations();
  const empty = skill.single.length === 0 && skill.other.length === 0;
  return (
    <>
      <RatingSummary skill={skill} />
      {afterSummary}
      {empty ? <p className="text-sm text-fg-sub">{emptyHint}</p> : null}
      <Group
        title={t("Chart.patternSingle")}
        entries={skill.single}
        limit={skill.singleLimit}
        score={skill.singleScore}
        emptyText={t("Rating.emptySingle")}
        onDeleteEntry={onDeleteEntry}
      />
      <Group
        title={t("Rating.groupOther")}
        entries={skill.other}
        limit={skill.otherLimit}
        score={skill.otherScore}
        emptyText={t("Rating.emptyOther")}
        onDeleteEntry={onDeleteEntry}
      />
      <p className="text-xs text-fg-dim">
        {t("Rating.excludeNote")}
      </p>
      {footer}
    </>
  );
}

/**
 * 마이페이지의 레이팅 탭 본문(제목과 탭은 MyPageView가 그린다). 로그인한 사용자만 이 컴포넌트를 그린다. 서버는 항상 토큰의 사용자 본인 목록만 돌려준다.
 */
export function RatingView({ userId }: { userId: number }) {
  const t = useTranslations();
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: skillKeys.me(userId),
    queryFn: ({ signal }) => fetchMySkill(signal),
  });

  if (isPending) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton label={t("Common.loading")} className="h-[7.5rem]" />
        <Skeleton label={t("Rating.listLoading")} className="h-72" />
      </div>
    );
  }
  if (isError) {
    return (
      <ErrorRetry onRetry={() => void refetch()} retrying={isFetching}>
        {error instanceof ApiError ? error.message : t("Home.ratingLoadFailed")}
      </ErrorRetry>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <RatingBody
        skill={data}
        afterSummary={
          <>
            <RatingInsights userId={userId} />
            <RatingGoalPlanner userId={userId} skill={data} />
            <RatingTargetPlanner userId={userId} skill={data} />
          </>
        }
        footer={<SkillSnapshotPanel userId={userId} />}
        emptyHint={
          <>
            {t("Rating.noRatedRecords")}{" "}
            <Link href="/table" className="underline">
              {t("Home.tableTitle")}
            </Link>
            {t("Rating.enterRecordsAt")}
          </>
        }
      />
      <ScrollTopButton />
    </div>
  );
}
