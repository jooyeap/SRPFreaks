"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { StageBadge } from "@/components/table/StageBadge";
import { ApiError } from "@/lib/api";
import { formatRate, formatScore } from "@/lib/format";
import { clearHandoff, MAX_PAGES, pagesReceived, removePlays, useHandoff } from "@/lib/import-handoff";
import type { ReadPlay } from "@/lib/import-bookmarklet";
import { fetchMySkill, skillKeys } from "@/lib/rating";
import {
  chartRequestOf,
  commitRecentPlays,
  describePlayChart,
  isExcludedReason,
  playKey,
  playStage,
  previewRecentPlays,
  SKIP_REASON_LABELS,
  type ImportPlayResult,
} from "@/lib/record-import";
import { ImportSnapshotPrompt } from "@/components/import/ImportSnapshotPrompt";
import { AFFECTED_QUERY_KEYS } from "@/lib/records";
import { useTranslations } from "next-intl";
import type { Translator } from "@/i18n/translator";

/**
 * 제외된 곡의 "곡 추가 건의" 링크. 곡명에 더해 플레이한 파트·난이도(gf_mst 등)를 같이 넘겨,
 * 관리자가 건의에서 바로 해당 채보로 등록 창을 열 수 있게 한다. 모르는 난이도 클래스면 곡명만 넘긴다.
 */
function requestSongHref(play: { title: string; difficultyClass: string }): string {
  const base = `/suggestions?category=SONG_REQUEST&title=${encodeURIComponent(play.title.slice(0, 100))}`;
  const chart = chartRequestOf(play.difficultyClass);
  return chart ? `${base}&part=${chart.part}&difficulty=${chart.difficulty}` : base;
}

function messageOf(error: unknown, t: Translator): string {
  return error instanceof ApiError ? error.message : t("Common.actionFailed");
}

function PlayRow({
  play,
  result,
  checked,
  onToggle,
}: {
  play: ReadPlay;
  result: ImportPlayResult;
  checked: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations();
  const excluded = isExcludedReason(result.reason);
  const chart = describePlayChart(play.difficultyClass);
  let note: string;
  if (result.saved) {
    note = result.previousBestRate === null ? t("Import.noteFirst") : t("Import.noteNew", { before: formatRate(result.previousBestRate), after: formatRate(play.rate / 100) });
  } else if (result.reason) {
    const label = t(SKIP_REASON_LABELS[result.reason]);
    // 지원하지 않는 난이도는 공식 페이지의 난이도 클래스(예: dm_ext)를 함께 보여 준다(새 난이도를 확인해 추가하기 위함)
    note = result.reason === "UNKNOWN_DIFFICULTY"
      ? t("Import.skippedUnknown", { label, cls: play.difficultyClass.slice(0, 40) })
      : excluded
        ? t("Import.excluded", { label })
        : result.previousBestRate !== null && result.reason === "LOWER_THAN_BEST"
          ? t("Import.skippedLower", { rate: formatRate(result.previousBestRate) })
          : t("Import.skipped", { label });
  } else {
    note = "";
  }
  return (
    <li className={`flex items-center gap-3 border-t border-line py-3 ${result.saved ? "" : "opacity-75"}`}>
      <input
        type="checkbox"
        checked={result.saved && checked}
        disabled={!result.saved}
        onChange={onToggle}
        aria-label={result.saved ? t("Import.ariaSave", { title: play.title }) : t("Import.ariaNoSave", { title: play.title })}
        className="size-5 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-fg">{play.title}</div>
        {chart && <div className="mt-0.5 text-xs text-fg-sub">{chart}</div>}
        <div className={`mt-0.5 text-xs ${excluded ? "text-weak-text" : result.saved ? "text-fg" : "text-fg-sub"}`}>{note}</div>
        {excluded && (
          <Link href={requestSongHref(play)} className="mt-0.5 inline-flex min-h-8 items-center text-xs underline">
            {t("Songs.requestSong")}
          </Link>
        )}
      </div>
      <div className="shrink-0 text-right">
        {result.saved && <StageBadge stage={playStage(play)} />}
        <div className="mt-0.5 font-num text-sm text-fg-sub">{formatRate(play.rate / 100)}</div>
      </div>
    </li>
  );
}

export interface DoneInfo {
  saved: number;
  before: number | null;
  after: number | null;
}

export function ratingLine(done: DoneInfo, t: Translator): string | null {
  if (done.before === null || done.after === null) return null;
  const diff = Math.round((done.after - done.before) * 100) / 100;
  if (diff === 0) return t("Record.ratingSame");
  return t("Record.ratingChange", { sign: diff > 0 ? "+" : "-", change: formatScore(Math.abs(diff)), before: formatScore(done.before), after: formatScore(done.after) });
}

/**
 * 받은 플레이를 확인하고 고른 것만 저장하는 본문(D40). 모달 안에서 쓴다.
 * 저장이 끝나면 보관소의 pending이 비므로, "완료" 상태(done)는 모달(부모)이 들고 있다가 결과 화면을 계속 보여 준다.
 */
export function ImportProcessor({ userId, done, onDone, onClose }: { userId: number; done: DoneInfo | null; onDone: (info: DoneInfo) => void; onClose: () => void }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const handoff = useHandoff();
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(new Set());
  const pending = handoff.pending;
  const pendingKeys = pending.map(playKey).join("\n");

  const preview = useQuery({
    queryKey: ["import-preview", userId, pendingKeys],
    queryFn: () => previewRecentPlays(pending),
    enabled: pending.length > 0,
    staleTime: 0,
    gcTime: 0,
  });

  const commit = useMutation({
    mutationFn: async (selected: ReadPlay[]) => {
      // 레이팅 변화는 저장 전후의 합계 차이로 보여 준다(조회에 실패해도 저장 결과는 그대로 보여 준다)
      const read = () => queryClient.fetchQuery({ queryKey: skillKeys.me(userId), queryFn: ({ signal }) => fetchMySkill(signal), staleTime: 0 }).then((s) => s.totalScore, () => null);
      const before = await read();
      const result = await commitRecentPlays(selected);
      await Promise.all(AFFECTED_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey: [...queryKey] })));
      const after = result.saved > 0 ? await read() : before;
      return { saved: result.saved, before, after };
    },
    onSuccess: (info) => {
      onDone(info);
      removePlays(pending);
      setUnchecked(new Set());
    },
  });

  const results = preview.data?.results;
  const byIndex = new Map<number, ImportPlayResult>((results ?? []).map((r) => [r.index, r]));
  const selectable = pending.filter((_, i) => byIndex.get(i)?.saved);
  const selected = selectable.filter((p) => !unchecked.has(playKey(p)));
  const skippedCount = (results ?? []).filter((r) => !r.saved && !isExcludedReason(r.reason)).length;
  const excludedCount = (results ?? []).filter((r) => isExcludedReason(r.reason)).length;
  const donePages = pagesReceived(handoff);

  function toggle(key: string) {
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (pending.length === 0) {
    const line = done ? ratingLine(done, t) : null;
    return (
      <div className="flex flex-col gap-3">
        <h2 id="import-handoff-title" className="text-lg font-extrabold">
          {done ? (done.saved > 0 ? t("Import.doneSaved", { count: done.saved }) : t("Import.doneNone")) : t("Import.nonePending")}
        </h2>
        {line && (
          <p role="status" className="text-sm text-fg-sub">
            {line}
          </p>
        )}
        {done && done.saved > 0 ? <ImportSnapshotPrompt userId={userId} /> : null}
        <div className="flex gap-2">
          <Link href="/me" onClick={onClose} className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-chip-line text-sm font-medium text-fg">
            {t("Import.viewRecords")}
          </Link>
          <Link href="/me?tab=rating" onClick={onClose} className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-chip-on-bg text-sm font-bold text-chip-on-fg">
            {t("Record.viewRating")}
          </Link>
        </div>
        <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-chip-line text-sm font-medium text-fg-sub hover:text-fg">
          {t("Common.close")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="import-handoff-title" className="text-lg font-extrabold">
          {t("Import.receivedHeading", { count: pending.length })}
        </h2>
        <span className="text-xs text-fg-sub">
          {t("Import.pagesRead", { done: donePages, max: MAX_PAGES })}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-fg-sub">{t("Import.notSavedYet")}</p>
      {preview.isPending && <p className="text-sm text-fg-sub">{t("Import.checking")}</p>}
      {preview.isError && (
        <p role="alert" className="text-sm text-danger">
          {messageOf(preview.error, t)}
        </p>
      )}
      {results && (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-chip-line px-2.5 py-1 font-bold text-fg">{t("Import.willSave", { count: selected.length })}</span>
            <span className="rounded-full border border-chip-line px-2.5 py-1 text-fg-sub">{t("Import.skippedChip", { count: skippedCount })}</span>
            {excludedCount > 0 && <span className="rounded-full border border-weak-line px-2.5 py-1 text-weak-text">{t("Import.excludedChip", { count: excludedCount })}</span>}
          </div>
          {/* 20곡까지 올 수 있어서 목록만 스크롤한다(버튼은 항상 보인다) */}
          <ul className="max-h-[45vh] overflow-y-auto">
            {pending.map((play, i) => {
              const result = byIndex.get(i);
              return result ? <PlayRow key={playKey(play)} play={play} result={result} checked={!unchecked.has(playKey(play))} onToggle={() => toggle(playKey(play))} /> : null;
            })}
          </ul>
        </>
      )}
      {commit.isError && (
        <p role="alert" className="text-sm text-danger">
          {messageOf(commit.error, t)}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            clearHandoff();
            onClose();
          }}
          disabled={commit.isPending}
          className="min-h-12 rounded-xl border border-chip-line px-4 text-sm font-medium text-fg disabled:opacity-60"
        >
          {t("Common.cancel")}
        </button>
        <button
          type="button"
          onClick={() => commit.mutate(selected)}
          disabled={commit.isPending || !results || selected.length === 0}
          className="min-h-12 flex-1 rounded-xl bg-chip-on-bg text-[15px] font-bold text-chip-on-fg disabled:opacity-60"
        >
          {commit.isPending ? t("Import.savingNow") : t("Import.saveN", { count: selected.length })}
        </button>
      </div>
    </div>
  );
}
