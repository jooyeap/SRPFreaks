"use client";

import { SongJacket } from "@/components/SongJacket";
import { useJackets } from "@/lib/jackets";
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
import { StageRatePill } from "@/components/table/StageRatePill";
import { patternLabel } from "@/lib/chart-labels";
import { ApiError } from "@/lib/api";
import type { SetlistItemResponse } from "@/lib/api-types";
import { EMPTY_MARK, formatTier } from "@/lib/format";
import {
  clearDoneSetlist,
  doneCount,
  fetchSetlist,
  removeFromSetlist,
  SETLIST_LIMIT,
  SETLIST_PAGE_SIZE,
  setlistKeys,
} from "@/lib/setlist";
import { ErrorRetry } from "@/components/ErrorRetry";
import { useTranslations } from "next-intl";
import type { Translator } from "@/i18n/translator";

/** 세트리스트 줄을 기록 창이 받는 채보 정보로 바꾼다 */
function toRecordChart(item: SetlistItemResponse): RecordChart {
  return {
    songDifficultyId: item.songDifficultyId,
    songId: item.songId,
    title: item.title,
    part: item.part,
    difficulty: item.difficulty,
    level: item.level,
    tier: item.tier,
  };
}

function errorText(error: unknown, t: Translator): string {
  return error instanceof ApiError ? error.message : t("Common.actionFailed");
}

/**
 * 마이페이지 `세트리스트` 탭 (D36): 게임장에 가기 전에 담아 둔 오늘 칠 채보 목록.
 * 위쪽 검색창(SetlistSearch)이나 그 아래 `내 실력대 추천`(SetlistRecommend, D37)으로 곡을 담는다. 줄마다 `기록 입력`(기존 기록 창)이 있고, 저장하면 서버가 계산한 `완료` 표시가 붙는다(줄은 지워지지 않는다).
 * `완료한 곡 비우기`로 다음 방문 전에 한 번에 정리한다. 30곡까지 담을 수 있어 10개씩 나눠 보인다.
 */
export function SetlistTab({ userId }: { userId: number }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [recording, setRecording] = useState<RecordChart | null>(null);

  const list = useQuery({ queryKey: setlistKeys.list(userId), queryFn: ({ signal }) => fetchSetlist(signal) });
  const items = list.data?.content ?? [];
  const { page, totalPages, pageItems, setPage } = usePaged(items, SETLIST_PAGE_SIZE);

  const refresh = () => queryClient.invalidateQueries({ queryKey: setlistKeys.all });

  /**
   * 세트리스트에서 기록을 저장하면 결과 카드에 `다음 곡 ›` 버튼이 생기고, 누르면 창을 닫지 않고 세트리스트의 다음 곡 입력으로 넘어간다(게임장에서 곡마다 창을 다시 여는 수고를 줄인다).
   * 지금 곡 뒤쪽에서 아직 완료하지 않은 첫 줄, 없으면 앞쪽의 첫 미완료 줄이다. 방금 저장한 곡은 서버의 완료 표시가 아직 안 바뀌었을 수 있어 직접 뺀다.
   * 더 입력할 곡이 없으면 null을 돌려줘서 창이 평소처럼 닫힌다. 
   */
  const nextChartAfterSave = (saved: RecordChart): RecordChart | null => {
    const index = items.findIndex((item) => item.songDifficultyId === saved.songDifficultyId);
    const order = [...items.slice(index + 1), ...items.slice(0, Math.max(index, 0))];
    const next = order.find((item) => !item.done && item.songDifficultyId !== saved.songDifficultyId);
    return next ? toRecordChart(next) : null;
  };
  const remove = useMutation({
    mutationFn: (id: number) => removeFromSetlist(id),
    onSuccess: async () => {
      toast(t("Setlist.removed"));
      await refresh();
    },
    onError: (error) => toast(errorText(error, t), { kind: "error" }),
  });
  const clear = useMutation({
    mutationFn: () => clearDoneSetlist(),
    onSuccess: async (result) => {
      toast(t("Setlist.clearedToast", { count: result.removed }));
      await refresh();
    },
    onError: (error) => toast(errorText(error, t), { kind: "error" }),
  });

  if (list.isPending) {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  if (list.isError) {
    return (
      <ErrorRetry onRetry={() => void list.refetch()} retrying={list.isFetching}>
        {list.error instanceof ApiError ? list.error.message : t("Setlist.loadFailed")}
      </ErrorRetry>
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
            {t.rich("Setlist.doneTotal", { n: (c) => <span className="font-num text-fg">{c}</span>, done, total: items.length })}
            <span className="text-fg-dim">{t("Setlist.maxSongs", { limit: SETLIST_LIMIT })}</span>
          </p>
          <button
            type="button"
            disabled={done === 0 || clear.isPending}
            onClick={() => clear.mutate()}
            className="min-h-9 rounded-lg border border-ctl px-3 text-sm text-fg-sub enabled:hover:text-fg disabled:text-disabled"
          >
            {clear.isPending ? t("Setlist.clearing") : t("Setlist.clearDone")}
          </button>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-fg-sub">
            {t("Setlist.emptyList")}
          </p>
        ) : (
          <>
            <ul aria-label={t("Setlist.title")} className="flex flex-col gap-2">
              {pageItems.map((item) => (
                <SetlistRow
                  key={item.id}
                  item={item}
                  removing={remove.isPending && remove.variables === item.id}
                  onRecord={() => setRecording(toRecordChart(item))}
                  onRemove={() => remove.mutate(item.id)}
                />
              ))}
            </ul>
            <Pager page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </div>

      <RecordDialog chart={recording} onClose={() => setRecording(null)} nextChartAfterSave={nextChartAfterSave} />
    </div>
  );
}

/**
 * 세트리스트 한 줄 (2026-11-05, 시안 `세트리스트 카드 A안 다듬기` A-1/A-2): 서열표 EntryCard와 같은 모양이다.
 * 왼쪽 세 줄 = `속성 | 상수 5.6` 작은 글자(서열표에서 추천이 들어가는 자리에 추천 대신 상수) / 곡명 14px 한 줄 / `Guitar | MAS 9.45` 알약(+ 완료하면 `✓ 완료`).
 * 오른쪽 88px = 랭크·달성률 알약 위, `[입력] [빼기]`(완료하면 `[수정] [빼기]`) 아래.
 * 카드 높이는 곡명 길이·기록 유무와 상관없이 같도록 h-[76px]로 고정하고 안쪽을 가운데 맞춘다.
 * 완료는 계산된 값(item.done)이다. 초록 테두리와 `✓ 완료` 글자를 같이 써서 색만으로 구분하지 않는다.
 */
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
  const t = useTranslations();
  const stage = item.mine?.stage ?? null;
  const jackets = useJackets();
  // 버튼: 보이는 높이 26px, ::after로 눌리는 영역만 사방 6px 넓힌다(38px). 옆 버튼과 겹치지 않게 gap-2 (8px > 6+6 의 절반씩)
  const buttonBase =
    "relative flex h-[26px] flex-1 items-center justify-center rounded-md border border-ctl px-1 text-xs after:absolute after:-inset-1.5 after:content-['']";
  return (
    <li
      data-done={item.done ? "true" : "false"}
      className={`flex h-[76px] items-center gap-2.5 rounded-2xl border bg-card ${jackets.visible ? "pl-3" : "pl-4"} pr-3 ${item.done ? "border-done" : "border-line"}`}
    >
      {/* 재킷(D54): 서열표 줄과 같이 48px(360px 미만 40px). 끄면 칸이 없다 */}
      {jackets.visible ? <SongJacket url={jackets.urlOf(item.songId)} title={item.title} className="size-12 rounded-lg max-[359px]:size-10" /> : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-bold leading-3 text-fg-dim">
          <span className="sr-only">{t("Chart.patternSr")} </span>
          {item.pattern ? patternLabel(item.pattern, t) : EMPTY_MARK}
          <span className="mx-1 text-chip-line" aria-hidden="true">|</span>
          {t.rich("Setlist.constLabel", { n: (c) => <span className="font-num">{c}</span>, tier: formatTier(item.tier, t) })}
        </p>
        <Link
          href={`/songs/${item.songId}?chart=${item.songDifficultyId}`}
          className="mt-1 block truncate text-sm leading-[18px] text-fg hover:underline"
        >
          {item.title}
        </Link>
        <span className="mt-1 flex items-center gap-1.5 overflow-hidden">
          <ChartBadge part={item.part} difficulty={item.difficulty} level={item.level} compact />
          {item.done ? (
            <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-done-text">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5 9-10" />
              </svg>
              {t("Setlist.doneMark")}
            </span>
          ) : null}
        </span>
      </div>
      <div className="flex w-[88px] shrink-0 flex-col items-end gap-1.5">
        <StageRatePill stage={stage} rate={item.mine?.rate} />
        <div className="flex w-full gap-2">
          <button
            type="button"
            onClick={onRecord}
            aria-label={t(item.done ? "Setlist.editAria" : "Setlist.recordAria", { title: item.title })}
            className={`${buttonBase} text-fg hover:bg-table-head`}
          >
            {item.done ? t("Record.edit") : t("Setlist.inputBtn")}
          </button>
          <button
            type="button"
            disabled={removing}
            onClick={onRemove}
            aria-label={t("Setlist.removeAria", { title: item.title })}
            className={`${buttonBase} text-fg-sub hover:text-fg disabled:opacity-60`}
          >
            {t("Setlist.removeBtn")}
          </button>
        </div>
      </div>
    </li>
  );
}
