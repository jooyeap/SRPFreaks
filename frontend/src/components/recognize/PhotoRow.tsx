"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SongSearchBox } from "@/components/songs/SongSearchBox";
import { ChartBadge } from "@/components/table/Badges";
import type { DifficultyType, InstrumentPart } from "@/lib/types";
import { searchCharts } from "@/lib/setlist";
import { useTranslations } from "next-intl";

export interface PickedChart {
  songDifficultyId: number;
  title: string;
  part: InstrumentPart;
  difficulty: DifficultyType;
  level: number;
}

/** 확인 목록의 한 줄에서 사용자가 고치는 값. 인식 결과로 처음 값을 채운다. */
export interface RowDraft {
  chart: PickedChart | null;
  rate: string;
  fullCombo: boolean;
  srnConfirmed: boolean;
  playedDate: string;
  include: boolean;
}

/** 달성률 칸: `92.45`, `100`, `MAX`. 0.00~100.00, 소수 둘째 자리까지. 아니면 null. */
export function parseRate(text: string): number | null {
  const s = text.trim();
  if (/^max$/i.test(s)) {
    return 100;
  }
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) {
    return null;
  }
  const n = Number(s);
  return n >= 0 && n <= 100 ? n : null;
}

/**
 * 사진 한 장의 확인 줄(D55). 채보가 정해졌으면 보여 주고, 아니면 인식한 곡명으로 검색해 고르게 한다(곡 목록과 같은 검색 API).
 * SRN+ 표시를 읽지 못했거나 다른 옵션으로 읽혔으면 경고와 함께 `SRN+로 플레이했습니다` 체크를 받아야 저장할 수 있다(D25).
 */
export function PhotoRow({
  index,
  preview,
  recognizedTitle,
  srnRead,
  draft,
  onChange,
  state,
}: {
  index: number;
  preview: string;
  recognizedTitle: string | null;
  srnRead: boolean | null;
  draft: RowDraft;
  onChange: (next: RowDraft) => void;
  state: "idle" | "saved" | "failed";
}) {
  const t = useTranslations();
  const [term, setTerm] = useState(recognizedTitle ?? "");
  const searching = draft.chart === null && term.trim() !== "";
  const results = useQuery({
    queryKey: ["recognize", "search", term.trim()],
    queryFn: ({ signal }) => searchCharts(term.trim(), 0, signal),
    enabled: searching,
    placeholderData: keepPreviousData,
  });
  const rateOk = parseRate(draft.rate) !== null;
  const needsSrn = srnRead !== true;
  const set = (patch: Partial<RowDraft>) => onChange({ ...draft, ...patch });

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <div className="flex items-start gap-3">
        {/* 미리보기는 이 브라우저 안의 사진(blob 주소)이다. 서버에 저장되지 않는다 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt={t("Photo.previewAlt", { n: index + 1 })} className="h-20 w-20 shrink-0 rounded-lg object-cover" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-fg-dim">{t("Photo.recognizedTitle")}</p>
          <p className="truncate text-sm text-fg">{recognizedTitle ?? t("Photo.notRead")}</p>
          {state === "saved" ? <p className="mt-1 text-sm font-semibold text-done-text">✓ {t("Photo.saved")}</p> : null}
          {state === "failed" ? <p role="alert" className="mt-1 text-sm text-fg">{t("Photo.saveFailed")}</p> : null}
        </div>
      </div>

      {draft.chart ? (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-fg">{draft.chart.title}</p>
            <p className="mt-1">
              <ChartBadge part={draft.chart.part} difficulty={draft.chart.difficulty} level={draft.chart.level} />
            </p>
          </div>
          <button type="button" onClick={() => set({ chart: null })} disabled={state === "saved"} className="min-h-11 shrink-0 rounded-lg border border-ctl px-3 text-sm text-fg-sub hover:text-fg disabled:opacity-50">
            {t("Photo.chartChange")}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-fg">{t("Photo.chartPick")}</p>
          <div className="flex">
            <SongSearchBox value={term} onCommit={setTerm} />
          </div>
          {searching && results.data ? (
            <ul aria-label={t("Photo.chartResultsAria", { n: index + 1 })} className="flex flex-col">
              {results.data.content.map((c) => (
                <li key={c.songDifficultyId} className="flex items-center justify-between gap-3 border-t border-row-line py-2 first:border-t-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-fg">{c.title}</p>
                    <p className="mt-1">
                      <ChartBadge part={c.part} difficulty={c.difficulty} level={c.level} />
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => set({ chart: { songDifficultyId: c.songDifficultyId, title: c.title, part: c.part, difficulty: c.difficulty, level: c.level } })}
                    className="min-h-11 shrink-0 rounded-lg border border-ctl px-3 text-sm font-semibold text-fg hover:bg-table-head"
                  >
                    {t("Photo.choose")}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-fg-sub">
          {t("Photo.rate")}
          <input
            value={draft.rate}
            inputMode="decimal"
            onChange={(e) => set({ rate: e.target.value })}
            aria-invalid={!rateOk}
            disabled={state === "saved"}
            className="w-28 rounded-[10px] border border-line bg-card px-3 py-2 font-num text-sm text-fg"
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm text-fg">
          <input type="checkbox" checked={draft.fullCombo} onChange={(e) => set({ fullCombo: e.target.checked })} disabled={state === "saved"} />
          Full Combo
        </label>
        <label className="flex flex-col gap-1 text-xs text-fg-sub">
          {t("Photo.playedDate")}
          <input type="date" value={draft.playedDate} onChange={(e) => set({ playedDate: e.target.value })} disabled={state === "saved"} className="rounded-[10px] border border-line bg-card px-3 py-2 text-sm text-fg" />
        </label>
      </div>
      {!rateOk ? <p className="text-xs text-fg">{t("Photo.rateInvalid")}</p> : null}

      {needsSrn ? (
        <div className="flex flex-col gap-1 rounded-[10px] border border-line bg-table-head px-3 py-2">
          <p className="text-xs text-fg">{t(srnRead === false ? "Photo.srnOther" : "Photo.srnUnknown")}</p>
          <label className="flex min-h-11 items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={draft.srnConfirmed} onChange={(e) => set({ srnConfirmed: e.target.checked })} disabled={state === "saved"} />
            {t("Photo.srnConfirm")}
          </label>
        </div>
      ) : null}

      {state !== "saved" ? (
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-fg">
          <input type="checkbox" checked={draft.include} onChange={(e) => set({ include: e.target.checked })} />
          {t("Photo.include")}
        </label>
      ) : null}
    </li>
  );
}

/** 저장할 수 있는 줄인가: 채보·달성률이 있고, SRN+가 확인됐다. */
export function canSave(draft: RowDraft, srnRead: boolean | null): boolean {
  return draft.chart !== null && parseRate(draft.rate) !== null && (srnRead === true || draft.srnConfirmed);
}
