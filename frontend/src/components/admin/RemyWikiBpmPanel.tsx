"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/Toast";
import { adminKeys } from "@/lib/admin";
import { ApiError } from "@/lib/api";
import { chunk } from "@/lib/jacket-reader";
import {
  buildRemyBookmarkletHref,
  MSG_REMY_ACK,
  parseRemyMessage,
  REMY_ORIGIN,
  remyBookmarkletMessages,
  type RemyRow,
} from "@/lib/remywiki-reader";
import {
  commitSongInfo,
  COMMIT_BATCH,
  formatBpm,
  isWritable,
  previewSongInfo,
  type InfoStatus,
  type SongInfoCommitResult,
  type SongInfoRow,
} from "@/lib/song-info";

const CARD = "flex flex-col gap-3 rounded-2xl border border-line bg-card p-4";
const BUTTON = "min-h-11 rounded-lg border border-ctl px-4 text-sm text-fg hover:bg-table-head disabled:text-disabled";
const PRIMARY = "min-h-11 rounded-lg bg-chip-on-bg px-4 text-sm font-bold text-chip-on-fg disabled:opacity-50";
const STATUS_COLOR: Record<InfoStatus, string> = {
  FILL: "text-done-text",
  OVERWRITE: "text-weak-text",
  UNCHANGED: "text-fg-dim",
  NONE: "text-fg-faint",
};

/** 곡명을 같은 곡끼리 묶는 키(서버 정규화와 같은 방향: NFKC·공백 제거·소문자). 서버가 최종 매칭을 한다. */
function titleKey(title: string): string {
  return title.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

/**
 * RemyWiki에서 BPM 가져오기 (D94, ROOT 전용). 설계는 docs/DESIGN.md D94, 화면은 DESIGN-UI.md 27.2.
 * 흐름: RemyWiki 곡 표 페이지에서 북마크를 누르면 이 화면(창 이름 고정)이 메시지로 곡명·BPM을 받는다 → 받은 곡이 쌓인다(같은 곡명은 나중 값이 이긴다)
 * → 쌓일 때마다 서버가 마스터와 맞춰 `현재값 → 가져온 값`을 돌려준다(저장 없음) → 체크한 곡만 BPM을 저장한다.
 * 기본 체크는 비어 있던 곡(새로 채움)뿐이고, 덮어쓰기는 사용자가 체크한 곡만 저장한다. 새 곡은 만들지 않는다.
 * 받은 값은 이 창의 메모리에만 있다(새로 고치면 사라진다). RemyWiki 출처의 메시지만 받는다.
 * 아티스트는 보내지 않는다(RemyWiki 표기는 게임 표기와 다를 수 있고 이 화면의 범위는 BPM뿐이다).
 */
export function RemyWikiBpmPanel() {
  const t = useTranslations("RemyBpm");
  const toast = useToast();
  const queryClient = useQueryClient();
  // 곡명 키 → 받은 줄. 화면은 rows 배열 상태로 그리고, 메시지 처리에서는 이 ref로 합친다
  const mapRef = useRef<Map<string, RemyRow>>(new Map());
  const seenIds = useRef<Set<string>>(new Set());
  const seq = useRef(0);
  const [rows, setRows] = useState<RemyRow[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [pages, setPages] = useState(0);
  const [invalid, setInvalid] = useState(0);
  const [conflicts, setConflicts] = useState(0);
  const [preview, setPreview] = useState<SongInfoRow[] | null>(null);
  const [comparing, setComparing] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SongInfoCommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runPreview(list: RemyRow[]) {
    const mine = ++seq.current;
    if (list.length === 0) {
      setPreview(null);
      setComparing(false);
      return;
    }
    setComparing(true);
    setError(null);
    try {
      const data = await previewSongInfo(list.map((r) => ({ title: r.title, artist: "", bpm: r.bpm })));
      if (mine !== seq.current) return; // 더 새로운 비교가 시작됐으면 이 결과는 버린다
      // 같은 곡이 곡명 두 개로 맞아도 한 줄만 쓴다
      const seen = new Set<number>();
      const unique = data.rows.filter((r) => (seen.has(r.songId) ? false : (seen.add(r.songId), true)));
      setPreview(unique);
      // 새로 채움은 기본 체크. 덮어쓰기는 사용자가 이미 체크해 둔 것만 남긴다
      setChecked((prev) => {
        const next = new Set<number>();
        for (const r of unique) {
          const s = r.bpm.status;
          if (s === "FILL" || (s === "OVERWRITE" && prev.has(r.songId))) next.add(r.songId);
        }
        return next;
      });
    } catch (e) {
      if (mine !== seq.current) return;
      setError(e instanceof ApiError ? e.message : t("compareFailed"));
    } finally {
      if (mine === seq.current) setComparing(false);
    }
  }
  // 메시지 리스너가 오래된 클로저를 쓰지 않도록 최신 함수를 ref에 둔다
  const runPreviewRef = useRef(runPreview);
  useEffect(() => {
    runPreviewRef.current = runPreview;
  });

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // RemyWiki 출처에서, 창 참조가 있는 메시지만 받는다
      if (event.origin !== REMY_ORIGIN || !event.source) return;
      const message = parseRemyMessage(event.data);
      if (!message) return;
      // 받았다는 답은 중복이어도 보낸다(북마클릿이 답이 올 때까지 다시 보낸다)
      try {
        (event.source as Window).postMessage({ type: MSG_REMY_ACK, id: message.id }, REMY_ORIGIN);
      } catch {
        // 창이 닫혔으면 답할 곳이 없다
      }
      if (seenIds.current.has(message.id)) return;
      seenIds.current.add(message.id);
      let changed = 0;
      for (const row of message.rows) {
        const key = titleKey(row.title);
        const old = mapRef.current.get(key);
        if (old && old.bpm !== row.bpm) changed += 1;
        mapRef.current.set(key, row);
      }
      const all = [...mapRef.current.values()];
      setRows(all);
      setPages((n) => n + 1);
      setInvalid((n) => n + message.invalid);
      setConflicts((n) => n + changed);
      if (message.source) setSources((list) => (list.includes(message.source) ? list : [...list, message.source]));
      setResult(null);
      void runPreviewRef.current(all);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function clearAll() {
    mapRef.current = new Map();
    seq.current += 1;
    setRows([]);
    setSources([]);
    setPages(0);
    setInvalid(0);
    setConflicts(0);
    setPreview(null);
    setChecked(new Set());
    setResult(null);
    setError(null);
    setComparing(false);
  }

  const matched = preview ?? [];
  const matchedTitles = new Set(matched.map((r) => r.officialTitle));
  const unmatched = rows.filter((r) => !matchedTitles.has(r.title.trim()));
  const counts = { FILL: 0, OVERWRITE: 0, UNCHANGED: 0, NONE: 0 } as Record<InfoStatus, number>;
  matched.forEach((r) => (counts[r.bpm.status] += 1));
  // 저장할 수 있는 곡(새로 채움·덮어쓰기)을 위로 올린다
  const ordered = [...matched.filter((r) => isWritable(r.bpm.status)), ...matched.filter((r) => !isWritable(r.bpm.status))];
  const overwriteRows = matched.filter((r) => r.bpm.status === "OVERWRITE");
  const allOverwriteChecked = overwriteRows.length > 0 && overwriteRows.every((r) => checked.has(r.songId));
  const selected = matched.filter((r) => checked.has(r.songId) && isWritable(r.bpm.status));

  const toggle = (songId: number) =>
    setChecked((s) => {
      const next = new Set(s);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });

  const toggleOverwrite = () =>
    setChecked((s) => {
      const next = new Set(s);
      for (const r of overwriteRows) {
        if (allOverwriteChecked) next.delete(r.songId);
        else next.add(r.songId);
      }
      return next;
    });

  async function save() {
    if (selected.length === 0) return;
    setSaving(true);
    setError(null);
    const total: SongInfoCommitResult = { artistFilled: 0, artistOverwritten: 0, bpmFilled: 0, bpmOverwritten: 0, skipped: 0 };
    try {
      const bpmByTitle = new Map(rows.map((r) => [r.title.trim(), r.bpm]));
      for (const batch of chunk(selected, COMMIT_BATCH)) {
        const result = await commitSongInfo(
          batch.map((r) => ({ title: r.officialTitle, artist: "", bpm: bpmByTitle.get(r.officialTitle) ?? "" })),
          batch.map((r) => ({ songId: r.songId, artist: false, bpm: true })),
        );
        total.bpmFilled += result.bpmFilled;
        total.bpmOverwritten += result.bpmOverwritten;
        total.skipped += result.skipped;
      }
      setResult(total);
      toast(t("saved", { filled: total.bpmFilled, overwritten: total.bpmOverwritten }));
    } catch (e) {
      setResult(total);
      setError(e instanceof ApiError ? e.message : t("saveFailed"));
    } finally {
      setSaving(false);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["songs"] }), queryClient.invalidateQueries({ queryKey: adminKeys.all })]);
      // 저장한 곡은 이제 변경 없음이 되도록 다시 비교한다
      void runPreview([...mapRef.current.values()]);
    }
  }

  return (
    <section aria-label={t("heading")} className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-fg">{t("heading")}</h2>
        <p className="break-keep text-sm text-fg-sub">{t("lead")}</p>
      </header>
      {rows.length === 0 ? <RemyBookmarkGuide /> : null}
      <p role="status" className="text-sm text-fg-sub">
        {rows.length === 0 ? t("receivedNone") : comparing ? t("comparing") : t("received", { count: rows.length, pages, invalid })}
      </p>
      {rows.length > 0 ? (
        <div className={CARD}>
          {sources.length > 0 ? <p className="break-all text-xs text-fg-dim">{t("sourceList", { sources: sources.join(" · ") })}</p> : null}
          {conflicts > 0 ? <p className="break-keep text-xs text-weak-text">{t("conflicts", { n: conflicts })}</p> : null}
          {preview ? (
            <>
              <p className="text-sm text-fg">{t("summary", { matched: matched.length, unmatched: unmatched.length })}</p>
              <ul className="flex flex-wrap gap-2 text-xs">
                <li className="rounded-full border border-done px-2 py-0.5 text-done-text">{t("statusFill", { n: counts.FILL })}</li>
                <li className="rounded-full border border-weak px-2 py-0.5 text-weak-text">{t("statusOverwrite", { n: counts.OVERWRITE })}</li>
                <li className="rounded-full border border-ctl px-2 py-0.5 text-fg-sub">{t("statusUnchanged", { n: counts.UNCHANGED })}</li>
                {counts.NONE > 0 ? <li className="rounded-full border border-ctl px-2 py-0.5 text-fg-faint">{t("statusNone", { n: counts.NONE })}</li> : null}
              </ul>
            </>
          ) : null}
          {unmatched.length > 0 && preview ? (
            <details>
              <summary className="cursor-pointer text-xs text-fg-sub">{t("unmatchedList")}</summary>
              <p className="mt-2 break-keep text-xs text-fg-dim">{t("unmatchedNote")}</p>
              <p className="mt-1 text-xs leading-relaxed text-fg-dim">{unmatched.map((r) => r.title).join(" · ")}</p>
            </details>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={BUTTON} disabled={overwriteRows.length === 0 || saving} onClick={toggleOverwrite}>
              {allOverwriteChecked ? t("excludeOverwrite", { n: overwriteRows.length }) : t("includeOverwrite", { n: overwriteRows.length })}
            </button>
            <button type="button" className={PRIMARY} disabled={saving || comparing || selected.length === 0} onClick={() => void save()}>
              {saving ? t("saving") : t("save", { n: selected.length })}
            </button>
            <button type="button" className={BUTTON} disabled={saving} onClick={clearAll}>
              {t("clear")}
            </button>
          </div>
        </div>
      ) : null}
      {ordered.length > 0 ? <BpmTable rows={ordered} checked={checked} onToggle={toggle} /> : null}
      {result ? (
        <p className="break-keep text-sm text-fg">{t("result", { filled: result.bpmFilled, overwritten: result.bpmOverwritten, skipped: result.skipped })}</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function BpmTable({ rows, checked, onToggle }: {
  rows: SongInfoRow[];
  checked: Set<number>;
  onToggle: (songId: number) => void;
}) {
  const t = useTranslations("RemyBpm");
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="hidden grid-cols-[28px_minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,1fr)] gap-3 bg-table-head px-3 py-2 text-xs text-fg-sub md:grid">
        <span />
        <span>{t("colSong")}</span>
        <span>{t("colRemy")}</span>
        <span>{t("colBpm")}</span>
      </div>
      <ul>
        {rows.map((row) => {
          const status = row.bpm.status;
          const writable = isWritable(status);
          return (
            <li
              key={row.songId}
              className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 border-t border-line px-3 py-2 first:border-t-0 md:grid-cols-[28px_minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,1fr)]"
            >
              <input
                type="checkbox"
                aria-label={row.songTitle}
                checked={checked.has(row.songId) && writable}
                disabled={!writable}
                onChange={() => onToggle(row.songId)}
                className="mt-1 size-4"
              />
              <p className="line-clamp-2 text-sm text-fg">{row.songTitle}</p>
              <p className="col-start-2 break-words text-xs text-fg-dim md:col-start-auto">
                <span className="md:hidden">{t("colRemy")}: </span>
                {row.officialTitle}
              </p>
              <div className="col-start-2 min-w-0 md:col-start-auto">
                <p className="break-words text-xs text-fg-dim">
                  {formatBpm(row.bpm.currentMin, row.bpm.currentMax)} → <b className="text-fg">{formatBpm(row.bpm.officialMin, row.bpm.officialMax)}</b>
                </p>
                <p className={`text-[11px] font-bold ${STATUS_COLOR[status]}`}>{t(`row_${status}`)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RemyBookmarkGuide() {
  const t = useTranslations();
  const toast = useToast();
  const linkRef = useRef<HTMLAnchorElement>(null);
  const href = buildRemyBookmarkletHref(window.location.origin, remyBookmarkletMessages(t));

  useEffect(() => {
    // React는 javascript: 주소를 href로 렌더링하지 않아서 ref로 직접 넣는다(끌어서 북마크에 추가하는 용도)
    linkRef.current?.setAttribute("href", href);
  }, [href]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      toast(t("SongImport.bookmarkCopied"));
    } catch {
      toast(t("SongImport.copyFailed"), { kind: "error" });
    }
  }

  return (
    <div className={CARD}>
      <ol className="flex list-decimal flex-col gap-2 break-keep pl-5 text-sm text-fg-sub">
        <li>
          {t("RemyBpm.guideStep1")}{" "}
          <a ref={linkRef} onClick={(e) => e.preventDefault()} className="inline-block rounded-lg border border-ctl px-2 py-0.5 text-fg">
            {t("RemyBpm.bookmarkName")}
          </a>
        </li>
        <li>{t("RemyBpm.guideStep2")}</li>
        <li>{t("RemyBpm.guideStep3")}</li>
      </ol>
      <div>
        <button type="button" className={BUTTON} onClick={() => void copy()}>
          {t("SongImport.copyBookmark")}
        </button>
      </div>
      <p className="break-keep text-xs text-fg-dim">{t("RemyBpm.guideNote")}</p>
    </div>
  );
}
