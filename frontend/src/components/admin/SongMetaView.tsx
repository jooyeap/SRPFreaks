"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AdminBackLink } from "@/components/admin/AdminBackLink";
import { Pager } from "@/components/Pager";
import { ApiError } from "@/lib/api";
import type { TitleKind } from "@/lib/api-types";
import { difficultyLabel, formatLevel, partLabel } from "@/lib/format";
import {
  addKeyword,
  canSaveMeta,
  fetchSongMetaTodo,
  KEYWORD_KINDS,
  missingOf,
  restoreSongMeta,
  saveSongMeta,
  SONG_META_AFFECTED_KEYS,
  SONG_META_FILTERS,
  songMetaKeys,
  type MetaSaved,
  type NewKeyword,
  type SongMetaFilter,
  type SongMetaRow,
} from "@/lib/song-meta";
import { useToast } from "@/components/Toast";
import { useScrollTopOnChange } from "@/lib/use-scroll-top";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/use-media-query";
import type { Translator } from "@/i18n/translator";
import type { MessageKey } from "@/i18n/translator";

const FIELD = "min-h-11 w-full min-w-0 rounded-[10px] border border-line bg-card px-3 py-2 text-sm text-fg compact:min-h-9";
const BTN = "min-h-11 shrink-0 rounded-lg border border-ctl px-3 text-sm font-bold text-fg hover:bg-table-head disabled:text-disabled compact:min-h-9";
const BTN_PRIMARY = "min-h-11 shrink-0 rounded-lg bg-chip-on-bg px-4 text-sm font-extrabold text-chip-on-fg disabled:opacity-50 compact:min-h-9";

const CHIP_LABELS: Record<SongMetaFilter, MessageKey> = {
  ANY: "SongMeta.chipAny",
  ARTIST: "SongMeta.chipArtist",
  KEYWORD: "SongMeta.chipKeyword",
  BOTH: "SongMeta.chipBoth",
};

const KIND_LABELS: Record<TitleKind, MessageKey> = {
  ROMAJI: "SongMeta.kindRomaji",
  KANA: "SongMeta.kindKana",
  KO: "SongMeta.kindKo",
  ALIAS: "SongMeta.kindAlias",
};

function messageOf(error: unknown, t: Translator): string | null {
  if (!error) {
    return null;
  }
  return error instanceof ApiError ? error.message : t("Common.saveFailed");
}

/**
 * 곡 정보 정리 (D91, ADMIN·ROOT). 아티스트나 검색 키워드(song_titles)가 비어 있는 곡만 모아 채워 넣는다.
 *  - 데스크톱(1024px 이상): 줄에서 바로 입력(인라인). 모바일: 줄을 누르면 펼쳐서 입력한다(한 번에 하나).
 *  - 저장은 기존 곡 수정 API(PUT /songs/{id}, D22)를 그대로 쓴다(최신 상세를 읽고 그 위에 얹어 보낸다). 감사 로그는 서버가 남긴다.
 *  - 저장하면 조건이 풀린 곡은 목록에서 사라지고, 맨 위에 `되돌리기` 안내가 뜬다. 이번 저장 한 건만 되돌린다.
 *  - 곡 삭제·신규 등록·자동 등록은 없다. 권한은 서버가 다시 검사한다(403).
 * 같은 줄을 CSS로 두 번 그리지 않고 훅(useMediaQuery)으로 한쪽만 그린다(같은 입력칸이 DOM에 두 번 생기지 않게).
 */
export function SongMetaView({ viewerId }: { viewerId: number }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const toast = useToast();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const [filter, setFilter] = useState<SongMetaFilter>("ANY");
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<number | null>(null);
  const [notice, setNotice] = useState<MetaSaved | null>(null);
  useScrollTopOnChange(page);

  // 검색어는 입력을 멈춘 뒤 0.3초 후에 반영한다(글자마다 서버를 부르지 않게)
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(input.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(id);
  }, [input]);

  const list = useQuery({
    queryKey: songMetaKeys.todo(viewerId, filter, q, page),
    queryFn: ({ signal }) => fetchSongMetaTodo(filter, q, page, signal),
    placeholderData: keepPreviousData,
  });
  const data = list.data;

  async function refresh() {
    await Promise.all(SONG_META_AFFECTED_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey: [...queryKey] })));
  }

  const save = useMutation({
    mutationFn: ({ row, artist, keywords }: { row: SongMetaRow; artist: string; keywords: readonly NewKeyword[] }) =>
      saveSongMeta(row.songId, artist, keywords),
    onSuccess: async (saved) => {
      setNotice(saved);
      setOpenId(null);
      await refresh();
    },
  });
  const undo = useMutation({
    mutationFn: (saved: MetaSaved) => restoreSongMeta(saved),
    onSuccess: async () => {
      setNotice(null);
      toast(t("SongMeta.undone"));
      await refresh();
    },
  });

  function chooseFilter(next: SongMetaFilter) {
    setFilter(next);
    setPage(0);
    setOpenId(null);
  }

  const summary = data?.summary;
  const counts: Record<SongMetaFilter, number | undefined> = {
    ANY: summary?.anyMissing,
    ARTIST: summary?.noArtist,
    KEYWORD: summary?.noKeyword,
    BOTH: summary?.bothMissing,
  };
  const rows = data?.page.content ?? [];

  const renderRow = (row: SongMetaRow) => {
    // 저장 뒤 값(아티스트·표기 개수)이 바뀌면 줄을 새로 만든다 -> 쓰다 만 입력이 남지 않는다
    const key = `${row.songId}-${row.artist ?? ""}-${row.titleCount}`;
    const common = {
      row,
      pending: save.isPending && save.variables?.row.songId === row.songId,
      error: save.variables?.row.songId === row.songId ? messageOf(save.error, t) : null,
      onSave: (artist: string, keywords: readonly NewKeyword[]) => save.mutate({ row, artist, keywords }),
    };
    return desktop ? (
      <DesktopRow key={key} {...common} />
    ) : (
      <MobileRow key={key} {...common} open={openId === row.songId} onToggle={() => setOpenId(openId === row.songId ? null : row.songId)} />
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <AdminBackLink />
        <div>
          <h1 className="text-xl font-semibold text-fg">{t("SongMeta.title")}</h1>
          <p className="mt-1 break-keep text-sm text-fg-sub">{t("SongMeta.lead")}</p>
        </div>
      </div>

      {summary ? (
        <dl aria-label={t("SongMeta.summaryAria")} className="hidden grid-cols-4 gap-3 lg:grid">
          {(
            [
              ["SongMeta.summaryTotal", summary.totalSongs],
              ["SongMeta.summaryNoArtist", summary.noArtist],
              ["SongMeta.summaryNoKeyword", summary.noKeyword],
              ["SongMeta.summaryBoth", summary.bothMissing],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-line bg-card px-4 py-3">
              <dt className="text-xs text-fg-sub">{t(label)}</dt>
              <dd className="text-xl font-bold text-fg font-num">{t("SongMeta.countUnit", { count: value })}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t("SongMeta.filterAria")} className="flex flex-wrap gap-2">
          {SONG_META_FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={filter === item}
              onClick={() => chooseFilter(item)}
              className={`min-h-11 rounded-full border px-4 text-sm font-bold compact:min-h-9 ${
                filter === item ? "border-transparent bg-chip-on-bg text-chip-on-fg" : "border-ctl text-fg-sub hover:text-fg"
              }`}
            >
              {t(CHIP_LABELS[item])}
              {counts[item] !== undefined ? <span className="ml-1.5 font-num">{counts[item]}</span> : null}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          aria-label={t("SongMeta.searchLabel")}
          placeholder={t("SongMeta.searchPlaceholder")}
          maxLength={100}
          className={`${FIELD} sm:ml-auto sm:max-w-60`}
        />
      </div>

      {notice ? (
        <div role="status" data-testid="song-meta-notice" className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-sm text-fg">
          <span className="min-w-0 break-keep break-words">{t("SongMeta.savedNotice", { title: notice.title, count: summary?.anyMissing ?? 0 })}</span>
          <button type="button" className={BTN} disabled={undo.isPending} aria-label={t("SongMeta.undoAria", { title: notice.title })} onClick={() => undo.mutate(notice)}>
            {t("SongMeta.undo")}
          </button>
        </div>
      ) : null}
      {undo.isError ? (
        <p role="alert" className="break-keep text-sm text-fg">
          {messageOf(undo.error, t)}
        </p>
      ) : null}

      {!data ? (
        list.isError ? (
          <p role="alert" className="break-keep text-sm text-fg">
            {list.error instanceof ApiError ? list.error.message : t("SongMeta.loadFailed")}
          </p>
        ) : (
          <p className="text-sm text-fg-sub">{t("Common.loading")}</p>
        )
      ) : rows.length === 0 ? (
        <p className="break-keep text-sm text-fg-sub">{q || filter !== "ANY" ? t("SongMeta.emptyFiltered") : t("SongMeta.empty")}</p>
      ) : (
        <>
          {desktop ? (
            <div aria-hidden="true" className={`${DESKTOP_GRID} px-4 text-xs font-bold text-fg-sub`}>
              <span>{t("SongMeta.colSong")}</span>
              <span>{t("SongMeta.colArtist")}</span>
              <span>{t("SongMeta.colKeyword")}</span>
              <span />
            </div>
          ) : null}
          <ul aria-label={t("SongMeta.listAria")} className="flex flex-col gap-2">
            {rows.map(renderRow)}
          </ul>
          <Pager
            page={data.page.page}
            totalPages={data.page.totalPages}
            onChange={(next) => {
              setPage(next);
              setOpenId(null);
            }}
          />
        </>
      )}
    </div>
  );
}

const DESKTOP_GRID = "grid grid-cols-[minmax(0,16rem)_minmax(0,14rem)_minmax(0,1fr)_auto] items-center gap-3";

/** 곡 이름과 대표 채보(`Guitar | MAS 9.80`). 재킷 칸은 없다. */
function SongCell({ row }: { row: SongMetaRow }) {
  const t = useTranslations();
  return (
    <div className="min-w-0">
      <div className="break-words text-sm font-semibold text-fg">{row.title}</div>
      <div className="text-xs text-fg-sub font-num">
        {row.topPart && row.topDifficulty && row.topLevel !== null
          ? `${partLabel(row.topPart)} | ${difficultyLabel(row.topDifficulty)} ${formatLevel(row.topLevel)}`
          : t("SongMeta.noChart")}
      </div>
    </div>
  );
}

/** 줄 하나의 입력 상태: 아티스트 글자와 새로 넣을 키워드. 저장하면 줄이 새로 만들어져 비워진다. */
function useDraft(row: SongMetaRow) {
  const t = useTranslations();
  const [artist, setArtist] = useState("");
  const [keywords, setKeywords] = useState<NewKeyword[]>([]);
  const [kind, setKind] = useState<TitleKind>("ROMAJI");
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  function add() {
    const result = addKeyword(keywords, kind, text, t);
    if (!result.ok) {
      setProblem(result.message);
      return;
    }
    setKeywords(result.keywords);
    setText("");
    setProblem(null);
  }
  function reset() {
    setArtist("");
    setKeywords([]);
    setText("");
    setProblem(null);
  }
  return {
    artist,
    setArtist,
    keywords,
    removeKeyword: (index: number) => setKeywords((current) => current.filter((_, i) => i !== index)),
    kind,
    setKind,
    text,
    setText,
    problem,
    add,
    reset,
    canSave: canSaveMeta(row, artist, keywords),
  };
}
type Draft = ReturnType<typeof useDraft>;

function ArtistField({ row, draft }: { row: SongMetaRow; draft: Draft }) {
  const t = useTranslations();
  if (!missingOf(row).artist) {
    return <span className="text-xs text-fg-sub">{t("SongMeta.registered")}</span>;
  }
  return (
    <input
      value={draft.artist}
      onChange={(event) => draft.setArtist(event.target.value)}
      aria-label={t("SongMeta.artistAria", { title: row.title })}
      placeholder={t("SongMeta.artistPlaceholder")}
      maxLength={255}
      className={FIELD}
    />
  );
}

function KeywordField({ row, draft }: { row: SongMetaRow; draft: Draft }) {
  const t = useTranslations();
  if (!missingOf(row).keyword) {
    return <span className="text-xs text-fg-sub">{t("SongMeta.registered")}</span>;
  }
  const kindLabel = t(KIND_LABELS[draft.kind]);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div role="group" aria-label={t("SongMeta.keywordKindAria", { title: row.title })} className="flex flex-wrap gap-1.5">
        {KEYWORD_KINDS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={draft.kind === item}
            onClick={() => draft.setKind(item)}
            className={`min-h-11 rounded-full border px-3 text-xs font-bold compact:min-h-8 ${
              draft.kind === item ? "border-transparent bg-chip-on-bg text-chip-on-fg" : "border-ctl text-fg-sub hover:text-fg"
            }`}
          >
            {t(KIND_LABELS[item])}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft.text}
          onChange={(event) => draft.setText(event.target.value)}
          onKeyDown={(event) => {
            // 한글·일본어 입력 중 Enter(글자 확정)로는 추가하지 않는다
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              draft.add();
            }
          }}
          aria-label={t("SongMeta.keywordInputAria", { title: row.title, kind: kindLabel })}
          placeholder={t("SongMeta.keywordInputPlaceholder", { kind: kindLabel })}
          maxLength={255}
          className={FIELD}
        />
        <button type="button" className={BTN} onClick={draft.add}>
          {t("SongMeta.keywordAdd")}
        </button>
      </div>
      {draft.problem ? (
        <p role="alert" className="break-keep text-xs text-danger">
          {draft.problem}
        </p>
      ) : null}
      {draft.keywords.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {draft.keywords.map((keyword, index) => (
            <li key={`${keyword.kind}-${keyword.title}`} className="flex items-center gap-1 rounded-full border border-line bg-table-head py-0.5 pl-3 pr-1 text-xs text-fg">
              <span className="text-fg-sub">{t(KIND_LABELS[keyword.kind])}</span>
              <span className="break-all">{keyword.title}</span>
              <button
                type="button"
                aria-label={t("SongMeta.keywordRemoveAria", { keyword: keyword.title })}
                onClick={() => draft.removeKeyword(index)}
                className="flex size-8 items-center justify-center rounded-full text-fg-sub hover:text-fg"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

interface RowProps {
  row: SongMetaRow;
  pending: boolean;
  error: string | null;
  onSave: (artist: string, keywords: readonly NewKeyword[]) => void;
}

/** 데스크톱: 줄에서 바로 입력하는 네 칸(곡 / 아티스트 / 검색 키워드 / 저장). */
function DesktopRow({ row, pending, error, onSave }: RowProps) {
  const t = useTranslations();
  const draft = useDraft(row);
  return (
    <li className="rounded-2xl border border-line bg-card px-4 py-3">
      <div className={`${DESKTOP_GRID} items-start`}>
        <SongCell row={row} />
        <ArtistField row={row} draft={draft} />
        <KeywordField row={row} draft={draft} />
        <button
          type="button"
          className={BTN_PRIMARY}
          disabled={!draft.canSave || pending}
          aria-label={t("SongMeta.saveAria", { title: row.title })}
          onClick={() => onSave(draft.artist, draft.keywords)}
        >
          {pending ? t("SongMeta.saving") : t("SongMeta.save")}
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 break-keep text-sm text-fg">
          {error}
        </p>
      ) : null}
    </li>
  );
}

/** 모바일: 줄 머리(곡 이름과 비어 있는 것 태그)를 누르면 그 자리에서 펼쳐 입력한다. */
function MobileRow({ row, pending, error, onSave, open, onToggle }: RowProps & { open: boolean; onToggle: () => void }) {
  const t = useTranslations();
  const draft = useDraft(row);
  const missing = missingOf(row);
  const panelId = `song-meta-${row.songId}`;
  function close() {
    draft.reset();
    onToggle();
  }
  return (
    <li className={`rounded-2xl border bg-card ${open ? "border-ctl" : "border-line"}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t(open ? "SongMeta.collapseAria" : "SongMeta.expandAria", { title: row.title })}
        onClick={onToggle}
        className="flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <SongCell row={row} />
          <span className="flex flex-wrap gap-1.5">
            {missing.artist ? <Tag>{t("SongMeta.tagNoArtist")}</Tag> : null}
            {missing.keyword ? <Tag>{t("SongMeta.tagNoKeyword")}</Tag> : null}
          </span>
        </span>
        <span aria-hidden="true" className="text-fg-sub">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open ? (
        <div id={panelId} className="flex flex-col gap-3 border-t border-line px-3 py-3">
          {missing.artist ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-fg-sub">{t("SongMeta.colArtist")}</span>
              <ArtistField row={row} draft={draft} />
            </div>
          ) : null}
          {missing.keyword ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-fg-sub">{t("SongMeta.colKeyword")}</span>
              <KeywordField row={row} draft={draft} />
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="break-keep text-sm text-fg">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button type="button" className={`${BTN} flex-1`} onClick={close}>
              {t("SongMeta.cancel")}
            </button>
            <button
              type="button"
              className={`${BTN_PRIMARY} flex-1`}
              disabled={!draft.canSave || pending}
              aria-label={t("SongMeta.saveAria", { title: row.title })}
              onClick={() => onSave(draft.artist, draft.keywords)}
            >
              {pending ? t("SongMeta.saving") : t("SongMeta.save")}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-bold leading-none text-fg-sub">{children}</span>;
}
