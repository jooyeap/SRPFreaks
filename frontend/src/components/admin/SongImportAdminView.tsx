"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/Toast";
import { adminKeys } from "@/lib/admin";
import { difficultyLabel, formatLevel, partLabel } from "@/lib/format";
import { buildSongBookmarkletHref, buildSongBookmarkletSource, FRAGMENT_PREFIX, songBookmarkletMessages, type ReadSong } from "@/lib/official-song-reader";
import { SONG_CREATE_AFFECTED_KEYS } from "@/lib/song-admin";
import {
  commitOfficialSongs,
  mergeSongs,
  parseSongFragment,
  previewOfficialSongs,
  type SongImportCommitResult,
  type SongImportPreview,
} from "@/lib/song-import";

const CARD = "flex flex-col gap-3 rounded-2xl border border-line bg-card p-4";
const BUTTON = "min-h-11 rounded-xl border border-chip-line px-4 text-sm font-bold text-fg hover:bg-table-head disabled:opacity-50";
const PRIMARY = "min-h-11 rounded-xl bg-chip-on-bg px-4 text-sm font-extrabold text-chip-on-fg disabled:opacity-50";

/**
 * 공식 곡 목록의 아티스트·레벨 갱신 화면 (D42, ROOT 전용).
 * 흐름: 북마클릿이 공식 곡 목록 페이지에서 읽은 값을 이 창으로 넘긴다(주소 조각) → 받은 곡이 쌓인다 → 미리보기 → 고른 항목만 반영.
 * 받은 곡은 이 화면의 메모리에만 둔다(새로 고치면 사라지고, 다시 북마크를 누르면 된다). 새 곡·채보는 만들지 않는다.
 * 미리보기 결과는 "미리보기를 누른 때의 받은 곡"과 같은 목록일 때만 보여 준다(그 뒤에 곡이 더 쌓이면 다시 미리보기를 해야 한다).
 */
export function SongImportAdminView() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [songs, setSongs] = useState<ReadSong[]>([]);
  const [previewed, setPreviewed] = useState<{ songs: ReadSong[]; data: SongImportPreview } | null>(null);
  const [artistIds, setArtistIds] = useState<Set<number>>(new Set());
  const [levelIds, setLevelIds] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<SongImportCommitResult | null>(null);
  const [invalid, setInvalid] = useState(false);

  // 북마클릿이 넘긴 값을 받는다. 같은 탭을 재사용해 다음 쪽을 보내면 주소의 조각만 바뀐다(hashchange).
  // 조각은 해석이 되든 안 되든 먼저 주소에서 지운다(새로고침·공유로 다시 처리되지 않게).
  useEffect(() => {
    const receive = () => {
      if (!window.location.hash.startsWith(FRAGMENT_PREFIX)) return;
      const parsed = parseSongFragment(window.location.hash);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      if (!parsed || parsed.length === 0) {
        setInvalid(true);
        return;
      }
      setInvalid(false);
      setSongs((current) => mergeSongs(current, parsed));
      setResult(null);
    };
    receive();
    window.addEventListener("hashchange", receive);
    return () => window.removeEventListener("hashchange", receive);
  }, []);

  const previewMutation = useMutation({
    mutationFn: (target: ReadSong[]) => previewOfficialSongs(target).then((data) => ({ songs: target, data })),
    onSuccess: ({ songs: target, data }) => {
      setPreviewed({ songs: target, data });
      setArtistIds(new Set(data.artistFills.map((f) => f.songId)));
      setLevelIds(new Set(data.levelChanges.map((l) => l.songDifficultyId)));
    },
  });

  const commitMutation = useMutation({
    mutationFn: (target: ReadSong[]) => commitOfficialSongs(target, [...artistIds], [...levelIds]),
    onSuccess: async (done) => {
      setResult(done);
      setSongs([]);
      setPreviewed(null);
      // 아티스트·레벨이 바뀌면 곡 목록·서열표·곡 상세·감사 로그가 달라진다
      await Promise.all([...SONG_CREATE_AFFECTED_KEYS, adminKeys.all].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
  });

  const current = previewed && previewed.songs === songs ? previewed.data : null;
  const selectedCount = artistIds.size + levelIds.size;
  const busy = previewMutation.isPending || commitMutation.isPending;

  function clearAll() {
    setSongs([]);
    setPreviewed(null);
    setResult(null);
    setInvalid(false);
    previewMutation.reset();
    commitMutation.reset();
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-fg">{t("SongImport.title")}</h1>
        <p className="text-sm text-fg-sub">{t("SongImport.lead")}</p>
      </header>

      <BookmarkGuide />

      <section aria-label={t("SongImport.receivedAria")} className={CARD}>
        <h2 className="text-sm font-bold text-fg">{t("SongImport.receivedHeading")}</h2>
        <p className="text-sm text-fg-sub" role="status">
          {songs.length === 0 ? t("SongImport.receivedNone") : t("SongImport.receivedCount", { count: songs.length })}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={PRIMARY} disabled={songs.length === 0 || busy} onClick={() => previewMutation.mutate(songs)}>
            {previewMutation.isPending ? t("SongImport.previewing") : t("SongImport.preview")}
          </button>
          <button type="button" className={BUTTON} disabled={(songs.length === 0 && !result) || busy} onClick={clearAll}>
            {t("SongImport.clear")}
          </button>
        </div>
        {invalid ? (
          <p role="alert" className="text-sm text-fg">
            {t("SongImport.invalidFragment")}
          </p>
        ) : null}
        {previewMutation.isError ? (
          <p role="alert" className="text-sm text-fg">
            {t("SongImport.previewFailed")}
          </p>
        ) : null}
      </section>

      {current ? (
        <PreviewSection
          preview={current}
          artistIds={artistIds}
          levelIds={levelIds}
          onArtistIds={setArtistIds}
          onLevelIds={setLevelIds}
          selectedCount={selectedCount}
          busy={busy}
          committing={commitMutation.isPending}
          failed={commitMutation.isError}
          onCommit={() => commitMutation.mutate(songs)}
        />
      ) : null}

      {result ? (
        <p role="status" className="rounded-2xl border border-line bg-card p-4 text-sm text-fg">
          {t("SongImport.result", { artist: result.artistFilled, level: result.levelChanged, skipped: result.skipped })}
        </p>
      ) : null}
    </div>
  );
}

function BookmarkGuide() {
  const t = useTranslations();
  const toast = useToast();
  const linkRef = useRef<HTMLAnchorElement>(null);
  const messages = songBookmarkletMessages(t);
  const href = buildSongBookmarkletHref(window.location.origin, messages);

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

  async function copyBody() {
    try {
      // 주소창에 붙여넣어 실행하는 방법: 맨 앞 j를 뺀 글자를 복사하고 주소창에 j를 먼저 입력한 뒤 붙여넣는다(가져오기 화면과 같은 방식)
      await navigator.clipboard.writeText(`avascript:${encodeURIComponent(buildSongBookmarkletSource(window.location.origin, messages))}`);
      toast(t("SongImport.scriptCopied"));
    } catch {
      toast(t("SongImport.copyFailed"));
    }
  }

  return (
    <section aria-label={t("SongImport.guideAria")} className={CARD}>
      <h2 className="text-sm font-bold text-fg">{t("SongImport.guideHeading")}</h2>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-fg-sub">
        <li>
          {t("SongImport.guideStep1")}{" "}
          <a ref={linkRef} onClick={(e) => e.preventDefault()} className="inline-block rounded-lg border border-chip-line px-2 py-0.5 text-fg">
            {t("SongImport.bookmarkName")}
          </a>
        </li>
        <li>{t("SongImport.guideStep2")}</li>
        <li>{t("SongImport.guideStep3")}</li>
      </ol>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BUTTON} onClick={copy}>
          {t("SongImport.copyBookmark")}
        </button>
        <button type="button" className={BUTTON} onClick={copyBody}>
          {t("SongImport.copyScript")}
        </button>
      </div>
      <p className="text-xs text-fg-dim">{t("SongImport.guideNote")}</p>
    </section>
  );
}

function PreviewSection({
  preview,
  artistIds,
  levelIds,
  onArtistIds,
  onLevelIds,
  selectedCount,
  busy,
  committing,
  failed,
  onCommit,
}: {
  preview: SongImportPreview;
  artistIds: Set<number>;
  levelIds: Set<number>;
  onArtistIds: (ids: Set<number>) => void;
  onLevelIds: (ids: Set<number>) => void;
  selectedCount: number;
  busy: boolean;
  committing: boolean;
  failed: boolean;
  onCommit: () => void;
}) {
  const t = useTranslations();
  const nothing = preview.artistFills.length === 0 && preview.levelChanges.length === 0;

  return (
    <section aria-label={t("SongImport.previewAria")} className={CARD}>
      <h2 className="text-sm font-bold text-fg">{t("SongImport.previewHeading")}</h2>
      <p className="text-sm text-fg-sub">
        {t("SongImport.summary", { read: preview.readSongs, matched: preview.matchedSongs, unchanged: preview.unchangedSongs })}
      </p>
      {preview.readSongs === 0 ? <p className="text-sm text-fg">{t("SongImport.readNothing")}</p> : null}

      {preview.unmatchedCount > 0 ? (
        <details className="text-sm text-fg-sub">
          <summary className="cursor-pointer">{t("SongImport.unmatched", { count: preview.unmatchedCount })}</summary>
          <ul className="mt-1 list-disc pl-5">
            {preview.unmatchedTitles.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-fg-dim">{t("SongImport.unmatchedNote")}</p>
        </details>
      ) : null}

      {preview.artistFills.length > 0 ? (
        <SelectList
          heading={t("SongImport.artistHeading", { count: preview.artistFills.length })}
          ids={artistIds}
          onIds={onArtistIds}
          items={preview.artistFills.map((f) => ({ id: f.songId, label: t("SongImport.artistLine", { title: f.title, artist: f.officialArtist }) }))}
        />
      ) : null}

      {preview.levelChanges.length > 0 ? (
        <SelectList
          heading={t("SongImport.levelHeading", { count: preview.levelChanges.length })}
          ids={levelIds}
          onIds={onLevelIds}
          items={preview.levelChanges.map((l) => ({
            id: l.songDifficultyId,
            label: t("SongImport.levelLine", {
              title: l.title,
              chart: `${partLabel(l.part)} ${difficultyLabel(l.difficultyType)}`,
              from: formatLevel(l.currentLevel),
              to: formatLevel(l.officialLevel),
            }),
          }))}
        />
      ) : null}

      {preview.artistMismatches.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-bold text-fg">{t("SongImport.mismatchHeading", { count: preview.artistMismatches.length })}</h3>
          <p className="text-xs text-fg-dim">{t("SongImport.mismatchNote")}</p>
          <ul className="list-disc pl-5 text-sm text-fg-sub">
            {preview.artistMismatches.map((m) => (
              <li key={m.songId}>{t("SongImport.mismatchLine", { title: m.title, current: m.currentArtist, official: m.officialArtist })}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {nothing ? <p className="text-sm text-fg">{t("SongImport.nothingToChange")}</p> : null}
      {failed ? (
        <p role="alert" className="text-sm text-fg">
          {t("SongImport.commitFailed")}
        </p>
      ) : null}
      {!nothing ? (
        <div>
          <button type="button" className={PRIMARY} disabled={selectedCount === 0 || busy} onClick={onCommit}>
            {committing ? t("SongImport.committing") : t("SongImport.commit", { count: selectedCount })}
          </button>
        </div>
      ) : null}
    </section>
  );
}

/** 체크박스 목록. 처음에는 모두 선택돼 있고, 모두 선택/해제 버튼으로 한 번에 바꾼다. */
function SelectList({
  heading,
  ids,
  onIds,
  items,
}: {
  heading: string;
  ids: Set<number>;
  onIds: (ids: Set<number>) => void;
  items: { id: number; label: string }[];
}) {
  const t = useTranslations();
  const toggle = (id: number) => {
    const next = new Set(ids);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onIds(next);
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-fg">{heading}</h3>
        <div className="flex gap-2">
          <button type="button" className="text-xs text-fg-sub underline underline-offset-2" onClick={() => onIds(new Set(items.map((i) => i.id)))}>
            {t("SongImport.selectAll")}
          </button>
          <button type="button" className="text-xs text-fg-sub underline underline-offset-2" onClick={() => onIds(new Set())}>
            {t("SongImport.selectNone")}
          </button>
        </div>
      </div>
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={item.id}>
            <label className="flex min-h-11 items-center gap-2 text-sm text-fg-sub">
              <input type="checkbox" checked={ids.has(item.id)} onChange={() => toggle(item.id)} className="size-4" />
              <span>{item.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
