"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import {
  buildJacketBookmarkletHref,
  chunk,
  jacketBookmarkletMessages,
  JACKET_QUERY,
  MSG_DONE,
  MSG_IMAGE,
  MSG_READY,
  MSG_TITLES,
  MSG_WANT,
  OFFICIAL_ORIGIN,
  type InfoRow,
  parseJacketMessage,
  SAVE_BATCH,
} from "@/lib/jacket-reader";
import { matchJackets, saveJackets, type JacketMatch, type JacketMatchResponse } from "@/lib/song-jackets";
import {
  commitSongInfo,
  COMMIT_BATCH,
  isWritable,
  previewSongInfo,
  type InfoStatus,
  type SongInfoCommitResult,
  type SongInfoRow,
} from "@/lib/song-info";

const CARD = "flex flex-col gap-3 rounded-2xl border border-line bg-card p-4";
const BUTTON = "min-h-11 rounded-lg border border-ctl px-4 text-sm text-fg hover:bg-table-head disabled:text-disabled";
const PRIMARY = "min-h-11 rounded-lg bg-chip-on-bg px-4 text-sm font-bold text-chip-on-fg disabled:opacity-50";
/** 공식 창에 준비 신호를 보내는 간격과 최대 시간(ms). 북마클릿이 37쪽을 다 읽을 때까지 기다린다. */
const READY_INTERVAL = 1000;
const READY_MAX = 5 * 60_000;

interface Received {
  match: JacketMatch;
  blob: Blob;
  url: string;
}

type Kind = "artist" | "jacket";
const KINDS: Kind[] = ["artist", "jacket"];

/** 곡 한 줄의 전체 상태(칩 개수용): 하나라도 덮어쓰기면 덮어쓰기, 하나라도 새로 채움이면 새로 채움. */
function overallStatus(statuses: InfoStatus[]): InfoStatus {
  if (statuses.includes("OVERWRITE")) return "OVERWRITE";
  if (statuses.includes("FILL")) return "FILL";
  if (statuses.includes("UNCHANGED")) return "UNCHANGED";
  return "NONE";
}

const STATUS_COLOR: Record<InfoStatus, string> = {
  FILL: "text-done-text",
  OVERWRITE: "text-weak-text",
  UNCHANGED: "text-fg-dim",
  NONE: "text-fg-faint",
};

/**
 * 재킷 가져오기 (D54 2단계, ROOT 전용). 설계는 docs/DESIGN.md 18.4.0-3.
 * 흐름: 공식 `곡별 성적` 페이지에서 북마크를 누르면 이 창이 `?jacket=1`로 열린다 → 공식 창에 준비 신호 → 곡명 목록을 받아 서버에서 매칭
 * → 맞은 곡명만 돌려보냄 → 줄인 재킷(WebP)을 받아 미리보기 → 체크한 것만 10장씩 저장.
 * 받은 이미지는 이 창의 메모리에만 있다(새로 고치면 사라진다). 공식 사이트 출처·이 창을 연 창(opener)에서 온 메시지만 받는다.
 * 새로 넣는 곡은 기본으로 체크하고, 이미 재킷이 있는 곡(교체 후보)은 체크하지 않는다.
 */
export function JacketImportPanel() {
  const t = useTranslations("JacketImport");
  const toast = useToast();
  const queryClient = useQueryClient();
  // 북마클릿이 연 창(opener가 있고 주소에 jacket=1)이면 처음부터 "기다리는 중"이다. 이 화면은 로그인 확인(AdminGate) 뒤에만 그려져 서버 그림과 겹치지 않는다
  const [phase, setPhase] = useState<"idle" | "waiting" | "matching" | "receiving" | "done">(() =>
    typeof window !== "undefined" && window.opener && window.location.search.includes(JACKET_QUERY) ? "waiting" : "idle",
  );
  const [matchResult, setMatchResult] = useState<JacketMatchResponse | null>(null);
  const [failedPages, setFailedPages] = useState(0);
  const [received, setReceived] = useState<Received[]>([]);
  const [failedImages, setFailedImages] = useState(0);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ saved: number; replaced: number; info: SongInfoCommitResult | null } | null>(null);
  // D90: 공식 화면에서 읽은 아티스트와 서버가 비교한 결과 (BPM은 D94부터 RemyWiki 패널에서만 받는다), 저장할 항목 칩(기본 모두 켬)
  const [infoRows, setInfoRows] = useState<Map<number, SongInfoRow>>(new Map());
  const [kinds, setKinds] = useState<Set<Kind>>(new Set(KINDS));
  const infosRef = useRef<InfoRow[]>([]);
  const infoRowsRef = useRef<Map<number, SongInfoRow>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const matchesRef = useRef<Map<string, JacketMatch>>(new Map());
  const gotTitles = useRef(false);
  const urls = useRef<string[]>([]);

  useEffect(() => {
    const opener = window.opener as Window | null;
    if (!opener || !window.location.search.includes(JACKET_QUERY)) return;
    // 공식 창은 37쪽을 다 읽은 뒤에야 곡명을 보낼 수 있어서, 곡명을 받을 때까지 준비 신호를 되풀이한다(최대 5분)
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (gotTitles.current || Date.now() - started > READY_MAX) {
        window.clearInterval(timer);
        return;
      }
      opener.postMessage({ type: MSG_READY }, OFFICIAL_ORIGIN);
    }, READY_INTERVAL);
    opener.postMessage({ type: MSG_READY }, OFFICIAL_ORIGIN);

    const onMessage = (event: MessageEvent) => {
      // 공식 사이트에서, 이 창을 연 그 창이 보낸 것만 받는다
      if (event.origin !== OFFICIAL_ORIGIN || event.source !== opener) return;
      const message = parseJacketMessage(event.data);
      if (!message) return;
      if (message.type === MSG_TITLES && !gotTitles.current) {
        gotTitles.current = true;
        setFailedPages(message.failedPages);
        setPhase("matching");
        infosRef.current = message.infos;
        matchJackets(message.titles)
          .then(async (result) => {
            matchesRef.current = new Map(result.matches.map((m) => [m.officialTitle, m]));
            setMatchResult(result);
            // 아티스트 비교는 읽은 값이 있을 때만 한다. 실패해도 재킷 가져오기는 계속한다(곡 정보 칸은 값 없음)
            if (infosRef.current.length > 0) {
              try {
                const preview = await previewSongInfo(infosRef.current);
                infoRowsRef.current = new Map(preview.rows.map((r) => [r.songId, r]));
                setInfoRows(infoRowsRef.current);
                setChecked((cur) => {
                  const next = new Set(cur);
                  for (const r of preview.rows) {
                    // 새로 채움은 기본 체크, 덮어쓰기는 기본 해제
                    if (r.artist.status === "FILL") {
                      next.add(r.songId);
                    }
                  }
                  return next;
                });
              } catch (e) {
                setError(e instanceof ApiError ? e.message : t("infoPreviewFailed"));
              }
            }
            setPhase("receiving");
            opener.postMessage({ type: MSG_WANT, titles: result.matches.map((m) => m.officialTitle) }, OFFICIAL_ORIGIN);
          })
          .catch((e: unknown) => {
            setError(e instanceof ApiError ? e.message : t("matchFailed"));
            setPhase("idle");
          });
      } else if (message.type === MSG_IMAGE) {
        const match = matchesRef.current.get(message.title);
        if (!match) return; // 우리가 요청하지 않은 곡명은 버린다
        matchesRef.current.delete(message.title); // 같은 곡이 두 번 오면 처음 것만
        const blob = new Blob([message.data], { type: "image/webp" });
        const item = { match, blob, url: URL.createObjectURL(blob) };
        urls.current.push(item.url);
        setReceived((list) => [...list, item]);
        const info = infoRowsRef.current.get(match.songId);
        const hasOverwrite = info?.artist.status === "OVERWRITE";
        if (!match.hasJacket && !hasOverwrite) {
          setChecked((s) => new Set(s).add(match.songId));
        }
      } else if (message.type === MSG_DONE) {
        setFailedImages(message.failed);
        setPhase("done");
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("message", onMessage);
    };
  }, [t]);

  // 미리보기 주소(blob:)는 화면을 떠날 때 풀어 준다
  useEffect(() => {
    const list = urls.current;
    return () => list.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const toggle = (songId: number) =>
    setChecked((s) => {
      const next = new Set(s);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });

  const toggleKind = (kind: Kind) =>
    setKinds((s) => {
      const next = new Set(s);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  /** 한 곡에서 켠 항목 중 실제로 저장되는 것(상태가 새로 채움·덮어쓰기인 것). */
  function savableKinds(row: Row): Kind[] {
    const out: Kind[] = [];
    if (kinds.has("artist") && row.info && isWritable(row.info.artist.status)) out.push("artist");
    if (kinds.has("jacket") && row.image) out.push("jacket");
    return out;
  }

  const rows: Row[] = (matchResult?.matches ?? []).map((match) => ({
    match,
    info: infoRows.get(match.songId) ?? null,
    image: received.find((r) => r.match.songId === match.songId) ?? null,
  }));
  const selectedRows = rows.filter((r) => checked.has(r.match.songId) && savableKinds(r).length > 0);
  const overwriteRows = rows.filter((r) => rowOverall(r) === "OVERWRITE");

  async function save() {
    if (selectedRows.length === 0) return;
    setSaving(true);
    setError(null);
    let saved = 0;
    let replaced = 0;
    const info: SongInfoCommitResult = { artistFilled: 0, artistOverwritten: 0, bpmFilled: 0, bpmOverwritten: 0, skipped: 0 };
    try {
      // 곡 정보(아티스트)를 먼저, 재킷을 나중에 저장한다. 중간에 실패하면 거기서 멈추고 앞의 묶음은 저장된 채로 둔다
      const infoItems = selectedRows
        .map((r) => ({ songId: r.match.songId, artist: savableKinds(r).includes("artist"), title: r.match.officialTitle }))
        .filter((i) => i.artist);
      for (const batch of chunk(infoItems, COMMIT_BATCH)) {
        const wanted = new Set(batch.map((i) => i.title));
        const result = await commitSongInfo(
          infosRef.current.filter((i) => wanted.has(i.title.trim())),
          batch.map(({ songId, artist }) => ({ songId, artist, bpm: false })),
        );
        info.artistFilled += result.artistFilled;
        info.artistOverwritten += result.artistOverwritten;
        info.skipped += result.skipped;
      }
      const jacketItems = selectedRows.filter((r) => savableKinds(r).includes("jacket") && r.image).map((r) => ({ songId: r.match.songId, blob: (r.image as Received).blob }));
      for (const batch of chunk(jacketItems, SAVE_BATCH)) {
        const result = await saveJackets(batch);
        saved += result.saved;
        replaced += result.replaced;
      }
      toast(t("saved", { saved, replaced }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("saveFailed"));
    } finally {
      setSaveResult({ saved, replaced, info: infoRows.size > 0 ? info : null });
      setSaving(false);
      await queryClient.invalidateQueries({ queryKey: ["songs"] });
    }
  }

  function rowOverall(row: Row): InfoStatus {
    const statuses: InfoStatus[] = [];
    if (row.info) statuses.push(row.info.artist.status);
    if (row.image) statuses.push(row.match.hasJacket ? "OVERWRITE" : "FILL");
    return overallStatus(statuses);
  }

  const counts = { FILL: 0, OVERWRITE: 0, UNCHANGED: 0, NONE: 0 } as Record<InfoStatus, number>;
  rows.forEach((r) => (counts[rowOverall(r)] += 1));

  return (
    <section aria-label={t("heading")} className="flex flex-col gap-4">
      <h2 className="text-lg font-bold text-fg">{t("heading")}</h2>
      {phase === "idle" && received.length === 0 ? <JacketBookmarkGuide /> : null}
      {phase !== "idle" ? (
        <p role="status" className="text-sm text-fg-sub">
          {phase === "waiting"
            ? t("statusWaiting")
            : phase === "matching"
              ? t("statusMatching")
              : phase === "receiving"
                ? t("statusReceiving", { n: received.length, total: matchResult?.matches.length ?? 0 })
                : t("statusDone", { n: received.length, failed: failedImages })}
        </p>
      ) : null}
      {matchResult ? (
        <div className={CARD}>
          <p className="text-sm text-fg">
            {t("summary", { matched: matchResult.matches.length, unmatched: matchResult.unmatchedCount, missing: matchResult.missingSongs.length })}
          </p>
          <ul className="flex flex-wrap gap-2 text-xs">
            <li className="rounded-full border border-done px-2 py-0.5 text-done-text">{t("statusFill", { n: counts.FILL })}</li>
            <li className="rounded-full border border-weak px-2 py-0.5 text-weak-text">{t("statusOverwrite", { n: counts.OVERWRITE })}</li>
            <li className="rounded-full border border-ctl px-2 py-0.5 text-fg-sub">{t("statusUnchanged", { n: counts.UNCHANGED })}</li>
            {counts.NONE > 0 ? <li className="rounded-full border border-ctl px-2 py-0.5 text-fg-faint">{t("statusNone", { n: counts.NONE })}</li> : null}
            <li className="rounded-full border border-ctl px-2 py-0.5 text-fg-sub">{t("statusUnmatched", { n: matchResult.unmatchedCount })}</li>
          </ul>
          {infoRows.size === 0 && phase !== "matching" ? <p className="break-keep text-xs text-fg-dim">{t("noInfoRead")}</p> : null}
          {failedPages > 0 ? <p className="break-keep text-xs text-danger">{t("failedPages", { n: failedPages })}</p> : null}
          {matchResult.missingSongs.length > 0 ? (
            <details>
              <summary className="cursor-pointer text-xs text-fg-sub">{t("missingList")}</summary>
              <p className="mt-2 text-xs leading-relaxed text-fg-dim">{matchResult.missingSongs.map((s) => s.title).join(" · ")}</p>
            </details>
          ) : null}
        </div>
      ) : null}
      {rows.length > 0 ? (
        <>
          <div className={`${CARD} sm:flex-row sm:items-center sm:justify-between`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-fg-sub">{t("kindsLabel")}</span>
              {KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={kinds.has(kind)}
                  onClick={() => toggleKind(kind)}
                  className={`min-h-9 rounded-full border px-3 text-xs font-bold ${kinds.has(kind) ? "border-chip-on-bg bg-chip-on-bg text-chip-on-fg" : "border-ctl text-fg-sub"}`}
                >
                  {kinds.has(kind) ? "✓ " : ""}
                  {t(`kind_${kind}`)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={BUTTON}
                disabled={overwriteRows.length === 0}
                onClick={() => setChecked((s) => new Set([...s].filter((id) => !overwriteRows.some((r) => r.match.songId === id))))}
              >
                {t("excludeOverwrite", { n: overwriteRows.length })}
              </button>
              <button type="button" className={PRIMARY} disabled={saving || selectedRows.length === 0 || phase !== "done"} onClick={() => void save()}>
                {saving ? t("saving") : t("save", { n: selectedRows.length })}
              </button>
            </div>
          </div>
          {phase !== "done" ? <span className="text-xs text-fg-dim">{t("waitDone")}</span> : null}
          <InfoTable rows={rows} checked={checked} onToggle={toggle} overall={rowOverall} />
        </>
      ) : null}
      {saveResult ? (
        <div className="break-keep text-sm text-fg">
          <p>{t("result", { saved: saveResult.saved, replaced: saveResult.replaced })}</p>
          {saveResult.info ? (
            <p>
              {t("infoResult", {
                artistFilled: saveResult.info.artistFilled,
                artistOverwritten: saveResult.info.artistOverwritten,
                skipped: saveResult.info.skipped,
              })}
            </p>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}

interface Row {
  match: JacketMatch;
  info: SongInfoRow | null;
  image: Received | null;
}

function InfoTable({ rows, checked, onToggle, overall }: {
  rows: Row[];
  checked: Set<number>;
  onToggle: (songId: number) => void;
  overall: (row: Row) => InfoStatus;
}) {
  const t = useTranslations("JacketImport");
  const statusLabel = (s: InfoStatus) => t(`row_${s}`);
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="hidden grid-cols-[28px_44px_minmax(0,1.3fr)_minmax(0,1.6fr)] gap-3 bg-table-head px-3 py-2 text-xs text-fg-sub md:grid">
        <span />
        <span>{t("colJacket")}</span>
        <span>{t("colSong")}</span>
        <span>{t("colArtist")}</span>
      </div>
      <ul>
        {rows.map((row) => {
          const { match, info, image } = row;
          const artistStatus: InfoStatus = info?.artist.status ?? "NONE";
          return (
            <li
              key={match.songId}
              className="grid grid-cols-[auto_44px_minmax(0,1fr)] items-start gap-x-3 gap-y-2 border-t border-line px-3 py-2 first:border-t-0 md:grid-cols-[28px_44px_minmax(0,1.3fr)_minmax(0,1.6fr)]"
            >
              <input
                type="checkbox"
                aria-label={match.songTitle}
                checked={checked.has(match.songId)}
                onChange={() => onToggle(match.songId)}
                className="mt-3 size-4"
              />
              {image ? (
                // blob: 주소의 미리보기라 next/image를 쓰지 않는다
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image.url} alt="" width={44} height={44} className="size-11 rounded-md object-cover" />
              ) : (
                <span aria-hidden="true" className="size-11 rounded-md bg-table-head" />
              )}
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm text-fg">{match.songTitle}</p>
                <p className={`text-[11px] font-bold ${STATUS_COLOR[overall(row)]}`}>
                  {t("jacketLabel")} {image ? statusLabel(match.hasJacket ? "OVERWRITE" : "FILL") : statusLabel("NONE")}
                </p>
              </div>
              <Cell label={t("colArtist")} status={artistStatus} statusText={statusLabel(artistStatus)}
                current={info?.artist.current ?? "–"} official={info?.artist.official ?? "–"} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 현재값 → 가져온 값과 상태 글자(색에만 기대지 않는다). 모바일에서는 항목 이름을 위에 붙인다. */
function Cell({ label, status, statusText, current, official }: {
  label: string;
  status: InfoStatus;
  statusText: string;
  current: string;
  official: string;
}) {
  return (
    <div className="col-span-3 min-w-0 md:col-span-1">
      <p className="text-[11px] text-fg-dim md:hidden">{label}</p>
      <p className="break-words text-xs text-fg-dim">
        {current} → <b className="text-fg">{official}</b>
      </p>
      <p className={`text-[11px] font-bold ${STATUS_COLOR[status]}`}>{statusText}</p>
    </div>
  );
}

function JacketBookmarkGuide() {
  const t = useTranslations();
  const toast = useToast();
  const linkRef = useRef<HTMLAnchorElement>(null);
  const href = buildJacketBookmarkletHref(window.location.origin, jacketBookmarkletMessages(t));

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
      <ol className="break-keep flex list-decimal flex-col gap-2 pl-5 text-sm text-fg-sub">
        <li>
          {t("JacketImport.guideStep1")}{" "}
          <a ref={linkRef} onClick={(e) => e.preventDefault()} className="inline-block rounded-lg border border-ctl px-2 py-0.5 text-fg">
            {t("JacketImport.bookmarkName")}
          </a>
        </li>
        <li>{t("JacketImport.guideStep2")}</li>
        <li>{t("JacketImport.guideStep3")}</li>
      </ol>
      <div>
        <button type="button" className={BUTTON} onClick={() => void copy()}>
          {t("SongImport.copyBookmark")}
        </button>
      </div>
      <p className="break-keep text-xs text-fg-dim">{t("JacketImport.guideNote")}</p>
    </div>
  );
}
