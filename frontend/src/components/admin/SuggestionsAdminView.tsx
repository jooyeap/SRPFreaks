"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pager } from "@/components/Pager";
import { useToast } from "@/components/Toast";
import { SongCreateDialog } from "@/components/songs/SongCreateDialog";
import { StatusLabel } from "@/components/suggestions/StatusLabel";
import { ApiError } from "@/lib/api";
import type { AdminSuggestionResponse, SuggestionCategory, SuggestionStatus } from "@/lib/api-types";
import { fetchDifficultyTables, pickRatingTable } from "@/lib/difficulty-table";
import { formatPlayedDate } from "@/lib/format";
import {
  CATEGORY_LABELS,
  describeChartRequest,
  fetchAdminSuggestions,
  fetchReceivedCount,
  reviewSuggestion,
  STATUS_LABELS,
  SUGGESTION_CATEGORIES,
  SUGGESTION_NOTE_MAX,
  SUGGESTION_STATUSES,
  suggestionKeys,
  SUGGESTIONS_PAGE_SIZE,
} from "@/lib/suggestions";
import { useScrollTopOnChange } from "@/lib/use-scroll-top";
import { useTranslations } from "next-intl";
import type { Translator } from "@/i18n/translator";

const FIELD = "rounded-[10px] border border-line bg-card px-3 py-2 text-sm text-fg";

function messageOf(error: unknown, t: Translator): string | null {
  if (!error) {
    return null;
  }
  return error instanceof ApiError ? error.message : t("Common.saveFailed");
}

/**
 * 건의 관리 (D35, ADMIN·ROOT). 종류·상태로 걸러 보고, 건마다 처리 상태와 답변을 남긴다.
 * 처리는 감사 로그에 기록된다(서버). 보낸 사람은 닉네임만 보인다. 권한은 서버가 다시 검사한다(403).
 */
export function SuggestionsAdminView({ viewerId }: { viewerId: number }) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [category, setCategory] = useState<SuggestionCategory | "">("");
  const [status, setStatus] = useState<SuggestionStatus | "">("");
  const [page, setPage] = useState(0);
  useScrollTopOnChange(page);

  const list = useQuery({
    queryKey: suggestionKeys.admin(viewerId, category, status, page),
    queryFn: ({ signal }) => fetchAdminSuggestions({ category, status }, page, SUGGESTIONS_PAGE_SIZE, signal),
    placeholderData: keepPreviousData,
  });
  const count = useQuery({
    queryKey: suggestionKeys.receivedCount(viewerId),
    queryFn: ({ signal }) => fetchReceivedCount(signal),
  });

  const review = useMutation({
    mutationFn: ({ id, status: next, adminNote }: { id: number; status: SuggestionStatus; adminNote: string }) =>
      reviewSuggestion(id, { status: next, adminNote }),
    onSuccess: async () => {
      toast(t("Admin.reviewSaved"));
      await queryClient.invalidateQueries({ queryKey: suggestionKeys.all });
      await queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-fg">{t("Admin.suggestionsTitle")}</h1>
        {count.data ? (
          <p className="mt-1 text-sm text-fg-sub">
            {t.rich("Admin.receivedCount", { count: count.data.received, n: (c) => <span className="font-num">{c}</span> })}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="flex items-center gap-2 text-sm text-fg-sub">
          {t("Suggestions.fieldCategory")}
          <select
            className={FIELD}
            value={category}
            onChange={(event) => {
              setCategory(event.target.value as SuggestionCategory | "");
              setPage(0);
            }}
          >
            <option value="">{t("Songs.all")}</option>
            {SUGGESTION_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {t(CATEGORY_LABELS[item])}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-fg-sub">
          {t("Admin.status")}
          <select
            className={FIELD}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as SuggestionStatus | "");
              setPage(0);
            }}
          >
            <option value="">{t("Songs.all")}</option>
            {SUGGESTION_STATUSES.map((item) => (
              <option key={item} value={item}>
                {t(STATUS_LABELS[item])}
              </option>
            ))}
          </select>
        </label>
      </div>

      {list.isPending ? (
        <p className="text-sm text-fg-sub">{t("Common.loading")}</p>
      ) : list.isError ? (
        <p role="alert" className="text-sm text-fg">
          {list.error instanceof ApiError ? list.error.message : t("Admin.suggestionsLoadFailed")}
        </p>
      ) : list.data.content.length === 0 ? (
        <p className="text-sm text-fg-sub">{t("Admin.suggestionsEmpty")}</p>
      ) : (
        <>
          <ul aria-label={t("Admin.suggestionsListAria")} className="flex flex-col gap-3">
            {list.data.content.map((item) => (
              <ReviewItem
                key={`${item.id}-${item.updatedAt}`}
                item={item}
                pending={review.isPending && review.variables?.id === item.id}
                error={review.variables?.id === item.id ? messageOf(review.error, t) : null}
                onSave={(next, adminNote) => review.mutate({ id: item.id, status: next, adminNote })}
              />
            ))}
          </ul>
          <Pager page={list.data.page} totalPages={list.data.totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}

/** key에 updatedAt을 넣어, 저장이 끝나 서버 값이 바뀌면 입력 상태를 서버 값으로 다시 맞춘다. */
function ReviewItem({
  item,
  pending,
  error,
  onSave,
}: {
  item: AdminSuggestionResponse;
  pending: boolean;
  error: string | null;
  onSave: (status: SuggestionStatus, adminNote: string) => void;
}) {
  const t = useTranslations();
  const [status, setStatus] = useState<SuggestionStatus>(item.status);
  const [note, setNote] = useState(item.adminNote ?? "");
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-bold text-fg">{item.title}</h2>
        <time dateTime={item.createdAt} className="shrink-0 font-num text-xs text-fg-dim">
          {formatPlayedDate(item.createdAt)}
        </time>
      </div>
      <div className="flex items-center gap-2 text-xs text-fg-sub">
        <span>{t(CATEGORY_LABELS[item.category])}</span>
        <StatusLabel status={item.status} />
        <span>{t("Admin.sentBy", { name: item.authorNickname })}</span>
        {item.requestedPart && item.requestedDifficulty ? (
          <span>{describeChartRequest(item.requestedPart, item.requestedDifficulty)}</span>
        ) : null}
      </div>
      <p className="whitespace-pre-wrap break-words text-sm text-fg">{item.content}</p>
      {item.category === "SONG_REQUEST" ? <RegisterSongFromSuggestion item={item} /> : null}
      <div className="flex flex-col gap-2 border-t border-line pt-2">
        <label className="flex items-center gap-2 text-sm text-fg-sub">
          {t("Admin.status")}
          <select
            aria-label={t("Admin.statusAria", { title: item.title })}
            className={FIELD}
            value={status}
            onChange={(event) => setStatus(event.target.value as SuggestionStatus)}
          >
            {SUGGESTION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(STATUS_LABELS[value])}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-fg-sub">
          {t("Admin.replyLabel")}
          <textarea
            aria-label={t("Admin.replyAria", { title: item.title })}
            rows={2}
            maxLength={SUGGESTION_NOTE_MAX}
            className={FIELD}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-fg">
            {error}
          </p>
        ) : null}
        <div>
          <button
            type="button"
            disabled={pending}
            onClick={() => onSave(status, note)}
            aria-label={t("Admin.reviewSaveAria", { title: item.title })}
            className="min-h-11 rounded-lg border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head disabled:opacity-60"
          >
            {pending ? t("Common.saving") : t("Common.save")}
          </button>
        </div>
      </div>
    </li>
  );
}

/**
 * 곡 추가 건의에서 바로 곡 등록 창을 여는 버튼(ROOT·ADMIN 화면이라 권한은 이미 갖춘 사용자만 본다. 서버도 다시 검사한다).
 * 건의의 제목(곡명)과 요청 채보(파트·난이도)로 창을 미리 채워 열고, 레벨·기준 난이도 같은 값은 관리자가 직접 넣어 확정한다.
 * 자동 등록이 아니다(D35): 등록해도 건의 상태는 바꾸지 않으므로 처리 상태·답변은 관리자가 따로 저장한다.
 * 서열표 값도 바로 넣을 수 있게 레이팅 서열표 id를 가져오는데, 창을 처음 열 때만 불러온다.
 */
function RegisterSongFromSuggestion({ item }: { item: AdminSuggestionResponse }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState(false);
  const tables = useQuery({
    queryKey: ["difficulty-tables"],
    queryFn: ({ signal }) => fetchDifficultyTables(signal),
    enabled: asked,
  });
  // 서열표 목록이 오기 전에는 창을 열지 않는다. 늦게 오면 tableId가 바뀌면서 입력 중인 폼이 다시 만들어지기 때문이다.
  const ready = asked && !tables.isPending;
  return (
    <div>
      <button
        type="button"
        aria-label={t("Admin.registerFromSuggestionAria", { title: item.title })}
        onClick={() => {
          setAsked(true);
          setOpen(true);
        }}
        className="min-h-11 rounded-lg border border-chip-line px-4 py-1.5 text-sm text-fg hover:bg-table-head"
      >
        {t("Songs.create")}
      </button>
      <SongCreateDialog
        open={open && ready}
        tableId={tables.data ? (pickRatingTable(tables.data)?.id ?? null) : null}
        initial={{
          title: item.title,
          chart: item.requestedPart && item.requestedDifficulty
            ? { part: item.requestedPart, difficulty: item.requestedDifficulty }
            : null,
        }}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
