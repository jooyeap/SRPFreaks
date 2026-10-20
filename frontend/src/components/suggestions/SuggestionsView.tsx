"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pager } from "@/components/Pager";
import { useToast } from "@/components/Toast";
import { StatusLabel } from "@/components/suggestions/StatusLabel";
import { SuggestionForm } from "@/components/suggestions/SuggestionForm";
import { ApiError } from "@/lib/api";
import type { SuggestionCategory } from "@/lib/api-types";
import { formatPlayedDate } from "@/lib/format";
import {
  CATEGORY_LABELS,
  createSuggestion,
  fetchMySuggestions,
  suggestionKeys,
  SUGGESTIONS_PAGE_SIZE,
  type SuggestionValues,
} from "@/lib/suggestions";
import { useScrollTopOnChange } from "@/lib/use-scroll-top";
import { ErrorRetry } from "@/components/ErrorRetry";
import { useTranslations } from "next-intl";
import type { Translator } from "@/i18n/translator";

function messageOf(error: unknown, t: Translator): string | null {
  if (!error) {
    return null;
  }
  return error instanceof ApiError ? error.message : t("Suggestions.sendFailed");
}

/**
 * 건의하기 (D35). 곡 추가·개선사항·버그 제보 등을 보내고, 내가 보낸 건의의 처리 상태와 관리자 답변을 본다.
 * initialCategory/initialTitle은 "곡 추가 건의하기" 링크에서 검색어를 미리 채우기 위한 값이다.
 * 본문은 글자로만 그린다(줄바꿈만 살리고 HTML은 해석하지 않는다).
 */
export function SuggestionsView({
  viewerId,
  initialCategory = null,
  initialTitle = "",
}: {
  viewerId: number;
  initialCategory?: SuggestionCategory | null;
  initialTitle?: string;
}) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(0);
  useScrollTopOnChange(page);

  const mine = useQuery({
    queryKey: suggestionKeys.mine(viewerId, page),
    queryFn: ({ signal }) => fetchMySuggestions(page, SUGGESTIONS_PAGE_SIZE, signal),
    placeholderData: keepPreviousData,
  });

  const create = useMutation({
    mutationFn: (values: SuggestionValues) => createSuggestion(values),
    onSuccess: async () => {
      toast(t("Suggestions.sent"));
      setPage(0);
      await queryClient.invalidateQueries({ queryKey: suggestionKeys.all });
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-fg">{t("Suggestions.heading")}</h1>
      <p className="text-sm text-fg-sub">
        {t("Suggestions.lead")}
      </p>

      <SuggestionForm
        initial={{ category: initialCategory ?? "SONG_REQUEST", title: initialTitle, content: "" }}
        pending={create.isPending}
        error={messageOf(create.error, t)}
        onSubmit={(values) => create.mutateAsync(values)}
      />

      <h2 className="text-lg font-semibold text-fg">{t("Suggestions.mine")}</h2>
      {mine.isPending ? (
        <p className="text-sm text-fg-sub">{t("Common.loading")}</p>
      ) : mine.isError ? (
        <ErrorRetry onRetry={() => void mine.refetch()} retrying={mine.isFetching}>
          {mine.error instanceof ApiError ? mine.error.message : t("Suggestions.listFailed")}
        </ErrorRetry>
      ) : mine.data.content.length === 0 ? (
        <p className="text-sm text-fg-sub">{t("Suggestions.empty")}</p>
      ) : (
        <>
          <ul aria-label={t("Suggestions.listAria")} className="flex flex-col gap-3">
            {mine.data.content.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[17px] font-bold text-fg">{item.title}</h3>
                  <time dateTime={item.createdAt} className="shrink-0 font-num text-xs text-fg-dim">
                    {formatPlayedDate(item.createdAt)}
                  </time>
                </div>
                <div className="flex items-center gap-2 text-xs text-fg-sub">
                  <span>{t(CATEGORY_LABELS[item.category])}</span>
                  <StatusLabel status={item.status} />
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-fg">{item.content}</p>
                {item.adminNote ? (
                  <p className="whitespace-pre-wrap break-words rounded-lg bg-table-head px-3 py-2 text-sm text-fg">
                    <span className="mr-1 font-bold">{t("Suggestions.adminReply")}</span>
                    {item.adminNote}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          <Pager page={mine.data.page} totalPages={mine.data.totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
