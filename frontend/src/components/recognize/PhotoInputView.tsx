"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { canSave, parseRate, PhotoRow, type RowDraft } from "@/components/recognize/PhotoRow";
import { ApiError } from "@/lib/api";
import { formatSeoulDateTime } from "@/lib/format";
import {
  fetchRecognizeStatus,
  MAX_PHOTOS,
  recognizeKeys,
  recognizePhoto,
  showsPhotoEntry,
  shrinkPhoto,
  type RecognizeResult,
} from "@/lib/recognize";
import { AFFECTED_QUERY_KEYS, createRecord, seoulDateToInstant, todaySeoul } from "@/lib/records";
import { useTranslations } from "next-intl";

interface Row {
  key: string;
  preview: string;
  result: RecognizeResult | null;
  error: string | null;
  draft: RowDraft;
  state: "idle" | "saved" | "failed";
}

function draftOf(result: RecognizeResult | null): RowDraft {
  const chart =
    result && result.songDifficultyId !== null && result.part && result.difficulty && result.level !== null
      ? {
          songDifficultyId: result.songDifficultyId,
          title: result.candidates[0]?.title ?? result.title ?? "",
          part: result.part,
          difficulty: result.difficulty,
          level: result.level,
        }
      : null;
  return {
    chart,
    rate: result?.achievementRate === null || result?.achievementRate === undefined ? "" : result.achievementRate.toFixed(2),
    fullCombo: result?.fullCombo === true,
    srnConfirmed: false,
    playedDate: todaySeoul(),
    include: result !== null,
  };
}

/**
 * 사진으로 입력 (D55). 가져오기로 못 넣은 결과 화면 사진을 한 번에 최대 10장 골라 차례로 읽고, 확인 목록에서 고친 뒤 체크한 줄만 저장한다.
 * 쓸 수 있는지는 서버 상태 API만 본다(역할 조건을 화면에 두지 않는다 — 공개 전환은 설정 하나). 꺼져 있거나 권한이 없으면 안내만 보인다.
 * 사진은 브라우저에서 줄여 보내고, 미리보기는 이 탭 안의 임시 주소(blob)라 어디에도 저장되지 않는다.
 */
export function PhotoInputView() {
  const t = useTranslations();
  const { status: authStatus, user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const userId = user?.id ?? 0;
  const status = useQuery({
    queryKey: recognizeKeys.status(userId),
    queryFn: ({ signal }) => fetchRecognizeStatus(signal),
    enabled: user !== null && user !== undefined,
  });
  const [rows, setRows] = useState<Row[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // 화면을 떠나면 미리보기 임시 주소를 풀어 준다
  const previews = useRef<string[]>([]);
  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), []);

  if (authStatus === "loading" || (user && status.isPending)) {
    return <p className="text-sm text-fg-sub">{t("Common.loading")}</p>;
  }
  if (!user) {
    return <p className="text-sm text-fg-sub">{t("Photo.login")}</p>;
  }
  if (status.isError || !showsPhotoEntry(status.data)) {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-fg">{t("Photo.title")}</h1>
        <p className="text-sm text-fg-sub">{t("Photo.notAvailable")}</p>
      </section>
    );
  }
  const st = status.data;
  const busy = progress !== null || saving;

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0 || !st) {
      return;
    }
    const picked = Array.from(files).slice(0, Math.min(MAX_PHOTOS, st.remaining));
    if (files.length > picked.length) {
      toast(t("Photo.tooMany", { count: picked.length }));
    }
    setProgress({ done: 0, total: picked.length });
    for (let i = 0; i < picked.length; i += 1) {
      const preview = URL.createObjectURL(picked[i]);
      previews.current.push(preview);
      let result: RecognizeResult | null = null;
      let error: string | null = null;
      let limitReached = false;
      try {
        result = await recognizePhoto(await shrinkPhoto(picked[i]));
      } catch (e) {
        error = e instanceof ApiError ? e.message : t("Photo.readFailed");
        limitReached = e instanceof ApiError && e.code === "RECOGNIZE_LIMIT";
      }
      const row: Row = { key: `${Date.now()}-${i}`, preview, result, error, draft: draftOf(result), state: "idle" };
      setRows((prev) => [...prev, row]);
      setProgress({ done: i + 1, total: picked.length });
      if (limitReached) {
        break; // 한도에 걸리면 남은 사진은 보내지 않는다
      }
    }
    setProgress(null);
    if (fileInput.current) {
      fileInput.current.value = "";
    }
    await queryClient.invalidateQueries({ queryKey: recognizeKeys.status(userId) });
  }

  const savable = rows.filter((r) => r.state !== "saved" && r.draft.include && canSave(r.draft, r.result?.superRandomPlus ?? null));

  async function saveChecked() {
    setSaving(true);
    let ok = 0;
    for (const row of savable) {
      const chart = row.draft.chart;
      const rate = parseRate(row.draft.rate);
      if (!chart || rate === null) {
        continue;
      }
      try {
        await createRecord({
          songDifficultyId: chart.songDifficultyId,
          noteOption: "SUPER_RANDOM_PLUS",
          achievementRate: rate,
          fullCombo: row.draft.fullCombo || rate === 100,
          playedAt: seoulDateToInstant(row.draft.playedDate),
          memo: null,
        });
        ok += 1;
        setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, state: "saved" } : r)));
      } catch {
        setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, state: "failed" } : r)));
      }
    }
    setSaving(false);
    if (ok > 0) {
      toast(t("Photo.allSaved", { count: ok }));
      for (const queryKey of AFFECTED_QUERY_KEYS) {
        await queryClient.invalidateQueries({ queryKey });
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-fg">{t("Photo.title")}</h1>
        <p className="text-sm text-fg-sub">{t("Photo.lead")}</p>
        <p className="text-xs text-fg-dim">{t("Photo.privacy")}</p>
      </header>

      <section aria-label={t("Photo.pickAria")} className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
        <p className="text-sm text-fg">
          {t.rich("Photo.remaining", { remaining: st.remaining, limit: st.weeklyLimit, b: (c) => <b className="font-num">{c}</b> })}
        </p>
        {!st.available && st.nextRefillAt ? <p className="text-sm text-fg-sub">{t("Photo.refillAt", { date: formatSeoulDateTime(st.nextRefillAt) })}</p> : null}
        <label className={`flex min-h-11 w-fit items-center rounded-lg px-4 text-sm font-semibold ${st.available && !busy ? "cursor-pointer bg-chip-on-bg text-chip-on-fg" : "border border-chip-line text-fg-dim"}`}>
          {t("Photo.choosePhotos", { max: Math.min(MAX_PHOTOS, st.remaining) })}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={!st.available || busy}
            onChange={(e) => void onPick(e.target.files)}
          />
        </label>
        {progress ? (
          <p role="status" className="text-sm text-fg-sub">
            {t("Photo.reading", { done: progress.done, total: progress.total })}
          </p>
        ) : null}
      </section>

      {rows.length > 0 ? (
        <>
          <ul aria-label={t("Photo.listAria")} className="flex flex-col gap-3">
            {rows.map((row, i) =>
              row.result ? (
                <PhotoRow
                  key={row.key}
                  index={i}
                  preview={row.preview}
                  recognizedTitle={row.result.title}
                  srnRead={row.result.superRandomPlus}
                  draft={row.draft}
                  state={row.state}
                  onChange={(next) => setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, draft: next } : r)))}
                />
              ) : (
                <li key={row.key} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={row.preview} alt={t("Photo.previewAlt", { n: i + 1 })} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                  <p role="alert" className="text-sm text-fg">{row.error}</p>
                </li>
              ),
            )}
          </ul>
          <div className="sticky bottom-[calc(var(--tabbar-h)+0.5rem)] flex items-center justify-between gap-3 rounded-2xl border border-line bg-card/95 p-3">
            <Link href="/me" className="text-sm text-fg-sub underline underline-offset-2">
              {t("Photo.toMyPage")}
            </Link>
            <button
              type="button"
              disabled={savable.length === 0 || busy}
              onClick={() => void saveChecked()}
              className="min-h-11 rounded-lg bg-chip-on-bg px-4 text-sm font-semibold text-chip-on-fg disabled:opacity-50"
            >
              {saving ? t("Photo.saving") : t("Photo.saveChecked", { count: savable.length })}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
