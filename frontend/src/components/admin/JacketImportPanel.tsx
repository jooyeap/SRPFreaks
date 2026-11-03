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
  parseJacketMessage,
  SAVE_BATCH,
} from "@/lib/jacket-reader";
import { matchJackets, saveJackets, type JacketMatch, type JacketMatchResponse } from "@/lib/song-jackets";

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
  const [saveResult, setSaveResult] = useState<{ saved: number; replaced: number } | null>(null);
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
        matchJackets(message.titles)
          .then((result) => {
            matchesRef.current = new Map(result.matches.map((m) => [m.officialTitle, m]));
            setMatchResult(result);
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
        if (!match.hasJacket) {
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

  async function save() {
    const items = received.filter((r) => checked.has(r.match.songId)).map((r) => ({ songId: r.match.songId, blob: r.blob }));
    if (items.length === 0) return;
    setSaving(true);
    setError(null);
    let saved = 0;
    let replaced = 0;
    try {
      // 서버 한도(한 번에 10장)에 맞춰 나눠 보낸다. 중간에 실패하면 거기서 멈추고 앞의 묶음은 저장된 채로 둔다
      for (const batch of chunk(items, SAVE_BATCH)) {
        const result = await saveJackets(batch);
        saved += result.saved;
        replaced += result.replaced;
      }
      toast(t("saved", { saved, replaced }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("saveFailed"));
    } finally {
      setSaveResult({ saved, replaced });
      setSaving(false);
      await queryClient.invalidateQueries({ queryKey: ["songs"] });
    }
  }

  const fresh = received.filter((r) => !r.match.hasJacket);
  const replace = received.filter((r) => r.match.hasJacket);

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
          {failedPages > 0 ? <p className="text-xs text-danger">{t("failedPages", { n: failedPages })}</p> : null}
          {matchResult.missingSongs.length > 0 ? (
            <details>
              <summary className="cursor-pointer text-xs text-fg-sub">{t("missingList")}</summary>
              <p className="mt-2 text-xs leading-relaxed text-fg-dim">{matchResult.missingSongs.map((s) => s.title).join(" · ")}</p>
            </details>
          ) : null}
        </div>
      ) : null}
      {received.length > 0 ? (
        <>
          <JacketGrid title={t("freshHeading", { n: fresh.length })} items={fresh} checked={checked} onToggle={toggle} />
          <JacketGrid title={t("replaceHeading", { n: replace.length })} items={replace} checked={checked} onToggle={toggle} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={PRIMARY} disabled={saving || checked.size === 0 || phase !== "done"} onClick={() => void save()}>
              {saving ? t("saving") : t("save", { n: checked.size })}
            </button>
            {phase !== "done" ? <span className="text-xs text-fg-dim">{t("waitDone")}</span> : null}
          </div>
        </>
      ) : null}
      {saveResult ? <p className="text-sm text-fg">{t("result", saveResult)}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function JacketGrid({ title, items, checked, onToggle }: {
  title: string;
  items: Received[];
  checked: Set<number>;
  onToggle: (songId: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className={CARD}>
      <h3 className="text-sm font-bold text-fg">{title}</h3>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
        {items.map((item) => (
          <li key={item.match.songId}>
            <label className="flex cursor-pointer flex-col gap-1 text-[11px] text-fg-sub">
              {/* blob: 주소의 미리보기라 next/image를 쓰지 않는다 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt={item.match.songTitle} width={200} height={200} className="aspect-square w-full rounded-md object-cover" />
              <span className="flex items-start gap-1">
                <input type="checkbox" checked={checked.has(item.match.songId)} onChange={() => onToggle(item.match.songId)} />
                <span className="line-clamp-2">{item.match.songTitle}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
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
      toast(t("SongImport.copyFailed"));
    }
  }

  return (
    <div className={CARD}>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-fg-sub">
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
      <p className="text-xs text-fg-dim">{t("JacketImport.guideNote")}</p>
    </div>
  );
}
