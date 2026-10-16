"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { CompareBody } from "@/components/rating/SnapshotCompare";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import type { SkillEntryResponse, SkillResponse } from "@/lib/api-types";
import { difficultyLabel, formatScore, partLabel } from "@/lib/format";
import { atRiskEntries, goalHint } from "@/lib/rating";
import { createSnapshot, fetchCompareCurrent, fetchSnapshotStatus, formatChange, snapshotKeys } from "@/lib/skill-snapshot";

/**
 * 마이페이지 레이팅 탭의 "지금 상황" 카드 (D32 확장). 요약 카드 바로 아래에 놓인다.
 *  1) 기록 제안: 오늘 아직 기록하지 않았고 점수가 달라졌을 때만 눈에 띄게 `지금 레이팅 기록하기`를 권한다.
 *     자동으로 저장하지 않는다 — 기록은 사용자가 누를 때만 남는다(D32). 하루 1회·변경 없음 검사는 서버가 한다.
 *  2) 요약 한 줄: 마지막 기록 대비 얼마나 달라졌고 새로 들어온 곡이 몇 개인지. 누르면 곡별 비교를 펼친다.
 *  3) 목표 안내: 곡 하나로 다음 티어에 가려면 몇 점짜리 곡이 필요한지.
 *  4) 곧 빠질 곡: 꽉 찬 구역에서 맨 아래 곡과 점수가 비슷한 곡.
 * 모두 이미 받은 레이팅 목록과 비교 API 결과를 화면에서 맞춰 보는 것이라 새로 저장하는 값이 없다.
 */
export function RatingInsights({ userId, skill }: { userId: number; skill: SkillResponse }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const detailId = useId();
  const [detailOpen, setDetailOpen] = useState(false);

  const status = useQuery({
    queryKey: snapshotKeys.status(userId),
    queryFn: ({ signal }) => fetchSnapshotStatus(signal),
  });
  const compare = useQuery({
    queryKey: snapshotKeys.compareCurrent(userId),
    queryFn: ({ signal }) => fetchCompareCurrent(signal),
  });
  const record = useMutation({
    mutationFn: createSnapshot,
    onSuccess: async () => {
      toast("레이팅을 기록했습니다.");
      await queryClient.invalidateQueries({ queryKey: snapshotKeys.all(userId) });
      await queryClient.invalidateQueries({ queryKey: snapshotKeys.status(userId) });
    },
  });

  const canRecord = status.data?.available === true;
  // 서버가 비교할 수 없다고 답하면(처음이거나 상세가 없는 예전 기록) 요약 한 줄은 그리지 않는다
  const result = compare.data?.available === true ? compare.data : null;
  const goal = goalHint(skill);
  const single = atRiskEntries(skill.single, skill.singleLimit);
  const other = atRiskEntries(skill.other, skill.otherLimit);

  return (
    <div className="flex flex-col gap-3">
      {canRecord ? (
        <section aria-label="레이팅 기록 제안" className="flex flex-col gap-2 rounded-[14px] border border-chip-on-bg bg-card p-4">
          <p className="text-sm font-semibold text-fg">
            {result
              ? `마지막 기록(${result.fromDate}) 이후 레이팅이 ${formatChange(result.totalChange).text} 달라졌습니다.`
              : compare.data?.reason === "NO_SNAPSHOT"
                ? "아직 기록한 레이팅이 없습니다."
                : "오늘 레이팅을 기록할 수 있습니다."}
          </p>
          <p className="text-xs text-fg-sub">지금 점수를 기록으로 남겨 두면 나중에 얼마나 올랐는지 비교할 수 있습니다.</p>
          <div>
            <button
              type="button"
              disabled={record.isPending}
              onClick={() => record.mutate()}
              className="min-h-11 rounded-full bg-chip-on-bg px-5 text-sm font-semibold text-chip-on-fg enabled:hover:opacity-90 disabled:bg-table-head disabled:text-disabled"
            >
              {record.isPending ? "기록 중입니다." : "지금 레이팅 기록하기"}
            </button>
          </div>
          {record.isError ? (
            <p role="alert" className="text-xs text-fg">
              {record.error instanceof ApiError ? record.error.message : "기록하지 못했습니다. 잠시 후 다시 시도해 주세요."}
            </p>
          ) : null}
        </section>
      ) : null}

      {result || goal || single.length > 0 || other.length > 0 ? (
        <section aria-label="레이팅 현황" className="flex flex-col gap-3 rounded-[14px] border border-line bg-card p-4">
          {result ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                aria-expanded={detailOpen}
                aria-controls={detailId}
                onClick={() => setDetailOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <span className="text-sm text-fg">
                  마지막 기록({result.fromDate}) 대비{" "}
                  <span className="font-num font-semibold">{formatChange(result.totalChange).text}</span>
                  {" · "}새로 들어온 곡 <span className="font-num font-semibold">{result.entered.length}</span>개
                </span>
                <span aria-hidden="true" className="shrink-0 text-fg-dim">
                  {detailOpen ? "▴" : "▾"}
                </span>
              </button>
              {detailOpen ? (
                <div id={detailId} className="border-t border-line pt-2">
                  <CompareBody result={result} />
                </div>
              ) : null}
            </div>
          ) : null}

          {goal ? (
            <p className="text-sm leading-relaxed text-fg-sub">
              <span className="font-semibold text-fg">목표</span> 다음 티어 {goal.nextDisplayName}까지{" "}
              <span className="font-num text-fg">{formatScore(goal.remaining)}</span>점.{" "}
              {goal.groupName}에서 <span className="font-num text-fg">{formatScore(goal.needScore)}</span>점 이상인 곡이 하나 들어오면
              {goal.replacedScore === null
                ? " 도달합니다."
                : ` (맨 아래 ${formatScore(goal.replacedScore)}점 곡이 밀려납니다) 도달합니다.`}
            </p>
          ) : null}

          {single.length > 0 || other.length > 0 ? (
            <section aria-label="곧 빠질 곡" className="flex flex-col gap-1">
              <h3 className="text-xs font-bold text-fg-sub">곧 빠질 곡</h3>
              <p className="text-xs text-fg-dim">구역이 가득 찼을 때 맨 아래 곡과 점수가 비슷한 곡입니다. 더 높은 곡이 들어오면 먼저 밀려납니다.</p>
              <AtRiskList title="단일" entries={single} />
              <AtRiskList title="복합·이중·삼중" entries={other} />
            </section>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function AtRiskList({ title, entries }: { title: string; entries: SkillEntryResponse[] }) {
  if (entries.length === 0) {
    return null;
  }
  return (
    <ul aria-label={`${title} 곧 빠질 곡`} className="flex flex-col">
      {entries.map((e) => (
        <li key={e.songDifficultyId} className="flex items-center gap-2 border-t border-line py-1.5 text-sm first:border-t-0">
          <span className="w-6 shrink-0 font-num text-xs text-fg-dim">{e.rank}</span>
          <span className="min-w-0 flex-1 truncate text-fg">{e.title}</span>
          <span className="shrink-0 text-xs text-fg-dim">
            {partLabel(e.part)} {difficultyLabel(e.difficulty)}
          </span>
          <span className="shrink-0 font-num text-xs text-fg-sub">{formatScore(e.score)}</span>
        </li>
      ))}
    </ul>
  );
}
