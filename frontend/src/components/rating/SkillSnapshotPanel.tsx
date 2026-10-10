"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import { formatScore } from "@/lib/format";
import {
  blockReasonText,
  createSnapshot,
  fetchSnapshotStatus,
  fetchSnapshots,
  formatChange,
  snapshotKeys,
} from "@/lib/skill-snapshot";

/**
 * 레이팅 기록 (D32, DESIGN-UI 5장). 레이팅 화면 맨 아래.
 * 사용자가 `지금 레이팅 기록하기`를 누르면 그 시점의 합계·소계를 하루(서울 날짜)에 한 줄만 남기고, 날짜별 목록과 증감을 보여 준다.
 * 누를 수 없는 경우(오늘 이미 기록 / 레이팅에 기록이 없음 / 마지막 기록과 점수가 같음)는 버튼을 막고 이유를 글자로 적는다.
 * 같은 검사를 서버도 한다(화면의 버튼 상태는 편의일 뿐 규칙의 근거가 아니다).
 */
export function SkillSnapshotPanel({ userId }: { userId: number }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);

  const status = useQuery({
    queryKey: snapshotKeys.status(userId),
    queryFn: ({ signal }) => fetchSnapshotStatus(signal),
  });
  const list = useQuery({
    queryKey: snapshotKeys.list(userId, page),
    queryFn: ({ signal }) => fetchSnapshots(page, signal),
    placeholderData: keepPreviousData,
  });

  const record = useMutation({
    mutationFn: createSnapshot,
    onSuccess: async () => {
      setPage(0); // 방금 만든 줄이 맨 위에 보이게 첫 페이지로 돌아간다
      await queryClient.invalidateQueries({ queryKey: snapshotKeys.all(userId) });
      await queryClient.invalidateQueries({ queryKey: snapshotKeys.status(userId) });
    },
  });

  const blocked = status.data && !status.data.available ? status.data.reason : null;
  const canRecord = status.data?.available === true && !record.isPending;
  const data = list.data;

  return (
    <section aria-label="레이팅 기록" className="flex flex-col gap-3 rounded-[14px] border border-line bg-card p-4">
      <div>
        <h2 className="text-[15px] font-bold text-fg">레이팅 기록</h2>
        <p className="mt-0.5 text-xs text-fg-sub">누른 시점의 레이팅을 남겨 두고, 얼마나 올랐는지 날짜별로 비교합니다. 하루에 한 번, 점수가 달라졌을 때만 기록할 수 있습니다.</p>
      </div>

      <div className="flex flex-col items-start gap-1.5">
        <button
          type="button"
          disabled={!canRecord}
          onClick={() => record.mutate()}
          className="rounded-full bg-chip-on-bg px-4 py-1.5 text-sm font-semibold text-chip-on-fg enabled:hover:opacity-90 disabled:bg-table-head disabled:text-disabled"
        >
          {record.isPending ? "기록 중입니다." : "지금 레이팅 기록하기"}
        </button>
        {blocked ? <p className="text-xs text-fg-sub">{blockReasonText(blocked)}</p> : null}
        {status.isError ? <p className="text-xs text-fg-sub">기록할 수 있는지 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.</p> : null}
        {record.isError ? (
          <p role="alert" className="text-xs text-fg">
            {record.error instanceof ApiError ? record.error.message : "기록하지 못했습니다. 잠시 후 다시 시도해 주세요."}
          </p>
        ) : null}
      </div>

      {list.isError ? (
        <p role="alert" className="text-sm text-fg">
          {list.error instanceof ApiError ? list.error.message : "기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."}
        </p>
      ) : !data ? (
        <p className="text-sm text-fg-sub">불러오는 중입니다.</p>
      ) : data.content.length === 0 ? (
        <p className="text-sm text-fg-sub">아직 기록한 레이팅이 없습니다.</p>
      ) : (
        <>
          <ul aria-label="레이팅 기록 목록" className="flex flex-col">
            {data.content.map((row) => {
              const change = formatChange(row.change);
              return (
                <li key={row.id} className="flex items-baseline justify-between gap-3 border-t border-line py-2 first:border-t-0">
                  <span className="font-num text-sm text-fg-sub">{row.date}</span>
                  <span className="flex items-baseline gap-3">
                    <span className="font-num text-base font-semibold text-fg">{formatScore(row.totalScore)}</span>
                    {/* 증감은 부호 글자(▲ +/▼ -)가 있어서 색은 보조다 */}
                    <span data-direction={change.direction} className={`font-num w-24 text-right text-sm ${change.direction === "up" ? "text-done-text" : "text-fg-sub"}`}>
                      {change.text}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          {data.totalPages > 1 ? (
            <nav aria-label="기록 페이지 이동" className="flex items-center justify-center gap-3 text-sm text-fg-sub">
              <button
                type="button"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(p - 1, 0))}
                className="rounded-full border border-chip-line px-3 py-1 enabled:hover:text-fg disabled:text-disabled"
              >
                이전
              </button>
              <span className="font-num">
                {data.page + 1} / {data.totalPages}
              </span>
              <button
                type="button"
                disabled={page + 1 >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-full border border-chip-line px-3 py-1 enabled:hover:text-fg disabled:text-disabled"
              >
                다음
              </button>
            </nav>
          ) : null}
        </>
      )}
    </section>
  );
}
