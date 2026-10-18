"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Pager, usePaged } from "@/components/Pager";
import { useToast } from "@/components/Toast";
import { SetlistRecommend } from "@/components/setlist/SetlistRecommend";
import { SetlistSearch } from "@/components/setlist/SetlistSearch";
import { RecordDialog } from "@/components/record/RecordDialog";
import type { RecordChart } from "@/components/record/RecordForm";
import { ChartBadge } from "@/components/table/Badges";
import { StageBadge } from "@/components/table/StageBadge";
import { ApiError } from "@/lib/api";
import type { SetlistItemResponse } from "@/lib/api-types";
import { EMPTY_MARK, formatRate, formatTier } from "@/lib/format";
import {
  clearDoneSetlist,
  doneCount,
  fetchSetlist,
  removeFromSetlist,
  SETLIST_LIMIT,
  SETLIST_PAGE_SIZE,
  setlistKeys,
} from "@/lib/setlist";

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

/**
 * 마이페이지 `세트리스트` 탭 (D36): 게임장에 가기 전에 담아 둔 오늘 칠 채보 목록.
 * 위쪽 검색창(SetlistSearch)이나 그 아래 `내 실력대 추천`(SetlistRecommend, D37)으로 곡을 담는다. 줄마다 `기록 입력`(기존 기록 창)이 있고, 저장하면 서버가 계산한 `완료` 표시가 붙는다(줄은 지워지지 않는다).
 * `완료한 곡 비우기`로 다음 방문 전에 한 번에 정리한다. 30곡까지 담을 수 있어 10개씩 나눠 보인다.
 */
export function SetlistTab({ userId }: { userId: number }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [recording, setRecording] = useState<RecordChart | null>(null);

  const list = useQuery({ queryKey: setlistKeys.list(userId), queryFn: ({ signal }) => fetchSetlist(signal) });
  const items = list.data?.content ?? [];
  const { page, totalPages, pageItems, setPage } = usePaged(items, SETLIST_PAGE_SIZE);

  const refresh = () => queryClient.invalidateQueries({ queryKey: setlistKeys.all });
  const remove = useMutation({
    mutationFn: (id: number) => removeFromSetlist(id),
    onSuccess: async () => {
      toast("세트리스트에서 뺐습니다.");
      await refresh();
    },
    onError: (error) => toast(errorText(error)),
  });
  const clear = useMutation({
    mutationFn: () => clearDoneSetlist(),
    onSuccess: async (result) => {
      toast(`완료한 ${result.removed}곡을 비웠습니다.`);
      await refresh();
    },
    onError: (error) => toast(errorText(error)),
  });

  if (list.isPending) {
    return <p className="text-sm text-fg-sub">불러오는 중입니다.</p>;
  }
  if (list.isError) {
    return (
      <p role="alert" className="text-sm text-fg">
        {list.error instanceof ApiError ? list.error.message : "세트리스트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."}
      </p>
    );
  }

  const done = doneCount(items);
  const addedIds = new Set(items.map((i) => i.songDifficultyId));
  const full = items.length >= SETLIST_LIMIT;
  return (
    // 모바일·태블릿(lg 미만): 한 줄로 쌓는다(검색 → 추천 → 내 세트리스트). 데스크톱(lg 이상): 두 열(시안) — 왼쪽 검색·추천, 오른쪽 내 세트리스트.
    // 두 묶음 사이 간격(gap-3)은 안쪽 간격과 같아서 모바일 모양은 이전과 같다.
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
      <div className="flex flex-col gap-3">
        <SetlistSearch userId={userId} addedIds={addedIds} full={full} />
        <SetlistRecommend userId={userId} addedIds={addedIds} full={full} />
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-fg-sub">
            완료 <span className="font-num text-fg">{done}</span> / 전체 <span className="font-num text-fg">{items.length}</span>
            <span className="text-fg-dim"> (최대 {SETLIST_LIMIT}곡)</span>
          </p>
          <button
            type="button"
            disabled={done === 0 || clear.isPending}
            onClick={() => clear.mutate()}
            className="min-h-9 rounded-lg border border-chip-line px-3 text-sm text-fg-sub enabled:hover:text-fg disabled:text-disabled"
          >
            {clear.isPending ? "비우는 중" : "완료한 곡 비우기"}
          </button>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-fg-sub">
            담은 곡이 없습니다. 위 검색창에서 오늘 칠 곡을 찾아 담아 보세요.
          </p>
        ) : (
          <>
            <ul aria-label="세트리스트" className="flex flex-col gap-2">
              {pageItems.map((item) => (
                <SetlistRow
                  key={item.id}
                  item={item}
                  removing={remove.isPending && remove.variables === item.id}
                  onRecord={() =>
                    setRecording({
                      songDifficultyId: item.songDifficultyId,
                      title: item.title,
                      part: item.part,
                      difficulty: item.difficulty,
                      level: item.level,
                      tier: item.tier,
                    })
                  }
                  onRemove={() => remove.mutate(item.id)}
                />
              ))}
            </ul>
            <Pager page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </div>

      <RecordDialog chart={recording} onClose={() => setRecording(null)} />
    </div>
  );
}

function SetlistRow({
  item,
  removing,
  onRecord,
  onRemove,
}: {
  item: SetlistItemResponse;
  removing: boolean;
  onRecord: () => void;
  onRemove: () => void;
}) {
  const stage = item.mine?.stage ?? null;
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link href={`/songs/${item.songId}?chart=${item.songDifficultyId}`} className="block truncate text-sm font-bold text-fg hover:underline">
            {item.title}
          </Link>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <ChartBadge part={item.part} difficulty={item.difficulty} level={item.level} />
            <span className="text-xs text-fg-dim">
              레이팅 상수 난이도 <span className="font-num">{formatTier(item.tier)}</span>
            </span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          {stage ? <StageBadge stage={stage} /> : <span className="text-xs text-fg-faint">{EMPTY_MARK}</span>}
          <span className="mt-0.5 block font-num text-xs text-fg-sub">{formatRate(item.mine?.rate)}</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        {/* 완료는 색이 아니라 글자와 체크 아이콘으로 보인다 */}
        {item.done ? (
          <span className="flex items-center gap-1 text-sm font-bold text-fg">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5 9-10" />
            </svg>
            완료
          </span>
        ) : (
          <span className="text-sm text-fg-dim">미완료</span>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRecord}
            aria-label={`${item.title} 기록 입력`}
            className="min-h-9 rounded-lg border border-chip-line px-3 text-sm text-fg hover:bg-table-head"
          >
            기록 입력
          </button>
          <button
            type="button"
            disabled={removing}
            onClick={onRemove}
            aria-label={`${item.title} 세트리스트에서 빼기`}
            className="min-h-9 rounded-lg border border-chip-line px-3 text-sm text-fg-sub hover:text-fg disabled:opacity-60"
          >
            빼기
          </button>
        </div>
      </div>
    </li>
  );
}
