"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { ReactNode } from "react";
import { RatingEntryCard } from "@/components/rating/RatingEntryCard";
import { RatingSummary } from "@/components/rating/RatingSummary";
import { RatingTargetPlanner } from "@/components/rating/RatingTargetPlanner";
import { ApiError } from "@/lib/api";
import type { SkillEntryResponse, SkillResponse } from "@/lib/api-types";
import { formatScore } from "@/lib/format";
import { fetchMySkill, skillKeys } from "@/lib/rating";

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
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-num text-[17px] font-bold text-fg">
          {title}{" "}
          <span className="font-num text-sm font-normal text-fg-sub">
            {entries.length}/{limit}
          </span>
        </h2>
        {/* 구역 합산: 위 요약 카드의 단일/복합·이중·삼중 소계와 같은 값이다 */}
        <p className="shrink-0 text-xs text-fg-dim">
          합산 <span className="font-num text-sm font-semibold text-fg">{formatScore(score)}</span>
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
}: {
  skill: SkillResponse;
  emptyHint: ReactNode;
  /** 요약 카드 바로 아래에 끼워 넣을 것(내 화면의 점수 역산). 유저 상세(남의 화면)는 넘기지 않는다 */
  afterSummary?: ReactNode;
  /** 있으면 카드마다 `삭제` 버튼이 생긴다(유저 상세에서 관리자만, D29) */
  onDeleteEntry?: (entry: SkillEntryResponse) => void;
}) {
  const empty = skill.single.length === 0 && skill.other.length === 0;
  return (
    <>
      <RatingSummary skill={skill} />
      {afterSummary}
      {empty ? <p className="text-sm text-fg-sub">{emptyHint}</p> : null}
      <Group
        title="단일"
        entries={skill.single}
        limit={skill.singleLimit}
        score={skill.singleScore}
        emptyText="속성이 단일인 채보의 기록이 아직 없습니다."
        onDeleteEntry={onDeleteEntry}
      />
      <Group
        title="복합·이중·삼중"
        entries={skill.other}
        limit={skill.otherLimit}
        score={skill.otherScore}
        emptyText="속성이 복합·이중·삼중인 채보의 기록이 아직 없습니다."
        onDeleteEntry={onDeleteEntry}
      />
      <p className="text-xs text-fg-dim">
        레이팅 상수 난이도와 속성이 없는 채보는 레이팅에서 제외됩니다. 같은 곡의 다른 채보는 각각 계산합니다.
      </p>
    </>
  );
}

/**
 * 레이팅 화면. 로그인한 사용자만 이 컴포넌트를 그린다. 서버는 항상 토큰의 사용자 본인 목록만 돌려준다.
 */
export function RatingView({ userId }: { userId: number }) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: skillKeys.me(userId),
    queryFn: ({ signal }) => fetchMySkill(signal),
  });

  if (isPending) {
    return <p className="text-sm text-fg-sub">불러오는 중입니다.</p>;
  }
  if (isError) {
    return (
      <p role="alert" className="text-sm text-fg">
        {error instanceof ApiError ? error.message : "레이팅을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-fg">레이팅</h1>
      <RatingBody
        skill={data}
        afterSummary={<RatingTargetPlanner userId={userId} skill={data} />}
        emptyHint={
          <>
            레이팅에 들어갈 기록이 아직 없습니다.{" "}
            <Link href="/table" className="underline">
              서열표
            </Link>
            에서 기록을 입력해 주세요.
          </>
        }
      />
    </div>
  );
}
